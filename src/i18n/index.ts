/**
 * Arayüz çevirileri. Kaynak dil Türkçedir: metinler koda Türkçe yazılır, t() ile sarılır,
 * diğer diller `locales/<dil>.json` içinde "Türkçe kaynak → çeviri" eşlemesi olarak durur.
 * Eksik çeviri Türkçe kaynağa düşer.
 *
 * Yer tutucular: t('{n} sahne', { n: 3 }). Sayılar seçili dilin biçimiyle yazılır.
 * Çoğul: çeviride "tekil|çoğul" (ör. "{n} scene|{n} scenes"); `n` değişkenine göre seçilir.
 */
import { create } from 'zustand';
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

export type UiLang = 'tr' | 'en' | 'de' | 'es' | 'fr';

export const UI_LANGS: { id: UiLang; name: string; locale: string }[] = [
  { id: 'tr', name: 'Türkçe', locale: 'tr-TR' },
  { id: 'en', name: 'English', locale: 'en-US' },
  { id: 'de', name: 'Deutsch', locale: 'de-DE' },
  { id: 'es', name: 'Español', locale: 'es-ES' },
  { id: 'fr', name: 'Français', locale: 'fr-FR' },
];

const CATALOGS: Record<UiLang, Record<string, string>> = { tr: {}, en, de, es, fr };
const KEY = 'wtf.uiLang';

function initial(): UiLang {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (UI_LANGS.some((l) => l.id === v)) return v;
  } catch {
    /* yok say */
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : 'tr').slice(0, 2).toLowerCase();
  return (UI_LANGS.find((l) => l.id === nav)?.id ?? 'tr') as UiLang;
}

export const useLang = create<{ lang: UiLang }>(() => ({ lang: initial() }));

let current: UiLang = useLang.getState().lang;
useLang.subscribe((s) => {
  current = s.lang;
  if (typeof document !== 'undefined') document.documentElement.lang = s.lang;
});
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const uiLang = () => current;
export const locale = () => UI_LANGS.find((l) => l.id === current)!.locale;

export function setUiLang(lang: UiLang) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lang));
  } catch {
    /* yok say */
  }
  useLang.setState({ lang });
}

const plurals = new Map<string, Intl.PluralRules>();
function pluralOf(n: number) {
  const loc = locale();
  let p = plurals.get(loc);
  if (!p) plurals.set(loc, (p = new Intl.PluralRules(loc)));
  return p.select(n);
}

export const fmtNum = (n: number) => n.toLocaleString(locale());

/** Çeviri */
export function t(src: string, vars?: Record<string, string | number | null | undefined>): string {
  let s = current === 'tr' ? src : (CATALOGS[current][src] ?? src);
  if (s.includes('|') && vars && typeof vars.n === 'number') {
    const [one, other] = s.split('|');
    s = pluralOf(vars.n) === 'one' ? one : (other ?? one);
  }
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => {
    const v = vars[k];
    if (v === undefined || v === null) return m === '{' + k + '}' ? '' : m;
    return typeof v === 'number' ? fmtNum(v) : v;
  });
}

/** Kayıt değerlerini okurken çeviren görünüm: EL_LABEL[el] gibi kullanımlar kendiliğinden çevrilir */
export function translated<T extends Record<string, string>>(raw: T): T {
  return new Proxy(raw, {
    get: (o, k) => (typeof k === 'string' && k in o ? t(o[k as keyof T] as string) : Reflect.get(o, k)),
  });
}

/** Tarih biçimi (seçili dilde) */
export const fmtDate = (d: Date | number, o: Intl.DateTimeFormatOptions) => new Date(d).toLocaleString(locale(), o);
