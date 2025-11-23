require('dotenv').config();
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

app.listen(PORT, () => {
  console.log(`TinyLink server listening on port ${PORT}`);
});
