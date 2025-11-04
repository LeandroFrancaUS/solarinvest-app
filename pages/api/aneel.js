//v6
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const { path: apiPath } = req.query;
  if (!apiPath) return res.status(400).json({ error: "Missing 'path' parameter" });

  if (!apiPath.startsWith("/")) return res.status(400).json({ error: "Invalid path parameter" });

  const remoteUrl = `https://dados.aneel.gov.br${apiPath}`;
  try {
    const response = await fetch(remoteUrl);
    const contentType = response.headers.get("content-type");
    if (!response.ok) throw new Error(`Remote responded ${response.status}`);
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return res.status(200).json(data);
    }
    if (contentType && contentType.includes("text/csv")) {
      const data = await response.text();
      res.setHeader("Content-Type", "text/csv");
      return res.status(200).send(data);
    }
    throw new Error("Unsupported remotely returned type");
  } catch (err) {
    const fallbackPath = path.join(process.cwd(), "public", "tarifas_medias.csv");
    if (fs.existsSync(fallbackPath)) {
      const csvData = fs.readFileSync(fallbackPath, "utf8");
      res.setHeader("Content-Type", "text/csv");
      return res.status(200).send(csvData);
    }
    return res.status(502).json({ error: "ANEEL unavailable, no local fallback." });
  }
}
