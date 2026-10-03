/**
 * TDK Güncel Türkçe Sözlük (sozluk.gov.tr) ile yazım önerisi.
 *
 *  - Kesin öneri: yazılan biçim sözlükte yoksa ve düzeltme işaretli tek bir madde ona denk geliyorsa
 *    ("mekan" → "mekân", "hikayeyi" → "hikâyeyi": çekimli kelimede kök aranır, ek korunur).
 *  - Anlam ayrımı: iki biçim de sözlükte varsa (hala / hâlâ, kar / kâr, alem / âlem) işaretli biçim
 *    "bunu mu demek istediniz?" diye, iki anlamıyla birlikte önerilir; karar yazarındır.
 *  - Sözlükte madde olarak bulunan kelime yazım denetiminden de geçmiş sayılır (sözlükte olmayan yeni kelimeler).
 * Sonuçlar diskte önbelleğe alınır; istekler sırayla ve aralıklı gönderilir.
 */
import { isTauri } from '../data/repository';

export interface TdkEntry {
  madde: string;
  madde_duz?: string;
  /** ilk anlamı (kısaltılmış) */
  anlam?: string;
}
/** null: sözlükte yok */
export type TdkResult = TdkEntry[] | null;

export interface TdkSuggestion {
  /** önerilen yazım (yazılanın harf düzeninde) */
  text: string;
  /** iki biçim de doğru, anlam farkı var */
  ambiguous: boolean;
  /** önerilen biçimin anlamı */
  meaning?: string;
  /** yazılan biçimin anlamı (anlam ayrımında) */
  ownMeaning?: string;
}

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

const shortMeaning = (s?: string) => {
  if (!s) return undefined;
  const t = s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const first = t.split(/[;:]/)[0].trim();
  return first.length > 60 ? `${first.slice(0, 58).trimEnd()}…` : first;
};

export type Decision =
  | { kind: 'valid' }
  | { kind: 'none' }
  | { kind: 'sure'; text: string; meaning?: string }
  | { kind: 'ambiguous'; text: string; meaning?: string; ownMeaning?: string };

/** Tek bir madde sonucuna göre karar */
export function decide(query: string, res: TdkResult): Decision {
  if (!res || !res.length) return { kind: 'none' };
  const q = lower(query);
  const own = res.find((e) => lower(e.madde) === q);
  const hats = [...new Map(res.filter((e) => HAS_HAT.test(e.madde) && lower(plain(e.madde)) === q).map((e) => [lower(e.madde), e])).values()];
  if (hats.length !== 1) return own ? { kind: 'valid' } : { kind: 'none' };
  const h = hats[0];
  if (own) return { kind: 'ambiguous', text: lower(h.madde), meaning: shortMeaning(h.anlam), ownMeaning: shortMeaning(own.anlam) };
  return { kind: 'sure', text: lower(h.madde), meaning: shortMeaning(h.anlam) };
}

/** Önerinin büyük/küçük harfini yazılana uydurur */
export function matchCase(typed: string, suggestion: string): string {
  if (typed.length > 1 && typed === upper(typed)) return upper(suggestion);
  if (typed[0] && typed[0] === upper(typed[0]) && typed[0] !== lower(typed[0])) return upper(suggestion[0]) + suggestion.slice(1);
  return suggestion;
}

/* ---------- Ağ ve önbellek ---------- */

const CACHE_KEY = 'wtf.tdk.v2';
const cache = new Map<string, TdkResult>(
  (() => {
    try {
      localStorage.removeItem('wtf.tdk.v1');
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

type RawEntry = { madde?: string; madde_duz?: string; anlamlarListe?: { anlam?: string }[] };

export function lookup(word: string): Promise<TdkResult> {
  const q = lower(word);
  if (cache.has(q)) return Promise.resolve(cache.get(q)!);
  if (!tdkOnline()) return Promise.reject(new Error('offline'));
  const job = chain.then(async () => {
    if (cache.has(q)) return cache.get(q)!;
    try {
      const data = await fetchJson(`https://sozluk.gov.tr/gts?ara=${encodeURIComponent(q)}`);
      const res: TdkResult = Array.isArray(data)
        ? (data as RawEntry[]).map((e) => ({
            madde: String(e.madde ?? ''),
            madde_duz: e.madde_duz,
            anlam: shortMeaning(e.anlamlarListe?.[0]?.anlam),
          }))
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

/** Kelime TDK'da madde olarak var mı (önbellekten, eşzamanlı): true / false / undefined (bilinmiyor) */
export function knownInTdk(word: string): boolean | undefined {
  const q = lower(word);
  if (!cache.has(q)) return undefined;
  const r = cache.get(q);
  return !!r?.some((e) => lower(e.madde) === q);
}

/** Önbellekteki kesin kararlar (eşzamanlı, belgedeki işaretler için) */
const decided = new Map<string, TdkSuggestion | null>();
export function cachedSuggestion(word: string): TdkSuggestion | undefined {
  const v = decided.get(lower(word));
  return v ? { ...v, text: matchCase(word, v.text) } : undefined;
}

/**
 * Kelime için TDK önerisi. Çekimli kelimelerde kökü kısaltarak arar (en çok 6 harf ek);
 * anlam ayrımı yalnız kelimenin kendisi için yapılır (kökte yapılmaz).
 */
export async function suggestionFor(word: string): Promise<TdkSuggestion | null> {
  if (!eligible(word)) return null;
  const q = lower(word);
  if (decided.has(q)) {
    const v = decided.get(q)!;
    return v ? { ...v, text: matchCase(word, v.text) } : null;
  }
  let result: TdkSuggestion | null = null;
  const first = decide(q, await lookup(q));
  if (first.kind === 'sure') result = { text: first.text, ambiguous: false, meaning: first.meaning };
  else if (first.kind === 'ambiguous') result = { text: first.text, ambiguous: true, meaning: first.meaning, ownMeaning: first.ownMeaning };
  else if (first.kind === 'none') {
    for (let n = q.length - 1; n >= Math.max(3, q.length - 6); n--) {
      const stem = q.slice(0, n);
      if (!/[aiu]/.test(stem)) break;
      const d = decide(stem, await lookup(stem));
      if (d.kind === 'valid' || d.kind === 'ambiguous') break; // kök işaretsiz haliyle de geçerli: öneri yok
      if (d.kind === 'sure') {
        result = { text: d.text + q.slice(n), ambiguous: false, meaning: d.meaning };
        break;
      }
    }
  }
  decided.set(q, result);
  return result ? { ...result, text: matchCase(word, result.text) } : null;
}

/** Testler için */
export function _resetTdk(seed?: Record<string, TdkResult>) {
  cache.clear();
  decided.clear();
  offlineUntil = 0;
  for (const [k, v] of Object.entries(seed ?? {})) cache.set(k, v);
}
