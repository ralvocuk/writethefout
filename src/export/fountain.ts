/**
 * Fountain (fountain.io) yazma ve okuma.
 *
 * İki kip:
 *  - dışa aktarma: başkalarının okuması için; sahne başlığı, karakter, geçiş büyük harfe çevrilir.
 *  - yerel (native): writetheFout.'un kendi dosya biçimi; metin harfi harfine korunur,
 *    gerektiğinde Fountain'ın zorlama işaretleri (. @ > !) kullanılır, böylece gidiş-dönüş kayıpsızdır.
 *
 * Desteklenenler: notlar [[ ]], kapalı metin /* *\/, çift diyalog ^, ortalı > <, şarkı ~, bölüm #,
 * özet =, sahne numarası #12#, sayfa sonu ===, vurgu * ** *** _, element içi boş satır (iki boşluk).
 */
import type { El } from '../script/elements';
import { line, lineText, normalizeDoc, textNodes, type JDoc, type JLine, type JMark, type JText } from '../script/json';
import { upper, type Lang } from './layout';

export interface TitleInfo {
  title: string;
  author: string;
  contact: string;
  credit?: string;
  source?: string;
  draftDate?: string;
  notes?: string;
  copyright?: string;
}

export interface FountainOptions {
  /** writetheFout. dosya kipi: harf ve boşluk korunur */
  native?: boolean;
  /** sahne başlığı sırasına göre özetler (= satırları) */
  synopses?: (string | undefined)[];
}

const EN_HEADING = /^(INT|EXT|EST|INT\.?\/EXT|I\/E)[.\s]/i;
const ANY_HEADING = /^(İÇ\/DIŞ|DIŞ\/İÇ|İÇ|DIŞ|INT\.?\/EXT|EXT\.?\/INT|INT|EXT|EST|I\/E)[.\s]/iu;
const CAPS: El[] = ['sceneHeading', 'character', 'transition'];
const ASCII_CAPS = /^[A-Z][A-Z0-9 .'\-]*$/;
const isAllCaps = (s: string) => /\p{L}/u.test(s) && (s === s.toLocaleUpperCase('tr-TR') || s === s.toUpperCase());

function inlineToFountain(content: JText[], caps: boolean, lang: Lang, native: boolean): string {
  let out = '';
  for (const c of content) {
    if (c.type === 'hardBreak') {
      out += '\n';
      continue;
    }
    let t = c.text ?? '';
    const m = new Set((c.marks ?? []).map((x) => x.type));
    if (m.has('note')) {
      out += `[[${native ? t : t.trim()}]]`;
      continue;
    }
    if (caps && !native) t = upper(t, lang);
    t = t.replace(/([*_\\])/g, '\\$1');
    if (t.trim()) {
      if (m.has('bold') && m.has('italic')) t = `***${t}***`;
      else if (m.has('bold')) t = `**${t}**`;
      else if (m.has('italic')) t = `*${t}*`;
      if (m.has('underline')) t = `_${t}_`;
    }
    if (m.has('omit')) t = `/*${t}*/`;
    out += t;
  }
  return out;
}

/** Element içindeki boş satırları Fountain'ın "iki boşluk" kuralıyla korur */
const keepBlank = (s: string) => s.split('\n').map((x) => (x === '' ? '  ' : x)).join('\n');

export function toFountain(doc: JDoc, title: TitleInfo | null, lang: Lang, opts: FountainOptions = {}): string {
  const native = !!opts.native;
  const out: string[] = [];
  if (title && (title.title || title.author)) {
    const multi = (k: string, v: string) => (v.includes('\n') ? `${k}:\n${v.split('\n').map((l) => `    ${l}`).join('\n')}` : `${k}: ${v}`);
    if (title.title) out.push(multi('Title', title.title));
    out.push(`Credit: ${title.credit || (lang === 'tr' ? 'Yazan' : 'Written by')}`);
    if (title.author) out.push(multi('Author', title.author));
    if (title.source) out.push(multi('Source', title.source));
    if (title.draftDate) out.push(`Draft date: ${title.draftDate}`);
    if (title.contact) out.push(multi('Contact', title.contact));
    if (title.notes) out.push(multi('Notes', title.notes));
    if (title.copyright) out.push(multi('Copyright', title.copyright));
    out.push('');
  }
  let prev: El | null = null;
  let headingIdx = -1;
  for (const l of normalizeDoc(doc).content) {
    const el = l.attrs.el;
    const raw = lineText(l);
    if (!raw.trim() && el !== 'pageBreak') continue;
    const text = keepBlank(inlineToFountain(l.content, CAPS.includes(el), lang, native));
    const tight =
      (el === 'dialogue' || el === 'parenthetical' || el === 'lyrics') &&
      (prev === 'character' || prev === 'dialogue' || prev === 'parenthetical' || prev === 'lyrics');
    if (!tight && out.length && out.at(-1) !== '') out.push('');
    switch (el) {
      case 'sceneHeading': {
        headingIdx++;
        const h = native ? text : text.trim();
        out.push((EN_HEADING.test(h) && isAllCaps(h) ? h : `.${h}`) + (l.attrs.num ? ` #${l.attrs.num}#` : ''));
        const syn = opts.synopses?.[headingIdx];
        if (syn?.trim()) {
          out.push('');
          for (const s of syn.split('\n')) if (s.trim()) out.push(`= ${s.trim()}`);
        }
        break;
      }
      case 'character': {
        const c = native ? text : text.trim();
        // yalnızca ASCII büyük harf adlar zorlamasız yazılır; Türkçe harfli adları birçok okuyucu tanımaz
        out.push((ASCII_CAPS.test(c.replace(/\(.*\)/, '').trim()) ? c : `@${c}`) + (l.attrs.dual ? ' ^' : ''));
        break;
      }
      case 'transition': {
        const t = native ? text : text.trim();
        out.push(isAllCaps(t) && /TO:$/.test(t) ? t : `> ${t}`);
        break;
      }
      case 'parenthetical': {
        const p = native ? text : text.trim();
        out.push(p.startsWith('(') ? p : `(${p})`);
        break;
      }
      case 'centered':
        out.push(`> ${text.trim()} <`);
        break;
      case 'lyrics':
        out.push(text.split('\n').map((x) => `~${x}`).join('\n'));
        break;
      case 'section':
        out.push(`# ${text.trim()}`);
        break;
      case 'pageBreak':
        out.push('===');
        break;
      case 'action': {
        // aksiyon başka bir element sanılmasın
        const first = raw.split('\n')[0];
        const risky =
          (isAllCaps(first) && !raw.includes('\n')) ||
          ANY_HEADING.test(first) ||
          /^[.>#=~@!]/.test(first) ||
          /^\s*={3,}\s*$/.test(first);
        out.push(risky ? `!${text}` : text);
        break;
      }
      default:
        out.push(text);
    }
    prev = el;
  }
  return out.join('\n') + '\n';
}

/* ---------- Okuma ---------- */

/** Satır içi işaretleri ayrıştırır; kapalı metin satırlar arasında sürebilir. */
function parseInline(s: string, state: { omit: boolean }): JText[] {
  const out: JText[] = [];
  let buf = '';
  const marks: Record<string, boolean> = { bold: false, italic: false, underline: false };
  const flush = (extra: JMark[] = []) => {
    if (!buf) return;
    const ms: JMark[] = [...extra];
    if (state.omit) ms.push({ type: 'omit' });
    for (const k of ['bold', 'italic', 'underline']) if (marks[k]) ms.push({ type: k });
    out.push(...textNodes(buf, ms));
    buf = '';
  };
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    if (rest.startsWith('\\') && i + 1 < s.length) {
      buf += s[i + 1];
      i += 2;
      continue;
    }
    if (rest.startsWith('[[')) {
      const end = s.indexOf(']]', i + 2);
      if (end !== -1) {
        flush();
        buf = s.slice(i + 2, end);
        flush([{ type: 'note' }]);
        i = end + 2;
        continue;
      }
    }
    if (rest.startsWith('/*')) {
      flush();
      state.omit = true;
      i += 2;
      continue;
    }
    if (rest.startsWith('*/') && state.omit) {
      flush();
      state.omit = false;
      i += 2;
      continue;
    }
    if (rest.startsWith('***')) {
      flush();
      marks.bold = !marks.bold;
      marks.italic = !marks.italic;
      i += 3;
      continue;
    }
    if (rest.startsWith('**')) {
      flush();
      marks.bold = !marks.bold;
      i += 2;
      continue;
    }
    if (s[i] === '*' && (marks.italic || s.indexOf('*', i + 1) !== -1)) {
      flush();
      marks.italic = !marks.italic;
      i += 1;
      continue;
    }
    if (s[i] === '_' && (marks.underline || s.indexOf('_', i + 1) !== -1)) {
      flush();
      marks.underline = !marks.underline;
      i += 1;
      continue;
    }
    buf += s[i];
    i++;
  }
  flush();
  return out;
}

export interface ParsedScript {
  title: Partial<TitleInfo>;
  doc: JDoc;
  /** sahne başlığı sırasına göre = özetleri */
  synopses: (string | undefined)[];
}

const TITLE_KEYS: Record<string, keyof TitleInfo> = {
  title: 'title',
  author: 'author',
  authors: 'author',
  credit: 'credit',
  source: 'source',
  'draft date': 'draftDate',
  date: 'draftDate',
  contact: 'contact',
  notes: 'notes',
  copyright: 'copyright',
};

export function parseFountain(src: string): ParsedScript {
  let text = src.replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const title: Partial<TitleInfo> = {};

  // Başlık sayfası: ilk boş satıra kadar "Anahtar: değer" (girintili satırlar önceki anahtarın devamı)
  const firstBlank = text.search(/\n[ \t]*\n/);
  const head = firstBlank === -1 ? text : text.slice(0, firstBlank);
  if (/^[A-Za-z ]+:/.test(head)) {
    let key: keyof TitleInfo | null = null;
    for (const ln of head.split('\n')) {
      const m = ln.match(/^([A-Za-z ]+):\s*(.*)$/);
      if (m) key = TITLE_KEYS[m[1].toLowerCase().trim()] ?? null;
      const val = (m ? m[2] : ln).trim();
      if (!val || !key) continue;
      const sep = key === 'author' ? ', ' : '\n';
      title[key] = title[key] ? `${title[key]}${sep}${val}` : val;
    }
    text = firstBlank === -1 ? '' : text.slice(firstBlank).replace(/^[ \t]*\n/, '');
  }
  text = text.replace(/\[\[([\s\S]*?)\]\]/g, (_m, n: string) => `[[${n.replace(/\n+/g, ' ')}]]`);

  const lines = text.split('\n');
  const out: JLine[] = [];
  const synopses: (string | undefined)[] = [];
  const state = { omit: false };
  const push = (el: El, s: string, attrs: Partial<JLine['attrs']> = {}) => out.push(line(el, parseInline(s, state), attrs));
  const appendTo = (l: JLine, s: string) => l.content.push({ type: 'hardBreak' }, ...parseInline(s, state));
  const blank = (s: string | undefined) => s === undefined || (s.trim() === '' && s !== '  ');
  let inDialogue = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    const prevBlank = i === 0 || blank(lines[i - 1]);
    const nextLine = lines[i + 1];
    const nextBlank = blank(nextLine);
    const last = out.at(-1);

    // iki boşluk: element içi boş satır
    if (raw === '  ' && last && !prevBlank) {
      if (last.attrs.el === 'action' || last.attrs.el === 'dialogue' || last.attrs.el === 'lyrics') last.content.push({ type: 'hardBreak' });
      continue;
    }
    if (t === '') {
      inDialogue = false;
      continue;
    }
    if (/^={3,}$/.test(t)) {
      push('pageBreak', '');
      continue;
    }
    if (/^=(?!=)/.test(t)) {
      const h = out.filter((l) => l.attrs.el === 'sceneHeading').length - 1;
      if (h >= 0) synopses[h] = [synopses[h], t.replace(/^=\s*/, '')].filter(Boolean).join('\n');
      continue;
    }
    if (/^#+/.test(t) && !inDialogue) {
      push('section', t.replace(/^#+\s*/, ''));
      continue;
    }

    if (inDialogue) {
      if (/^\(.*\)$/.test(t)) push('parenthetical', t);
      else if (t.startsWith('~')) push('lyrics', raw.replace(/^\s*~/, ''));
      else if (last && last.attrs.el === 'dialogue' && !prevBlank) appendTo(last, raw.replace(/^\s+/, ''));
      else push('dialogue', raw.replace(/^\s+/, ''));
      continue;
    }

    if (raw.startsWith('!')) {
      push('action', raw.slice(1));
      continue;
    }
    if (t.startsWith('~')) {
      if (last && last.attrs.el === 'lyrics' && !prevBlank) appendTo(last, raw.replace(/^\s*~/, ''));
      else push('lyrics', raw.replace(/^\s*~/, ''));
      continue;
    }
    const numMatch = t.match(/\s*#([\w.\-]+)#\s*$/);
    const stripNum = (s: string) => s.replace(/\s*#[\w.\-]+#\s*$/, '');
    if (raw.startsWith('.') && !raw.startsWith('..')) {
      push('sceneHeading', stripNum(raw.slice(1)), numMatch ? { num: numMatch[1] } : {});
      continue;
    }
    if (prevBlank && ANY_HEADING.test(t)) {
      push('sceneHeading', stripNum(t), numMatch ? { num: numMatch[1] } : {});
      continue;
    }
    if (t.startsWith('>') && t.endsWith('<')) {
      push('centered', t.slice(1, -1).trim());
      continue;
    }
    if (t.startsWith('>')) {
      push('transition', t.slice(1).replace(/^ /, ''));
      continue;
    }
    if (prevBlank && nextBlank && isAllCaps(t) && /TO:$/.test(t)) {
      push('transition', t);
      continue;
    }
    const dual = /\^\s*$/.test(t);
    const name = raw.replace(/\s*\^\s*$/, '');
    if (raw.startsWith('@')) {
      push('character', name.slice(1), dual ? { dual: true } : {});
      inDialogue = !nextBlank;
      continue;
    }
    if (prevBlank && !nextBlank && isAllCaps(name.replace(/\(.*\)$/, '')) && !/^[\d\W]+$/.test(name.trim())) {
      push('character', name.trim(), dual ? { dual: true } : {});
      inDialogue = true;
      continue;
    }
    if (last && last.attrs.el === 'action' && !prevBlank) appendTo(last, raw);
    else push('action', raw);
  }
  return { title, doc: { type: 'doc', content: out }, synopses };
}
