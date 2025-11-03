import fs from "fs";
import path from "path";

// Lists .docx contract templates in public/contracts/<categoria>
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
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".docx"));
    // Return URLs for direct download from /contracts/{categoria}/{file}
    const urls = files.map(file => `/contracts/${categoria}/${file}`);
    res.status(200).json({ templates: urls });
  } catch (err) {
    console.error("[contracts/templates] Error:", err);
    res.status(500).json({ error: "Failed to load contract templates" });
  }
}
