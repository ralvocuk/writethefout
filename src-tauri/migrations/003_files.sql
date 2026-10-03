CREATE TABLE IF NOT EXISTS recent_file (
  path TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  opened_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS doc_snapshot (
  id TEXT PRIMARY KEY,
  doc_key TEXT NOT NULL,
  label TEXT NOT NULL,
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS doc_snapshot_key ON doc_snapshot(doc_key, created_at);
