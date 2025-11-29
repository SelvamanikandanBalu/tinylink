import { Router } from "express";
import { query } from "../src/db.js";

const router = Router();

const CODE_RE = /^[A-Za-z0-9]{6,8}$/;

// Simple URL validator using URL constructor
function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch (e) {
    return false;
  }
}

// POST /api/links -> create link
router.post("/", async (req, res) => {
  const { target, code } = req.body;

  if (!target || typeof target !== "string" || !isValidUrl(target)) {
    return res
      .status(400)
      .json({ error: "Invalid or missing target URL. Must include http(s)://" });
  }

  let usedCode = code;

  if (usedCode) {
    if (!CODE_RE.test(usedCode)) {
      return res
        .status(400)
        .json({
          error: "Custom code invalid. Must be 6-8 alphanumeric characters.",
        });
    }

    const existsRes = await query("SELECT 1 FROM links WHERE code = $1", [
      usedCode,
    ]);
    if (existsRes.rowCount > 0) {
      return res.status(409).json({ error: "Code already exists" });
    }
  } else {
    const gen = () => {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let s = "";
      for (let i = 0; i < 6; i++)
        s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    };

    for (let i = 0; i < 5; i++) {
      const candidate = gen();
      const r = await query("SELECT 1 FROM links WHERE code = $1", [
        candidate,
      ]);
      if (r.rowCount === 0) {
        usedCode = candidate;
        break;
      }
    }

    if (!usedCode)
      return res.status(500).json({ error: "Could not generate code, try again" });
  }

  try {
    const insertQ = `
      INSERT INTO links (code, target)
      VALUES ($1, $2)
      RETURNING code, target, created_at, total_clicks, last_clicked;
    `;
    const insertRes = await query(insertQ, [usedCode, target]);
    const data = insertRes.rows[0];
    data.short_url = `${process.env.BASE_URL}/${data.code}`;
    return res.status(201).json(data);
  } catch (err) {
    console.error("Insert error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/links -> list all
router.get("/", async (req, res) => {
  try {
    const r = await query(
      `SELECT code, target, created_at, total_clicks, last_clicked 
       FROM links 
       ORDER BY created_at DESC`
    );
    return res.json(r.rows);
  } catch (err) {
    console.error("List error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/links/:code -> stats of one
router.get("/:code", async (req, res) => {
  const code = req.params.code;
  try {
    const r = await query(
      `SELECT code, target, created_at, total_clicks, last_clicked 
       FROM links WHERE code = $1`,
      [code]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error("Get error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/links/:code
router.delete("/:code", async (req, res) => {
  const code = req.params.code;
  try {
    const delRes = await query(
      `DELETE FROM links WHERE code = $1 RETURNING code`,
      [code]
    );
    if (delRes.rowCount === 0)
      return res.status(404).json({ error: "Not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("Delete error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
