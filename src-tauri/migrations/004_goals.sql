CREATE TABLE IF NOT EXISTS writing_sprint (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  minutes INTEGER NOT NULL,
  words INTEGER NOT NULL DEFAULT 0,
  target INTEGER,
  completed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS writing_sprint_time ON writing_sprint(started_at);
