import fs from 'fs';
import path from 'path';

// Simple example: serve static contract template names from public directory
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end("Method Not Allowed");
  }
  try {
    const categoria = req.query.categoria || "leasing";
    const dir = path.join(process.cwd(), "public", "contracts", categoria);
    if (!fs.existsSync(dir)) {
      return res.status(404).json({ error: "Category not found" });
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".docx"));
    res.status(200).json({ templates: files });
  } catch (err) {
    res.status(500).json({ error: "Failed to load contract templates" });
  }
}
