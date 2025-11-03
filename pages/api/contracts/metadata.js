import fs from "fs";
import path from "path";
import unzipper from "unzipper";
import { parseStringPromise } from "xml2js";

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

    const directory = await unzipper.Open.file(filePath);
    const corePropsEntry = directory.files.find(e => e.path === "docProps/core.xml");
    if (!corePropsEntry) return res.status(422).json({ error: "Metadata file not found in docx" });
    const xmlContent = await corePropsEntry.buffer();
    const props = await parseStringPromise(xmlContent);

    // Extract basic info from XML
    const core = props["cp:coreProperties"];
    res.status(200).json({
      title: core["dc:title"]?.[0] || "",
      subject: core["dc:subject"]?.[0] || "",
      author: core["dc:creator"]?.[0] || "",
      keywords: core["cp:keywords"]?.[0] || "",
      comments: core["dc:description"]?.[0] || "",
      created: core["dcterms:created"]?.[0]?._ || "",
      modified: core["dcterms:modified"]?.[0]?._ || "",
      categoria,
      filename
    });
  } catch (err) {
    console.error("[contracts/metadata] Error:", err);
    res.status(500).json({ error: "Metadata error" });
  }
}
