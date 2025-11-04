//v10
import pool from "../../src/db/pool"; // ajuste o path se necessário

export default async function handler(req, res) {
  const userId = req.headers["x-user-id"] || "testuser"; // substitua por autenticação real depois

  if (!userId) return res.status(401).json({ error: "Missing user id." });

  if (req.method === "GET") {
    try {
      const { rows } = await pool.query(
        "SELECT key, value FROM storage WHERE user_id = $1 ORDER BY updated_at DESC",
        [userId]
      );
      res.status(200).json({ data: rows });
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  } else if (req.method === "POST") {
    const { key, value } = req.body;
    if (!key || !value) return res.status(400).json({ error: "Missing key/value in body." });
    try {
      await pool.query(
        `
        INSERT INTO storage (user_id, key, value, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, key) DO UPDATE
        SET value = $3, updated_at = NOW()
        `,
        [userId, key, value]
      );
      res.status(200).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Database error" });
    }
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end("Method Not Allowed");
  }
}
