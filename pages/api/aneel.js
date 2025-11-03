import fetch from "node-fetch";
import fs from "fs";
import path from "path";

/**
 * Proxy to ANEEL CKAN API with fallback to local CSV for energy tariff data.
 */
export default async function handler(req, res) {
  const { path: apiPath } = req.query;

  // Expect: /api/aneel?path=<CKAN API or resource path>
  if (!apiPath) {
    return res.status(400).json({ error: "Missing 'path' parameter" });
  }

  // Remote CKAN base
  const remoteUrl = `https://dados.aneel.gov.br${apiPath}`;

  try {
    const response = await fetch(remoteUrl);
    const contentType = response.headers.get("content-type");
    if (!response.ok) {
      throw new Error(`Remote responded ${response.status}`);
    }

    // JSON or CSV
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return res.status(200).json(data);
    }
    if (contentType && contentType.includes("text/csv")) {
      const data = await response.text();
      res.setHeader("Content-Type", "text/csv");
      return res.status(200).send(data);
    }
    throw new Error("Remote returned unsupported content type");
  } catch (err) {
    // Fallback to local file if available
    console.error("[ANEEL Proxy] Fallback -", err);
    const fallbackPath = path.join(process.cwd(), "public", "tarifas_medias.csv");
    if (fs.existsSync(fallbackPath)) {
      const csvData = fs.readFileSync(fallbackPath, "utf8");
      res.setHeader("Content-Type", "text/csv");
      return res.status(200).send(csvData);
    }
    return res.status(502).json({ error: "ANEEL unavailable, no local fallback." });
  }
}
