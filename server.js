import 'dotenv/config';
import express from "express";
import cors from "cors";
import path from "path";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";

import linksRouter from "./routes/links.js";
import { pool, query } from "./src/db.js";

// Needed because __dirname does not exist in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Create table if not exists
async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS links (
        code VARCHAR(8) PRIMARY KEY,
        target TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        total_clicks BIGINT DEFAULT 0,
        last_clicked TIMESTAMPTZ,
        CHECK (char_length(code) BETWEEN 6 AND 8)
      );

      CREATE INDEX IF NOT EXISTS idx_links_target ON links(target);
    `);
    console.log("✔ Database table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
}

// Health check
app.get("/healthz", (req, res) => {
  res.json({ ok: true, version: "1.0" });
});

// API routes
app.use("/api/links", linksRouter);

// Redirect handler
app.get("/:code", async (req, res) => {
  const code = req.params.code;

  try {
    const findRes = await query("SELECT target FROM links WHERE code = $1", [
      code,
    ]);

    if (findRes.rowCount === 0) {
      return res.status(404).send("Not found");
    }

    const updateRes = await query(
      `
      UPDATE links
      SET total_clicks = total_clicks + 1, last_clicked = now()
      WHERE code = $1
      RETURNING target;
    `,
      [code]
    );

    const target = updateRes.rows[0].target;
    return res.redirect(target);
  } catch (err) {
    console.error("Redirect error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Stats page
app.get("/stats.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "stats.html"));
});

// 404 fallback
app.use((req, res) => {
  res.status(404).send("Not found");
});

// Initialize DB and start server
await initDatabase();

app.listen(PORT, () => {
  console.log(`TinyLink server listening on port ${PORT}`);
});
