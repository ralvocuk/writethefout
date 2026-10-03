// Çeviri kataloğunun anahtarlarını (Türkçe kaynak metinler) koddan çıkarır.
// Kullanım: node scripts/i18n-extract.mjs  → src/i18n/keys.json
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !p.includes('i18n')) files.push(p);
  }
};
walk('src');

const keys = new Set();
const unq = (q, s) => (q === "'" ? s.replace(/\\'/g, "'") : q === '"' ? s.replace(/\\"/g, '"') : s);
const lit = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  // t('...') çağrıları
  for (const m of src.matchAll(/\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) keys.add(unq(m[1], m[2]));
  // dolaylı çevrilen metinler: bu dosyalardaki tablolar
  const indirect = [
    [/components\/Chrome\.tsx$/, /label: '([^']+)'/g],
    [/components\/Dialogs\.tsx$/, /desc: '([^']+)'/g],
    [/components\/Dialogs\.tsx$/, /field\('\w+', '([^']+)', '([^']+)'/g],
    [/components\/(Stats|Characters)\.tsx$/, /label="([^"]+)"/g],
    [/script\/elements\.ts$/, /name: '([^']+)'/g],
    [/data\/types\.ts$/, /(?:draft|revised|done): '([^']+)'/g],
  ];
  for (const [fre, re] of indirect) if (fre.test(f.replace(/\\/g, '/'))) for (const m of src.matchAll(re)) for (const g of m.slice(1)) if (g) keys.add(g);
  if (/editor\/screenplay\.ts$/.test(f)) {
    const i = src.indexOf('SCREENPLAY_PLACEHOLDER');
    const block = src.slice(i, src.indexOf('};', i));
    for (const m of block.matchAll(/: '([^']+)'/g)) keys.add(m[1]);
  }
  if (/script\/elements\.ts$/.test(f)) {
    const block = src.slice(src.indexOf('EL_LABEL'), src.indexOf('});', src.indexOf('EL_LABEL')));
    for (const m of block.matchAll(/: '([^']+)'/g)) keys.add(m[1]);
  }
}
for (const k of ['İÇ', 'DIŞ', 'İÇ/DIŞ', 'Dosya', 'Düzen', 'Görünüm', 'Senaryo', 'Revizyon', 'Yardım', 'Eleman']) keys.add(k);
const out = [...keys].filter((k) => k && !/^[\s\W\d]*$/.test(k) && !k.includes('${')).sort((a, b) => a.localeCompare(b, 'tr'));
writeFileSync('src/i18n/keys.json', JSON.stringify(out, null, 1) + '\n');
console.log(out.length, 'anahtar');
