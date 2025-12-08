import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";
import { getPgPool } from "../server/database/pgPool.js";

const JWKS_URL =
  process.env.JWKS_URL ||
  "https://api.stack-auth.com/api/v1/projects/deead568-c1e6-436c-ba28-85bf3fbebef5/.well-known/jwks.json";
const AUDIENCE = process.env.NEXT_PUBLIC_STACK_PROJECT_ID || "deead568-c1e6-436c-ba28-85bf3fbebef5";

// Create / reuse global pool to avoid connection storms in serverless
const pool = getPgPool();

// JWKS client with caching
const jwksClient = jwksRsa({
  jwksUri: JWKS_URL,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
});

function getKey(header, callback) {
  jwksClient.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

const TRUSTED_ORIGIN = process.env.TRUSTED_ORIGIN || "https://app.solarinvest.info";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const origin = req.headers.origin || req.headers.referer || "";
  if (TRUSTED_ORIGIN && origin && !origin.startsWith(TRUSTED_ORIGIN)) {
    return res.status(403).json({ error: "Untrusted origin" });
  }

  const auth = req.headers.authorization || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = match[1];

  let decoded;
  try {
    decoded = await new Promise((resolve, reject) => {
      jwt.verify(
        token,
        getKey,
        {
          audience: AUDIENCE,
          algorithms: ["RS256"],
        },
        (err, payload) => (err ? reject(err) : resolve(payload))
      );
    });
  } catch (err) {
    console.error("JWT verification failed:", err);
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }

  const event = req.body;
  if (!event || (!event.fileKey && !event.file_key && !event.key)) {
    return res.status(400).json({ error: "Missing fileKey in event body" });
  }
  const fileKey = event.fileKey || event.file_key || event.key;
  const action = event.action || event.type || "unknown";
  const metadata = event.metadata || event.meta || null;

  const client = await pool.connect();
  try {
    const insertText = `
      INSERT INTO storage_events (user_id, file_key, action, metadata, received_at)
      VALUES ($1, $2, $3, $4, now())
      RETURNING id
    `;
    const values = [decoded.sub || decoded.user_id || null, fileKey, action, metadata ? JSON.stringify(metadata) : null];
    const result = await client.query(insertText, values);
    const id = result.rows[0]?.id ?? null;
    return res.status(200).json({ success: true, id });
  } catch (err) {
    console.error("DB write failed:", err);
    return res.status(500).json({ error: "Database error" });
  } finally {
    client.release();
  }
}