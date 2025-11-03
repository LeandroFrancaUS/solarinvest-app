import path from "path";
import fs from "fs";
import { getPropertiesFromFile } from "office-document-properties";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const categoria = req.query.categoria === "vendas" ? "vendas" : "leasing";
    const dir = path.join(process.cwd(), "public", "contracts", categoria);

    if (!fs.existsSync(dir)) {
      return res.status(404).json({ error: `Category not found: ${categoria}` });
    }
    const files = fs.readdirSync(dir).filter(f => f.endsWith(".docx"));

    const metadataList = [];
    for (const filename of files) {
      const filePath = path.join(dir, filename);
      try {
        const properties = await getPropertiesFromFile(filePath); // Await because it's async
        metadataList.push({
          categoria,
          filename,
          ...properties,
        });
      } catch (e) {
        metadataList.push({
          categoria,
          filename,
          error: "Metadata extraction failed"
        });
      }
    }
    res.status(200).json({ templates: metadataList });
  } catch (err) {
    console.error("[contracts/bulk-metadata] Error:", err);
    res.status(500).json({ error: "Bulk metadata error" });
  }
}
