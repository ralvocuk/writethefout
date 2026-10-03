/**
 * İçe aktarma: Fountain, Final Draft (.fdx), Highland (.highland), Fade In (.fadein), Celtx (.celtx).
 * Zip tabanlı biçimler fflate ile açılır; XML/HTML tarayıcının DOMParser'ı ile okunur.
 */
import { unzipSync, strFromU8 } from 'fflate';
import type { El } from '../script/elements';
import { line, textNodes, type JDoc, type JLine, type JMark } from '../script/json';
import { parseFountain, type TitleInfo } from './fountain';
import { t } from '../i18n';
import { parseFdx } from './fdx';

export const IMPORT_EXTENSIONS = ['fountain', 'spmd', 'txt', 'fdx', 'highland', 'fadein', 'celtx'];

export interface Imported {
  title: Partial<TitleInfo>;
  doc: JDoc;
  format: string;
}

function unzip(bytes: Uint8Array) {
  try {
    return unzipSync(bytes);
  } catch {
    throw new Error(t('Dosya açılamadı: zip arşivi bozuk ya da desteklenmeyen bir sürüm.'));
  }
}

/** Highland: zip içindeki Fountain/Markdown metni */
function parseHighland(bytes: Uint8Array): Imported {
  const files = unzip(bytes);
  const candidates = Object.entries(files)
    .filter(([name]) => /\.(fountain|markdown|md|txt)$/i.test(name) && !name.startsWith('__MACOSX'))
    .sort((a, b) => b[1].length - a[1].length);
  if (!candidates.length) throw new Error(t('Highland dosyasında senaryo metni bulunamadı.'));
  return { ...parseFountain(strFromU8(candidates[0][1])), format: 'Highland' };
}

const STYLE_MAP: Record<string, El> = {
  'scene heading': 'sceneHeading',
  sceneheading: 'sceneHeading',
  action: 'action',
  character: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  dialog: 'dialogue',
  transition: 'transition',
  shot: 'action',
  lyrics: 'lyrics',
  general: 'action',
};

/** Fade In: zip içinde Open Screenplay Format (document.xml) */
function parseFadeIn(bytes: Uint8Array): Imported {
  const files = unzip(bytes);
  const entry = Object.entries(files).find(([n]) => /document\.xml$/i.test(n));
  if (!entry) throw new Error(t('Fade In dosyasında document.xml bulunamadı.'));
  const dom = new DOMParser().parseFromString(strFromU8(entry[1]), 'application/xml');
  const out: JLine[] = [];
  for (const p of [...dom.getElementsByTagName('para')]) {
    const style = p.getElementsByTagName('style')[0];
    const base = (style?.getAttribute('basestyle') ?? style?.getAttribute('base') ?? 'Action').toLowerCase();
    const el = STYLE_MAP[base] ?? 'action';
    const nodes = [...p.getElementsByTagName('text')].flatMap((t) => {
      const marks: JMark[] = [];
      if (t.getAttribute('bold') === '1') marks.push({ type: 'bold' });
      if (t.getAttribute('italic') === '1') marks.push({ type: 'italic' });
      if (t.getAttribute('underline') === '1') marks.push({ type: 'underline' });
      return textNodes(t.textContent ?? '', marks);
    });
    out.push(line(el, nodes));
  }
  const title = dom.getElementsByTagName('titlepage')[0]?.textContent?.trim().split('\n')[0];
  return { title: { title }, doc: { type: 'doc', content: out }, format: 'Fade In' };
}

/** Celtx: zip içinde HTML senaryo (p.sceneheading, p.character…) */
function parseCeltx(bytes: Uint8Array): Imported {
  const files = unzip(bytes);
  const entry = Object.entries(files)
    .filter(([n]) => /script.*\.html?$/i.test(n) || /\.html?$/i.test(n))
    .sort((a, b) => b[1].length - a[1].length)[0];
  if (!entry) throw new Error(t('Celtx dosyasında senaryo bulunamadı.'));
  const dom = new DOMParser().parseFromString(strFromU8(entry[1]), 'text/html');
  const out: JLine[] = [];
  for (const p of [...dom.querySelectorAll('p')]) {
    const cls = (p.className || 'action').toLowerCase();
    const el = STYLE_MAP[cls] ?? 'action';
    const text = (p.textContent ?? '').replace(/ /g, ' ').trim();
    if (!text) continue;
    out.push(line(el, textNodes(text)));
  }
  return { title: {}, doc: { type: 'doc', content: out }, format: 'Celtx' };
}

export function importFile(name: string, bytes: Uint8Array): Imported {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'fdx') return { ...parseFdx(strFromU8(bytes)), format: 'Final Draft' };
  if (ext === 'highland') return parseHighland(bytes);
  if (ext === 'fadein') return parseFadeIn(bytes);
  if (ext === 'celtx') return parseCeltx(bytes);
  return { ...parseFountain(strFromU8(bytes)), format: 'Fountain' };
}
