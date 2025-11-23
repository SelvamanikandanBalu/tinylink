const express = require('express');
const router = express.Router();
const db = require('../src/db');

const CODE_RE = /^[A-Za-z0-9]{6,8}$/;

// Simple URL validator using URL constructor
function isValidUrl(str) {
  try {
    const u = new URL(str);
    return (u.protocol === 'http:' || u.protocol === 'https:');
  } catch (e) {
    return false;
  }
}

// POST /api/links  -> create link (409 if code exists)
router.post('/', async (req, res) => {
  const { target, code } = req.body;
  if (!target || typeof target !== 'string' || !isValidUrl(target)) {
    return res.status(400).json({ error: 'Invalid or missing target URL. Must include http(s)://' });
  }
  let usedCode = code;
  if (usedCode) {
    if (!CODE_RE.test(usedCode)) {
      return res.status(400).json({ error: 'Custom code invalid. Must be 6-8 alphanumeric characters.' });
    }
    // check exists
    const existsQ = 'SELECT 1 FROM links WHERE code = $1';
    const existsRes = await db.query(existsQ, [usedCode]);
    if (existsRes.rowCount > 0) {
      return res.status(409).json({ error: 'Code already exists' });
    }
  } else {
    // Auto-generate a code of 6 chars (alphanumeric)
    const gen = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let s = '';
      for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
      return s;
    };
    // Try until free (unlikely to hit many collisions)
    for (let i = 0; i < 5; i++) {
      const candidate = gen();
      const r = await db.query('SELECT 1 FROM links WHERE code = $1', [candidate]);
      if (r.rowCount === 0) {
        usedCode = candidate;
        break;
      }
    }
    if (!usedCode) return res.status(500).json({ error: 'Could not generate code, try again' });
  }

  // Insert
  try {
    const insertQ = `
      INSERT INTO links (code, target)
      VALUES ($1, $2)
      RETURNING code, target, created_at, total_clicks, last_clicked;
    `;
    const insertRes = await db.query(insertQ, [usedCode, target]);
    const row = insertRes.rows[0];
    return res.status(201).json(row);
  } catch (err) {
    console.error('Insert error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/links -> list all
router.get('/', async (req, res) => {
  try {
    const q = `SELECT code, target, created_at, total_clicks, last_clicked FROM links ORDER BY created_at DESC`;
    const r = await db.query(q);
    return res.json(r.rows);
  } catch (err) {
    console.error('List error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/links/:code -> stats for one code
router.get('/:code', async (req, res) => {
  const code = req.params.code;
  try {
    const q = `SELECT code, target, created_at, total_clicks, last_clicked FROM links WHERE code = $1`;
    const r = await db.query(q, [code]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.json(r.rows[0]);
  } catch (err) {
    console.error('Get error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/links/:code -> delete link
router.delete('/:code', async (req, res) => {
  const code = req.params.code;
  try {
    const delQ = `DELETE FROM links WHERE code = $1 RETURNING code`;
    const delRes = await db.query(delQ, [code]);
    if (delRes.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Delete error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
