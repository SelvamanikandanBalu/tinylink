import 'dotenv/config';
import { pool, query, getClient } from "./src/db.js";

const cors = require('cors');
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');

const linksRouter = require('./routes/links'); // will create in step 5
const db = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // serves index.html, css, js

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS links (
  code VARCHAR(8) PRIMARY KEY,
  target TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  total_clicks BIGINT DEFAULT 0,
  last_clicked TIMESTAMPTZ,
  -- we will hard-delete rows on deletion to make redirect 404 behavior simple
  -- deleted boolean is not required for this assignment
  CHECK (char_length(code) BETWEEN 6 AND 8)
);

CREATE INDEX IF NOT EXISTS idx_links_target ON links (target);
    `);
    console.log("✔ Database table ready");
  } catch (err) {
    console.error("❌ Error creating table:", err);
  }
}

// Healthcheck - required by autograder
app.get('/healthz', (req, res) => {
  res.json({ ok: true, version: '1.0' });
});

// API routes
app.use('/api/links', linksRouter);

// Redirect route (/:code) — must come AFTER /api and /healthz and static
app.get('/:code', async (req, res) => {
  const code = req.params.code;
  try {
    // Find the link
    const findQ = 'SELECT target, total_clicks FROM links WHERE code = $1';
    const findRes = await db.query(findQ, [code]);
    if (findRes.rowCount === 0) {
      return res.status(404).send('Not found');
    }

    // Atomic update: increment clicks and set last_clicked, and fetch target
    // Using RETURNING so we avoid racing between SELECT and UPDATE
    const updateQ = `
      UPDATE links
      SET total_clicks = total_clicks + 1, last_clicked = now()
      WHERE code = $1
      RETURNING target;
    `;
    const updateRes = await db.query(updateQ, [code]);
    const target = updateRes.rows[0].target;

    // Redirect with 302
    return res.redirect(target);
  } catch (err) {
    console.error('Redirect error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/stats.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

// Fallback 404 for anything else not served
app.use((req, res) => {
  res.status(404).send('Not found');
});

await initDatabase();

app.listen(PORT, () => {
  console.log(`TinyLink server listening on port ${PORT}`);
});
