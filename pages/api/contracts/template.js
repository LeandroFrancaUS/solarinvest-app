import fs from "fs";
import path from "path";

/**
 * Lists .docx contract templates in the category directory under assets/templates/contratos.
 * Usage: /api/contracts/templates?categoria=leasing or categoria=vendas
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const categoria = req.query.categoria === "vendas" ? "vendas" : "leasing"; // default to leasing if not vendas
    const dir = path.join(process.cwd(), "assets", "templates", "contratos", categoria);
    if (!fs.existsSync(dir)) {
      return res.status(404).json({ error: `Category not found: ${categoria}` });
    }
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".docx"));
    res.status(200).json({ templates: files });
  } catch (err) {
    console.error("[contracts/templates] Error:", err);
    res.status(500).json({ error: "Failed to load contract templates" });
  }
}
