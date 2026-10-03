import Database from '@tauri-apps/plugin-sql';
import type { AppRepository, RecentFile, Snapshot, Sprint } from './repository';

const MAX_RECENT = 15;
const MAX_SNAPSHOTS = 60;

export async function createSqliteRepository(): Promise<AppRepository> {
  const db = await Database.load('sqlite:writethefout.db');
  await db.execute('PRAGMA journal_mode = WAL');

  return {
    kind: 'sqlite',
    async recent() {
      const rows = await db.select<{ path: string; title: string; opened_at: number }[]>(
        'SELECT * FROM recent_file ORDER BY opened_at DESC LIMIT $1',
        [MAX_RECENT],
      );
      return rows.map<RecentFile>((r) => ({ path: r.path, title: r.title, openedAt: r.opened_at }));
    },
    async touchRecent(path, title) {
      await db.execute(
        `INSERT INTO recent_file (path, title, opened_at) VALUES ($1, $2, $3)
         ON CONFLICT(path) DO UPDATE SET title = $2, opened_at = $3`,
        [path, title, Date.now()],
      );
      await db.execute(
        'DELETE FROM recent_file WHERE path NOT IN (SELECT path FROM recent_file ORDER BY opened_at DESC LIMIT $1)',
        [MAX_RECENT],
      );
    },
    async forgetRecent(path) {
      await db.execute('DELETE FROM recent_file WHERE path = $1', [path]);
    },
    async listSnapshots(docKey) {
      const rows = await db.select<{ id: string; doc_key: string; label: string; content: string; word_count: number; created_at: number }[]>(
        'SELECT * FROM doc_snapshot WHERE doc_key = $1 ORDER BY created_at DESC LIMIT $2',
        [docKey, MAX_SNAPSHOTS],
      );
      return rows.map<Snapshot>((r) => ({ id: r.id, docKey: r.doc_key, label: r.label, content: r.content, wordCount: r.word_count, createdAt: r.created_at }));
    },
    async addSnapshot(s) {
      await db.execute(
        'INSERT INTO doc_snapshot (id, doc_key, label, content, word_count, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [s.id, s.docKey, s.label, s.content, s.wordCount, s.createdAt],
      );
      await db.execute(
        `DELETE FROM doc_snapshot WHERE doc_key = $1 AND id NOT IN
           (SELECT id FROM doc_snapshot WHERE doc_key = $1 ORDER BY created_at DESC LIMIT $2)`,
        [s.docKey, MAX_SNAPSHOTS],
      );
    },
    async wordsToday(day) {
      const r = await db.select<{ words_added: number }[]>("SELECT words_added FROM writing_session WHERE project_id = 'all' AND day = $1", [day]);
      return r[0]?.words_added ?? 0;
    },
    async addWords(day, delta) {
      await db.execute(
        `INSERT INTO writing_session (id, project_id, day, words_added) VALUES ($1, 'all', $1, MAX(0, $2))
         ON CONFLICT(project_id, day) DO UPDATE SET words_added = MAX(0, words_added + $2)`,
        [day, delta],
      );
    },
    async wordHistory(fromDay) {
      const rows = await db.select<{ day: string; words_added: number }[]>(
        "SELECT day, words_added FROM writing_session WHERE project_id = 'all' AND day >= $1 ORDER BY day",
        [fromDay],
      );
      return rows.map((r) => ({ day: r.day, words: r.words_added }));
    },
    async addSprint(s) {
      await db.execute(
        'INSERT OR REPLACE INTO writing_sprint (id, started_at, minutes, words, target, completed) VALUES ($1,$2,$3,$4,$5,$6)',
        [s.id, s.startedAt, s.minutes, s.words, s.target, s.completed ? 1 : 0],
      );
    },
    async sprints(limit) {
      const rows = await db.select<{ id: string; started_at: number; minutes: number; words: number; target: number | null; completed: number }[]>(
        'SELECT * FROM writing_sprint ORDER BY started_at DESC LIMIT $1',
        [limit],
      );
      return rows.map<Sprint>((r) => ({ id: r.id, startedAt: r.started_at, minutes: r.minutes, words: r.words, target: r.target, completed: !!r.completed }));
    },
  };
}
