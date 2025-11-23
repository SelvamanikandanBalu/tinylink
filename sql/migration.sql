-- Run this on your Postgres (Neon / local) to create the links table.

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
