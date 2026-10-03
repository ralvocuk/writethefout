/**
 * Editör belgesi (ProseMirror JSON veya canlı düğüm) → basılacak bloklar.
 * Notlar [[ ]] ve kapalı metin /* *\/ basılmaz; etiketler yalnız döküm içindir.
 */
import type { Node as PMNode } from '@tiptap/pm/model';
import type { El, TagCat } from './elements';

export interface Run {
  text: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  /** revizyon kuşağı (1–8) */
  rev?: number;
}

export interface ScriptBlock {
  el: El;
  runs: Run[];
  sid?: string;
  /** kilitli sahne numarası */
  num?: string;
  /** hesaplanmış sahne numarası */
  sceneNo?: string;
  dual?: boolean;
  /** belgedeki sıra (0'dan) */
  idx?: number;
  /** tamamen silinmeye aday satırın revizyon kuşağı (yıldız komşu satıra düşer) */
  delGen?: number;
  /** basılı karakter sırası → blok içi konum (UTF-16) */
  map?: number[];
  notes?: string[];
  tags?: { cat: TagCat; text: string }[];
}

interface Inline {
  kind: 'text' | 'break';
  text: string;
  marks: { type: string; attrs?: Record<string, unknown> }[];
}

function build(el: El, attrs: Record<string, unknown>, items: Inline[], idx: number): ScriptBlock {
  const runs: Run[] = [];
  const map: number[] = [];
  const notes: string[] = [];
  const tags: { cat: TagCat; text: string }[] = [];
  let offset = 0;
  /** silinen metnin revizyon kuşağı: bir sonraki basılı parçaya (ya da öncekine) yıldız olarak taşınır */
  let pendingDel = 0;
  for (const it of items) {
    if (it.kind === 'break') {
      runs.push({ text: '\n' });
      map.push(offset);
      offset += 1;
      continue;
    }
    const types = new Set(it.marks.map((m) => m.type));
    const tag = it.marks.find((m) => m.type === 'tag');
    if (tag) tags.push({ cat: tag.attrs?.cat as TagCat, text: it.text });
    if (types.has('note')) {
      notes.push(it.text);
      offset += it.text.length;
      continue;
    }
    if (types.has('omit')) {
      offset += it.text.length;
      continue;
    }
    const del = it.marks.find((m) => m.type === 'del');
    if (del) {
      pendingDel = Math.max(pendingDel, Number(del.attrs?.gen) || 1);
      offset += it.text.length;
      continue;
    }
    const rev = it.marks.find((m) => m.type === 'rev');
    const revGen = Math.max(rev ? Number(rev.attrs?.gen) || 1 : 0, pendingDel) || undefined;
    pendingDel = 0;
    runs.push({
      text: it.text,
      b: types.has('bold') || undefined,
      i: types.has('italic') || undefined,
      u: types.has('underline') || undefined,
      rev: revGen,
    });
    for (let k = 0; k < it.text.length; k++) map.push(offset + k);
    offset += it.text.length;
  }
  if (pendingDel) {
    const last = runs.filter((r) => r.text !== '\n').at(-1);
    if (last) last.rev = Math.max(last.rev ?? 0, pendingDel);
  }
  const delGen = pendingDel && !runs.some((r) => r.text.trim()) ? pendingDel : undefined;
  // Ardışık etiketleri birleştir
  const mergedTags = tags.reduce<typeof tags>((acc, t) => {
    const last = acc.at(-1);
    if (last && last.cat === t.cat) last.text += t.text;
    else acc.push({ ...t });
    return acc;
  }, []);
  return {
    el,
    runs: mergeRuns(runs),
    sid: (attrs.sid as string) || undefined,
    num: (attrs.num as string) || undefined,
    dual: !!attrs.dual || undefined,
    delGen,
    idx,
    map,
    notes: notes.length ? [notes.join('')] : undefined,
    tags: mergedTags.length ? mergedTags.map((t) => ({ ...t, text: t.text.trim() })) : undefined,
  };
}

function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const l = out.at(-1);
    if (l && l.text !== '\n' && r.text !== '\n' && l.b === r.b && l.i === r.i && l.u === r.u && l.rev === r.rev) l.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

interface JsonNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: JsonNode[];
}

export function blocksFromJson(json: string | object | null): ScriptBlock[] {
  if (!json) return [];
  let doc: JsonNode;
  try {
    doc = typeof json === 'string' ? JSON.parse(json) : (json as JsonNode);
  } catch {
    return [];
  }
  return (doc.content ?? []).map((line, idx) =>
    build(
      ((line.attrs?.el as El) ?? 'action'),
      line.attrs ?? {},
      (line.content ?? []).map((c) =>
        c.type === 'hardBreak'
          ? { kind: 'break', text: '\n', marks: [] }
          : { kind: 'text', text: c.text ?? '', marks: c.marks ?? [] },
      ),
      idx,
    ),
  );
}

export function blocksFromNode(doc: PMNode): ScriptBlock[] {
  const out: ScriptBlock[] = [];
  doc.forEach((line, _o, idx) => {
    const items: Inline[] = [];
    line.forEach((c) => {
      if (c.type.name === 'hardBreak') items.push({ kind: 'break', text: '\n', marks: [] });
      else if (c.isText) items.push({ kind: 'text', text: c.text ?? '', marks: c.marks.map((m) => ({ type: m.type.name, attrs: m.attrs })) });
    });
    out.push(build((line.attrs.el as El) ?? 'action', line.attrs, items, idx));
  });
  return out;
}

export const blockText = (b: ScriptBlock) => b.runs.map((r) => r.text).join('');

/** Biçimli bloklar → editör JSON'u (içe aktarma için) */
export function blocksToDoc(blocks: ScriptBlock[], newSid: () => string): object {
  const content = blocks.map((b) => {
    const inline: unknown[] = [];
    for (const r of b.runs) {
      r.text.split('\n').forEach((part, k) => {
        if (k > 0) inline.push({ type: 'hardBreak' });
        if (!part) return;
        const marks = [r.b && { type: 'bold' }, r.i && { type: 'italic' }, r.u && { type: 'underline' }].filter(Boolean);
        inline.push(marks.length ? { type: 'text', text: part, marks } : { type: 'text', text: part });
      });
    }
    for (const n of b.notes ?? []) inline.push({ type: 'text', text: ` ${n}`, marks: [{ type: 'note' }] });
    const attrs: Record<string, unknown> = { el: b.el };
    if (b.el === 'sceneHeading') attrs.sid = b.sid ?? newSid();
    if (b.num) attrs.num = b.num;
    if (b.dual) attrs.dual = true;
    return { type: 'line', attrs, content: inline };
  });
  if (!content.length) content.push({ type: 'line', attrs: { el: 'sceneHeading', sid: newSid() }, content: [] });
  return { type: 'doc', content };
}
