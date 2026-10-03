/**
 * Yazım denetimi istemcisi: işçiyle konuşur, sonuçları önbelleğe alır,
 * kişisel sözlüğü ve "yoksay" listesini tutar.
 */
import { normalizeWord } from './engine';

type Listener = () => void;
export type SpellStatus = 'off' | 'loading' | 'ready' | 'error';

const USER_KEY = 'wtf.spell.user';
const lower = (w: string) => normalizeWord(w).toLocaleLowerCase('tr-TR');

function readUser(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(USER_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

class SpellClient {
  status: SpellStatus = 'off';
  private worker: Worker | null = null;
  private seq = 0;
  private waiting = new Map<number, (v: unknown) => void>();
  private cache = new Map<string, boolean>();
  private inflight = new Set<string>();
  private user = new Set(readUser().map(lower));
  private ignored = new Set<string>();
  /** Belgeye özgü bilinen adlar (karakterler); editör günceller */
  names = new Set<string>();
  private listeners = new Set<Listener>();

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  private call<T>(msg: Record<string, unknown>): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.waiting.set(id, (v) => {
        const r = v as { result?: T; error?: string };
        if (r.error) reject(new Error(r.error));
        else resolve(r.result as T);
      });
      this.worker!.postMessage({ ...msg, id });
    });
  }

  /** Sözlüğü (ilk kullanımda) yükle */
  start() {
    if (this.worker || typeof Worker === 'undefined') return;
    this.status = 'loading';
    this.emit();
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e) => {
      const fn = this.waiting.get(e.data.id);
      this.waiting.delete(e.data.id);
      fn?.(e.data);
    };
    this.worker.onerror = () => {
      this.status = 'error';
      this.emit();
    };
    this.call({ type: 'load', base: new URL(import.meta.env.BASE_URL || '/', window.location.href).href })
      .then(() => {
        this.status = 'ready';
        this.emit();
      })
      .catch(() => {
        this.status = 'error';
        this.emit();
      });
  }

  /** true: hatalı, false: doğru, undefined: henüz bilinmiyor (istek kuyruğa alınır) */
  isWrong(word: string): boolean | undefined {
    const k = lower(word);
    if (this.user.has(k) || this.ignored.has(k) || this.names.has(k)) return false;
    const base = k.split("'")[0];
    if (base !== k && (this.user.has(base) || this.names.has(base))) return false;
    const v = this.cache.get(word);
    return v === undefined ? undefined : !v;
  }

  /** Bilinmeyen kelimeleri işçiye sor; yanıt gelince dinleyicilere haber ver */
  request(words: string[]) {
    if (this.status !== 'loading' && this.status !== 'ready') return;
    const todo = [...new Set(words)].filter((w) => !this.cache.has(w) && !this.inflight.has(w));
    if (!todo.length) return;
    for (const w of todo) this.inflight.add(w);
    this.call<Record<string, boolean>>({ type: 'check', words: todo })
      .then((res) => {
        for (const [w, ok] of Object.entries(res)) this.cache.set(w, ok);
        this.emit();
      })
      .catch(() => {})
      .finally(() => todo.forEach((w) => this.inflight.delete(w)));
  }

  suggest(word: string): Promise<string[]> {
    if (this.status !== 'ready') return Promise.resolve([]);
    return this.call<string[]>({ type: 'suggest', word }).catch(() => []);
  }

  /** Ayar değişti: editörler yeniden denetlesin */
  poke() {
    this.emit();
  }
  userWords() {
    return [...this.user].sort((a, b) => a.localeCompare(b, 'tr'));
  }
  addToDictionary(word: string) {
    this.user.add(lower(word));
    this.persist();
    this.emit();
  }
  removeFromDictionary(word: string) {
    this.user.delete(lower(word));
    this.persist();
    this.emit();
  }
  ignore(word: string) {
    this.ignored.add(lower(word));
    this.emit();
  }
  setNames(names: Iterable<string>) {
    const next = new Set<string>();
    for (const n of names) for (const part of n.split(/[\s.]+/)) if (part.length > 1) next.add(lower(part));
    const same = next.size === this.names.size && [...next].every((x) => this.names.has(x));
    if (same) return;
    this.names = next;
    this.emit();
  }
  private persist() {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify([...this.user]));
    } catch {
      /* yer yoksa geç */
    }
  }
}

export const spell = new SpellClient();
