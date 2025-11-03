import path from "path";
import fs from "fs";
import mammoth from "mammoth";

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

    const { value: text } = await mammoth.extractRawText({ path: filePath });
    res.status(200).json({ text, categoria, filename });
  } catch (err) {
    console.error("[contracts/text] Error:", err);
    res.status(500).json({ error: "Text extraction error" });
  }
}
