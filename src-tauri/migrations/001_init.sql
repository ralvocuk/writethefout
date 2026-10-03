CREATE TABLE IF NOT EXISTS project (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'novel',
  settings TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS node (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  parent_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  synopsis TEXT NOT NULL DEFAULT '',
  pov TEXT,
  location TEXT,
  word_target INTEGER,
  color TEXT,
  doc_mode TEXT NOT NULL DEFAULT 'prose',
  doc_json TEXT,
  plain_text TEXT NOT NULL DEFAULT '',
  word_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS node_parent ON node(project_id, parent_id, sort_key);
CREATE TABLE IF NOT EXISTS snapshot (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES node(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  doc_json TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS writing_session (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  day TEXT NOT NULL,
  words_added INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS session_day ON writing_session(project_id, day);
