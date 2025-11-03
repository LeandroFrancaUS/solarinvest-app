import fs from "fs";
import path from "path";
import { getPropertiesFromFile } from "office-document-properties";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end("Method Not Allowed");
  }
  try {
    const categoria = req.query.categoria === "vendas" ? "vendas" : "leasing";
    const filename = req.query.filename;
    if (!filename) return res.status(400).json({ error: "Missing filename." });

    const filePath = path.join(process.cwd(), "public", "contracts", categoria, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });

    const properties = await getPropertiesFromFile(filePath);

    res.status(200).json({
      ...properties,
      categoria,
      filename
    });
  } catch (err) {
    console.error("[contracts/metadata] Error:", err);
    res.status(500).json({ error: "Metadata error" });
  }
}
