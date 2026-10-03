// Çeviri dosyalarını denetler: eksik/fazla anahtar, yer tutucu uyumu, çoğul biçimi.
// Kullanım: node scripts/i18n-check.mjs [en de es fr]
import { readFileSync } from 'node:fs';
const keys = JSON.parse(readFileSync('src/i18n/keys.json', 'utf8'));
const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'de', 'es', 'fr'];
let bad = 0;
const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
for (const l of langs) {
  const cat = JSON.parse(readFileSync(`src/i18n/locales/${l}.json`, 'utf8'));
  const missing = keys.filter((k) => !(k in cat) || !String(cat[k]).trim());
  const extra = Object.keys(cat).filter((k) => !keys.includes(k));
  const phErr = keys.filter((k) => k in cat).filter((k) => {
    const v = String(cat[k]);
    return v.split('|').some((part) => ph(part) !== ph(k));
  });
  const pipeErr = keys.filter((k) => k in cat && String(cat[k]).includes('|') && !/\{n\}/.test(k));
  const report = { missing: missing.length, extra: extra.length, placeholders: phErr.length, pluralWithoutN: pipeErr.length };
  console.log(l, JSON.stringify(report));
  for (const k of [...missing.slice(0, 15)]) console.log('  eksik:', k);
  for (const k of [...extra.slice(0, 10)]) console.log('  fazla:', k);
  for (const k of phErr.slice(0, 15)) console.log('  yer tutucu:', k, '→', cat[k]);
  for (const k of pipeErr.slice(0, 10)) console.log('  çoğul ({n} yok):', k, '→', cat[k]);
  bad += missing.length + extra.length + phErr.length + pipeErr.length;
}
process.exit(bad ? 1 : 0);
