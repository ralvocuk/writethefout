/**
 * Yazım denetimi çekirdeği (nspell + Hunspell sözlükleri: Türkçe, İngilizce, İspanyolca).
 * Saf fonksiyonlar: hem web worker'da hem testlerde kullanılır. Dil `setSpellLang` ile seçilir.
 */
export interface Speller {
  correct(word: string): boolean;
  suggest(word: string): string[];
}

export type SpellLang = 'tr' | 'en' | 'es';
export const SPELL_LANGS: SpellLang[] = ['tr', 'en', 'es'];

const LOCALES: Record<SpellLang, string> = { tr: 'tr-TR', en: 'en-US', es: 'es-ES' };
/** klavyede eksik kalan harfler: "cok" → "çok", "cancion" → "canción" */
const SWAP_SETS: Record<SpellLang, Record<string, string>> = {
  tr: { c: 'ç', ç: 'c', g: 'ğ', ğ: 'g', i: 'ı', ı: 'i', o: 'ö', ö: 'o', s: 'ş', ş: 's', u: 'ü', ü: 'u' },
  en: {},
  es: { a: 'á', á: 'a', e: 'é', é: 'e', i: 'í', í: 'i', o: 'ó', ó: 'o', u: 'ú', ú: 'u', n: 'ñ', ñ: 'n' },
};
let LOC = LOCALES.tr;
let SWAPS = SWAP_SETS.tr;
let LANG: SpellLang = 'tr';
export function setSpellLang(lang: SpellLang) {
  LANG = lang;
  LOC = LOCALES[lang];
  SWAPS = SWAP_SETS[lang];
}

const lowerTr = (s: string) => s.toLocaleLowerCase(LOC);
const upperTr = (s: string) => s.toLocaleUpperCase(LOC);
const capTr = (s: string) => (s ? upperTr(s[0]) + s.slice(1) : s);

const isCaps = (w: string) => w.length > 1 && w === upperTr(w) && w !== lowerTr(w);
const isCap = (w: string) => !!w && w[0] === upperTr(w[0]) && w[0] !== lowerTr(w[0]);

/** Kesme işareti biçimlerini tekleştir */
export const normalizeWord = (w: string) => w.replace(/[’‘`]/g, "'");

/** Sözlükte doğrudan, küçük harfle ya da baş harfi büyük (özel ad) olarak var mı */
function known(sp: Speller, w: string): boolean {
  if (sp.correct(w)) return true;
  // şapkalı yazımlar (rüzgâr, kâğıt): sözlükte çoğu şapkasız
  if (LANG === 'tr' && /[âîûÂÎÛ]/.test(w)) {
    const plain = w.replace(/[âÂ]/g, (c) => (c === 'â' ? 'a' : 'A')).replace(/[îÎ]/g, (c) => (c === 'î' ? 'i' : 'İ')).replace(/[ûÛ]/g, (c) => (c === 'û' ? 'u' : 'U'));
    if (known(sp, plain)) return true;
  }
  const lo = lowerTr(w);
  if (lo !== w && sp.correct(lo)) return true;
  const cap = capTr(lo);
  return cap !== w && sp.correct(cap);
}

export function checkWord(sp: Speller, raw: string): boolean {
  const w = normalizeWord(raw).replace(/^'+|'+$/g, '');
  if (w.length < 2) return true;
  if (/\d/.test(w)) return true;
  if (known(sp, w)) return true;
  // Özel ad + ek: "Hikmet'in", "NERMİN'İN" → kesmeden önceki kısım
  const ap = w.indexOf("'");
  if (ap > 0) {
    const base = w.slice(0, ap);
    if (base.length < 2 || known(sp, base)) return true;
    // Türkçede kesme yalnız özel addan sonra gelir: büyük harfli kök + kesme = özel ad (Danny'nin, DANNY'NİN);
    // İngilizcede de iyelik ('s) özel adlarda sık
    if (isCap(base)) return true;
  }
  // tire ile birleşik yazımlar: her parçası doğruysa doğru
  if (w.includes('-')) return w.split('-').every((p) => !p || checkWord(sp, p));
  return false;
}

/** Türkçe klavyesiz yazımlar: "cok" → "çok", "degil" → "değil" */
function diacriticVariants(sp: Speller, lo: string): string[] {
  const idx: number[] = [];
  for (let i = 0; i < lo.length; i++) if (SWAPS[lo[i]]) idx.push(i);
  if (!idx.length || idx.length > 7 || lo.length > 16) return [];
  const out: string[] = [];
  const total = 1 << idx.length;
  for (let mask = 1; mask < total && out.length < 4; mask++) {
    const chars = lo.split('');
    for (let b = 0; b < idx.length; b++) if (mask & (1 << b)) chars[idx[b]] = SWAPS[chars[idx[b]]];
    const v = chars.join('');
    if (known(sp, v)) out.push(sp.correct(v) ? v : capTr(v));
  }
  return out;
}

/** Yazılan biçime uygun büyük/küçük harfle öneriler */
export function suggestWord(sp: Speller, raw: string, limit = 7): string[] {
  const w = normalizeWord(raw);
  const caps = isCaps(w);
  const cap = !caps && isCap(w);
  const lo = lowerTr(w);
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (s: string) => {
    const k = lowerTr(s);
    if (!s || seen.has(k) || k === lo) return;
    seen.add(k);
    out.push(s);
  };
  for (const v of diacriticVariants(sp, lo)) add(v);
  for (const s of sp.suggest(lo)) {
    // nspell bazen dile uymayan büyük harf biçimleri döndürür (GIDIYORUM): ele
    if (s.length > 1 && s === s.toUpperCase() && s !== s.toLowerCase()) continue;
    add(s);
  }
  if (cap || caps) for (const s of sp.suggest(capTr(lo))) if (!(s.length > 1 && s === s.toUpperCase())) add(s);
  return out.slice(0, limit).map((s) => (caps ? upperTr(s) : cap ? capTr(s) : s));
}

/** Metindeki kelimeler (konumlarıyla) */
export const WORD_RE = /[\p{L}][\p{L}\p{M}'’-]*[\p{L}\p{M}]|[\p{L}]/gu;
