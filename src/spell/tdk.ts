/**
 * TDK Güncel Türkçe Sözlük (sozluk.gov.tr) ile yazım önerisi: "mekan" → "mekân", "hikayeyi" → "hikâyeyi".
 *
 * Yalnızca sözlüğün kesin söylediği durumlarda öneri verir:
 *  - yazılan biçim sözlükte madde olarak varsa (kar, hala) hiçbir şey önermez (kâr/hâlâ anlam farkı);
 *  - yoksa ve düzeltme işaretsiz biçimi yazılanla aynı tek bir madde varsa (mekan → mekân) onu önerir;
 *  - çekimli kelimede (mekanda) en uzun kökü arar, eki korur (mekânda).
 * Sonuçlar diskte önbelleğe alınır; istekler sırayla ve aralıklı gönderilir.
 */
import { isTauri } from '../data/repository';

export interface TdkEntry {
  madde: string;
  madde_duz?: string;
}
/** null: sözlükte yok */
export type TdkResult = TdkEntry[] | null;

const lower = (s: string) => s.toLocaleLowerCase('tr-TR');
const upper = (s: string) => s.toLocaleUpperCase('tr-TR');
const plain = (s: string) => s.replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u').replace(/Â/g, 'A').replace(/Î/g, 'İ').replace(/Û/g, 'U');
const HAS_HAT = /[âîûÂÎÛ]/;

/** Kelimeyi bu sözlükle denetlemeye değer mi (düzeltme işareti alabilecek harf içeren, işaretsiz Türkçe kelime) */
export function eligible(word: string): boolean {
  if (word.length < 3 || HAS_HAT.test(word) || /['’\d-]/.test(word)) return false;
  if (!/^[\p{L}]+$/u.test(word)) return false;
  return /[aiuAIİU]/.test(word);
}

/** Tek bir madde sonucuna göre: undefined = bu biçim geçerli (öneri yok), string = öneri, null = karar yok */
export function decide(query: string, res: TdkResult): string | null | undefined {
  if (!res || !res.length) return null;
  const q = lower(query);
  if (res.some((e) => lower(e.madde) === q)) return undefined;
  const hats = [...new Set(res.filter((e) => HAS_HAT.test(e.madde) && lower(plain(e.madde)) === q).map((e) => lower(e.madde)))];
  return hats.length === 1 ? hats[0] : null;
}

/** Önerinin büyük/küçük harfini yazılana uydurur */
export function matchCase(typed: string, suggestion: string): string {
  if (typed.length > 1 && typed === upper(typed)) return upper(suggestion);
  if (typed[0] && typed[0] === upper(typed[0]) && typed[0] !== lower(typed[0])) return upper(suggestion[0]) + suggestion.slice(1);
  return suggestion;
}

/* ---------- Ağ ve önbellek ---------- */

const CACHE_KEY = 'wtf.tdk.v1';
const cache = new Map<string, TdkResult>(
  (() => {
    try {
      return Object.entries(JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')) as [string, TdkResult][];
    } catch {
      return [];
    }
  })(),
);
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      // en fazla 20.000 kayıt
      const entries = [...cache.entries()].slice(-20000);
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* yer yoksa geç */
    }
  }, 1500);
};

/** Sözlüğe ulaşılamıyorsa bir süre denemeyi bırak */
let offlineUntil = 0;
export const tdkOnline = () => Date.now() >= offlineUntil;

async function fetchJson(url: string): Promise<unknown> {
  if (isTauri()) {
    const { fetch } = await import('@tauri-apps/plugin-http');
    const r = await fetch(url, { method: 'GET', connectTimeout: 6000 });
    return JSON.parse(await r.text());
  }
  // geliştirme: Vite vekil sunucusu
  const r = await fetch(url.replace('https://sozluk.gov.tr', '/tdk'));
  return JSON.parse(await r.text());
}

// sıralı kuyruk: TDK'yı yormamak için istekler arasında kısa bekleme
let chain: Promise<unknown> = Promise.resolve();
const GAP = 180;

export function lookup(word: string): Promise<TdkResult> {
  const q = lower(word);
  if (cache.has(q)) return Promise.resolve(cache.get(q)!);
  if (!tdkOnline()) return Promise.reject(new Error('offline'));
  const job = chain.then(async () => {
    if (cache.has(q)) return cache.get(q)!;
    try {
      const data = await fetchJson(`https://sozluk.gov.tr/gts?ara=${encodeURIComponent(q)}`);
      const res: TdkResult = Array.isArray(data)
        ? data.map((e: { madde?: string; madde_duz?: string }) => ({ madde: String(e.madde ?? ''), madde_duz: e.madde_duz }))
        : null;
      cache.set(q, res);
      persist();
      await new Promise((r) => setTimeout(r, GAP));
      return res;
    } catch (e) {
      offlineUntil = Date.now() + 60_000;
      throw e;
    }
  });
  chain = job.catch(() => {});
  return job;
}

/** Önbellekteki kararlar (eşzamanlı): string = öneri, undefined = bilinmiyor/öneri yok */
const decided = new Map<string, string | null>();
export function cachedSuggestion(word: string): string | undefined {
  const v = decided.get(lower(word));
  return v ? matchCase(word, v) : undefined;
}

/**
 * Kelime için TDK önerisi. Çekimli kelimelerde kökü kısaltarak arar (en çok 6 harf ek).
 * Dönüş: önerilen yazım (yazılanın harf düzeninde) ya da null.
 */
export async function suggestionFor(word: string): Promise<string | null> {
  if (!eligible(word)) return null;
  const q = lower(word);
  if (decided.has(q)) {
    const v = decided.get(q)!;
    return v ? matchCase(word, v) : null;
  }
  let result: string | null = null;
  const first = decide(q, await lookup(q));
  if (first === undefined) result = null;
  else if (first) result = first;
  else {
    for (let n = q.length - 1; n >= Math.max(3, q.length - 6); n--) {
      const stem = q.slice(0, n);
      if (!/[aiu]/.test(stem)) break;
      const d = decide(stem, await lookup(stem));
      if (d === undefined) break; // kök işaretsiz haliyle geçerli: öneri yok
      if (d) {
        result = d + q.slice(n);
        break;
      }
    }
  }
  decided.set(q, result);
  return result ? matchCase(word, result) : null;
}

/** Testler için */
export function _resetTdk(seed?: Record<string, TdkResult>) {
  cache.clear();
  decided.clear();
  offlineUntil = 0;
  for (const [k, v] of Object.entries(seed ?? {})) cache.set(k, v);
}
