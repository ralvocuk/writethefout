CREATE TABLE IF NOT EXISTS scene_meta (
  sid TEXT NOT NULL,
  project_id TEXT NOT NULL,
  synopsis TEXT NOT NULL DEFAULT '',
  color TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  story_day TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, sid)
);
CREATE TABLE IF NOT EXISTS character_profile (
  name TEXT NOT NULL,
  project_id TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, name)
);
