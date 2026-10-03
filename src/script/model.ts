/** Senaryo belgesinden türetilen yapı: sahneler, bölümler, karakterler, istatistikler. */
import { blockText, blocksFromJson, type ScriptBlock } from './blocks';
import { baseName, countWords, upperTr, type TagCat } from './elements';
import { numberScenes, paginate, sceneSpans, type Paper } from '../export/layout';

export interface SceneInfo {
  sid: string;
  /** başlık bloğunun belgedeki sırası */
  idx: number;
  /** sahnenin bittiği blok (hariç) */
  end: number;
  number: string;
  heading: string;
  intExt: string;
  location: string;
  time: string;
  section: string | null;
  page: number;
  eighths: number;
  characters: string[];
  words: number;
  notes: string[];
  tags: { cat: TagCat; text: string }[];
}

export interface CharacterInfo {
  name: string;
  lines: number;
  words: number;
  scenes: string[];
  firstScene: string | null;
}

export interface ScriptModel {
  blocks: ScriptBlock[];
  scenes: SceneInfo[];
  sections: { idx: number; title: string }[];
  characters: CharacterInfo[];
  pages: number;
  words: number;
  dialogueWords: number;
  actionWords: number;
}

const HEAD = /^(İÇ\/DIŞ|DIŞ\/İÇ|İÇ|DIŞ|INT\.?\/EXT|EXT\.?\/INT|INT|EXT|I\/E|EST)\.?\s*(.*)$/u;

export function parseHeading(h: string): { intExt: string; location: string; time: string } {
  const u = upperTr(h.trim());
  const m = u.match(HEAD) ?? h.toUpperCase().trim().match(HEAD);
  const rest = m ? m[2] : u;
  const dash = rest.lastIndexOf(' - ');
  const ie = m ? m[1].replace(/\.$/, '') : '';
  return {
    intExt: ie === 'INT' ? 'İÇ' : ie === 'EXT' ? 'DIŞ' : ie.startsWith('INT') || ie === 'I/E' || ie.startsWith('EXT/') ? 'İÇ/DIŞ' : ie,
    location: (dash >= 0 ? rest.slice(0, dash) : rest).trim(),
    time: dash >= 0 ? rest.slice(dash + 3).trim() : '',
  };
}

export function buildModel(json: string | object | null, paper: Paper = 'a4'): ScriptModel {
  const blocks = numberScenes(blocksFromJson(json));
  const pages = paginate(blocks, { paper, lang: 'tr', sceneNumbers: false, headingSpace: 2 });
  const spans = new Map(sceneSpans(pages, paper).map((s) => [s.sid, s]));

  const scenes: SceneInfo[] = [];
  const sections: { idx: number; title: string }[] = [];
  const chars = new Map<string, CharacterInfo>();
  let section: string | null = null;
  let current: SceneInfo | null = null;
  let speaker: string | null = null;
  let words = 0;
  let dialogueWords = 0;
  let actionWords = 0;

  const close = (idx: number) => {
    if (current) current.end = idx;
    current = null;
  };

  blocks.forEach((b, idx) => {
    const t = blockText(b);
    const w = countWords(t);
    if (b.el !== 'section') words += w;
    if (b.el === 'section') {
      close(idx);
      section = t.replace(/^#+\s*/, '').trim() || 'Bölüm';
      sections.push({ idx, title: section });
      return;
    }
    if (b.el === 'sceneHeading') {
      close(idx);
      const sid = b.sid ?? `h${idx}`;
      const span = spans.get(sid);
      const p = parseHeading(t);
      current = {
        sid,
        idx,
        end: blocks.length,
        number: b.sceneNo ?? '',
        heading: upperTr(t.trim()),
        ...p,
        section,
        page: span?.page ?? 1,
        eighths: span?.eighths ?? 1,
        characters: [],
        words: 0,
        notes: [],
        tags: [],
      };
      scenes.push(current);
      speaker = null;
      if (b.notes) current.notes.push(...b.notes);
      if (b.tags) current.tags.push(...b.tags);
      return;
    }
    const sc = current as SceneInfo | null;
    if (sc) {
      sc.words += w;
      if (b.notes) sc.notes.push(...b.notes);
      if (b.tags) sc.tags.push(...b.tags);
    }
    if (b.el === 'character') {
      speaker = baseName(t);
      if (!speaker) return;
      const c = chars.get(speaker) ?? { name: speaker, lines: 0, words: 0, scenes: [], firstScene: sc?.sid ?? null };
      c.lines++;
      if (sc && !c.scenes.includes(sc.sid)) c.scenes.push(sc.sid);
      if (sc && !sc.characters.includes(speaker)) sc.characters.push(speaker);
      chars.set(speaker, c);
      return;
    }
    if ((b.el === 'dialogue' || b.el === 'lyrics') && speaker) {
      const c = chars.get(speaker);
      if (c) c.words += w;
      dialogueWords += w;
      return;
    }
    if (b.el !== 'parenthetical') speaker = null;
    if (b.el === 'action') actionWords += w;
  });

  return {
    blocks,
    scenes,
    sections,
    characters: [...chars.values()].sort((a, b) => b.lines - a.lines || a.name.localeCompare(b.name, 'tr')),
    pages: pages.length,
    words,
    dialogueWords,
    actionWords,
  };
}

/* ---------- Sahne taşıma ---------- */

interface JsonDoc {
  type: 'doc';
  content: { type: string; attrs?: Record<string, unknown> }[];
}

/** sid sahnesini (başlıktan bir sonraki başlık/bölüme kadar) beforeSid sahnesinin önüne taşır; null = sona. */
export function moveScene(doc: JsonDoc, sid: string, beforeSid: string | null): JsonDoc {
  const lines = doc.content;
  const isHead = (l: JsonDoc['content'][number]) => l.attrs?.el === 'sceneHeading';
  const isBound = (l: JsonDoc['content'][number]) => isHead(l) || l.attrs?.el === 'section';
  const start = lines.findIndex((l) => isHead(l) && l.attrs?.sid === sid);
  if (start < 0 || sid === beforeSid) return doc;
  let end = start + 1;
  while (end < lines.length && !isBound(lines[end])) end++;
  const chunk = lines.slice(start, end);
  const rest = [...lines.slice(0, start), ...lines.slice(end)];
  let at = beforeSid ? rest.findIndex((l) => isHead(l) && l.attrs?.sid === beforeSid) : rest.length;
  if (at < 0) at = rest.length;
  return { ...doc, content: [...rest.slice(0, at), ...chunk, ...rest.slice(at)] };
}

/** Bir sahneyi bir bölümün sonuna taşı (bölüm başlığı sırası verilir) */
export function moveSceneToSection(doc: JsonDoc, sid: string, sectionIdx: number | null): JsonDoc {
  const lines = doc.content;
  const start = lines.findIndex((l) => l.attrs?.el === 'sceneHeading' && l.attrs?.sid === sid);
  if (start < 0) return doc;
  let end = start + 1;
  while (end < lines.length && lines[end].attrs?.el !== 'sceneHeading' && lines[end].attrs?.el !== 'section') end++;
  const chunk = lines.slice(start, end);
  const rest = [...lines.slice(0, start), ...lines.slice(end)];
  // hedef bölümün bittiği yer: sonraki bölümün başı
  const sectionLine = sectionIdx === null ? null : lines[sectionIdx];
  let at = rest.length;
  if (sectionLine) {
    const sIdx = rest.indexOf(sectionLine);
    at = rest.findIndex((l, i) => i > sIdx && l.attrs?.el === 'section');
    if (at < 0) at = rest.length;
  }
  return { ...doc, content: [...rest.slice(0, at), ...chunk, ...rest.slice(at)] };
}
