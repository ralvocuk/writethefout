import type { AppRepository, RecentFile, Snapshot, Sprint } from './repository';

const RECENT = 'wtf.recent.v2';
const SNAP = 'wtf.snapshots.v2';
const WORDS = 'wtf.words.v2';
const SPRINTS = 'wtf.sprints.v1';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* depolama yoksa sessizce geç */
  }
}

/** Tarayıcıda geliştirme için; masaüstü sürümü SQLite kullanır. */
export function createLocalRepository(): AppRepository {
  return {
    kind: 'local',
    async recent() {
      return read<RecentFile[]>(RECENT, []).sort((a, b) => b.openedAt - a.openedAt);
    },
    async touchRecent(path, title) {
      const list = read<RecentFile[]>(RECENT, []).filter((r) => r.path !== path);
      write(RECENT, [{ path, title, openedAt: Date.now() }, ...list].slice(0, 15));
    },
    async forgetRecent(path) {
      write(RECENT, read<RecentFile[]>(RECENT, []).filter((r) => r.path !== path));
    },
    async listSnapshots(docKey) {
      return read<Snapshot[]>(SNAP, [])
        .filter((s) => s.docKey === docKey)
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async addSnapshot(s) {
      write(SNAP, [...read<Snapshot[]>(SNAP, []), s].slice(-40));
    },
    async wordsToday(day) {
      return read<Record<string, number>>(WORDS, {})[day] ?? 0;
    },
    async addWords(day, delta) {
      const all = read<Record<string, number>>(WORDS, {});
      all[day] = Math.max(0, (all[day] ?? 0) + delta);
      write(WORDS, all);
    },
    async wordHistory(fromDay) {
      return Object.entries(read<Record<string, number>>(WORDS, {}))
        .filter(([d]) => d >= fromDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, words]) => ({ day, words }));
    },
    async addSprint(s) {
      write(SPRINTS, [s, ...read<Sprint[]>(SPRINTS, []).filter((x) => x.id !== s.id)].slice(0, 100));
    },
    async sprints(limit) {
      return read<Sprint[]>(SPRINTS, []).slice(0, limit);
    },
  };
}
