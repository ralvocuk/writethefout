/**
 * Uygulama durumu deposu. Senaryolar diskte .fountain dosyası olarak yaşar;
 * burada yalnızca son açılan dosyalar, anlık görüntüler ve yazma sayaçları tutulur.
 * Masaüstünde SQLite, tarayıcıda (geliştirme) localStorage.
 */
export interface RecentFile {
  path: string;
  title: string;
  openedAt: number;
}

export interface Snapshot {
  id: string;
  /** belge anahtarı: dosya yolu ya da kaydedilmemiş belge için "untitled:<id>" */
  docKey: string;
  label: string;
  /** writetheFout. belge metni (Fountain + meta) */
  content: string;
  wordCount: number;
  createdAt: number;
}

export interface Sprint {
  id: string;
  startedAt: number;
  minutes: number;
  words: number;
  target: number | null;
  completed: boolean;
}
export interface DayWords {
  day: string;
  words: number;
}

export interface AppRepository {
  readonly kind: 'sqlite' | 'local';
  recent(): Promise<RecentFile[]>;
  touchRecent(path: string, title: string): Promise<void>;
  forgetRecent(path: string): Promise<void>;
  listSnapshots(docKey: string): Promise<Snapshot[]>;
  addSnapshot(s: Snapshot): Promise<void>;
  wordsToday(day: string): Promise<number>;
  addWords(day: string, delta: number): Promise<void>;
  /** gün gün yazılan kelimeler (yalnızca kayıt olan günler, eskiden yeniye) */
  wordHistory(fromDay: string): Promise<DayWords[]>;
  addSprint(s: Sprint): Promise<void>;
  sprints(limit: number): Promise<Sprint[]>;
}

export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let repo: AppRepository | null = null;

export async function getRepository(): Promise<AppRepository> {
  if (repo) return repo;
  if (isTauri()) {
    const { createSqliteRepository } = await import('./sqliteRepository');
    repo = await createSqliteRepository();
  } else {
    const { createLocalRepository } = await import('./localRepository');
    repo = createLocalRepository();
  }
  return repo;
}

export const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
