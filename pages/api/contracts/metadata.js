import fs from "fs";
import path from "path";
import DocxMeta from "@natancabral/docx-meta";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end("Method Not Allowed");
  }
  try {
    const categoria = req.query.categoria === "vendas" ? "vendas" : "leasing";
    const filename = req.query.filename;
    if (!filename) return res.status(400).json({ error: "Missing filename." });
    const filePath = path.join(process.cwd(), "assets", "templates", "contratos", categoria, filename);

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });

    const buffer = fs.readFileSync(filePath);
    const meta = new DocxMeta(buffer);

    // Returns available built-in properties (subject, author, created, modified, etc.)
    res.status(200).json({
      title: meta.title,
      subject: meta.subject,
      author: meta.author,
      keywords: meta.keywords,
      comments: meta.comments,
      created: meta.created,
      modified: meta.modified,
      category: categoria,
      filename,
    });
  } catch (err) {
    console.error("[contracts/metadata] Error:", err);
    res.status(500).json({ error: "Metadata error" });
  }
}
