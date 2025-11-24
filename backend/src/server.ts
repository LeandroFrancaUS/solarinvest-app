import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.routes.js";
import { invoicesRouter } from "./routes/invoices.routes.js";

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "10mb" }));

app.use("/api/health", healthRouter);
app.use("/api/invoices", invoicesRouter);

app.listen(env.port, () => {
  console.log(`Invoice Engine backend ouvindo na porta ${env.port}`);
});
