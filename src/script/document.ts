/**
 * writetheFout. belge biçimi: standart Fountain + dosya sonunda gömülü meta veri.
 *
 *   ...senaryo...
 *
 *   /* writetheFout
 *   {"v":1, ...}
 *   *\/
 *
 * Meta veri bir Fountain "boneyard" yorumudur: Beat, Highland, Slugline gibi programlar onu yok sayar,
 * dosya her yerde normal bir senaryo olarak açılır. writetheFout. ise sahne renklerini, durumlarını,
 * hikâye günlerini, karakter profillerini, notları, etiketleri, revizyon işaretlerini ve sahne
 * kimliklerini buradan geri yükler. Metin dışarıda değiştirilmişse işaretler satır karması ile
 * doğrulanır; uymayan işaret sessizce düşer, metin asla bozulmaz.
 */
import type { CharacterProfile, SceneMeta, Status } from '../data/types';
import type { Lang, Paper } from '../export/layout';
import { parseFountain, toFountain, type TitleInfo } from '../export/fountain';
import { finalize, lineText, normalizeDoc, type JDoc, type JLine, type JMark, type JText } from './json';

export interface DocSettings {
  paper: Paper;
  lang: Lang;
  revisionOn: boolean;
  revisionGen: number;
}

export interface DocNote {
  id: string;
  title: string;
  /** ProseMirror JSON (düzyazı) */
  doc: string | null;
}

export interface ScriptDocument {
  title: TitleInfo;
  settings: DocSettings;
  doc: JDoc;
  scenes: Record<string, SceneMeta>;
  characters: Record<string, CharacterProfile>;
  notes: DocNote[];
}

export const DEFAULT_SETTINGS: DocSettings = { paper: 'a4', lang: 'tr', revisionOn: false, revisionGen: 1 };
export const emptyTitle = (): TitleInfo => ({ title: '', author: '', contact: '', credit: '', source: '', draftDate: '', notes: '', copyright: '' });

/** Fountain'da satır içinde taşınamayan işaretler */
const SIDECAR_MARKS = ['tag', 'rev', 'del'];

interface MarkEntry {
  /** dışa yazılan (boş olmayan) satır sırası */
  k: number;
  /** satır metni karması */
  h: string;
  m: { t: string; a?: Record<string, unknown>; f: number; e: number }[];
}

interface Meta {
  v: 1;
  app: 'writetheFout';
  settings: DocSettings;
  sids: string[];
  pageLocks: Record<string, number>;
  scenes: Record<string, Omit<SceneMeta, 'sid' | 'synopsis'>>;
  characters: Record<string, Omit<CharacterProfile, 'name'>>;
  notes: DocNote[];
  marks: MarkEntry[];
}

const META_RE = /\n*\/\* writetheFout\n([\s\S]*?)\n\*\/\s*$/;

/** Hızlı ve kararlı metin karması (FNV-1a) */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const exported = (l: JLine) => l.attrs.el === 'pageBreak' || lineText(l).trim() !== '';

/** Satırdaki yan işaretleri metin konumlarıyla çıkarır */
function extractMarks(l: JLine): MarkEntry['m'] {
  const out: MarkEntry['m'] = [];
  let off = 0;
  for (const c of l.content) {
    const len = c.type === 'hardBreak' ? 1 : (c.text ?? '').length;
    for (const m of c.marks ?? []) {
      if (!SIDECAR_MARKS.includes(m.type)) continue;
      const last = out.at(-1);
      if (last && last.t === m.type && last.e === off && JSON.stringify(last.a ?? {}) === JSON.stringify(m.attrs ?? {})) last.e = off + len;
      else out.push({ t: m.type, a: m.attrs, f: off, e: off + len });
    }
    off += len;
  }
  return out;
}

/** Satıra yan işaretleri geri uygular (metin düğümlerini sınırlarda böler) */
export function applyMarks(l: JLine, marks: MarkEntry['m']): JLine {
  if (!marks.length) return l;
  const cuts = new Set<number>();
  for (const m of marks) {
    cuts.add(m.f);
    cuts.add(m.e);
  }
  const content: JText[] = [];
  let off = 0;
  for (const c of l.content) {
    if (c.type === 'hardBreak') {
      content.push(c);
      off += 1;
      continue;
    }
    const t = c.text ?? '';
    let start = 0;
    for (let i = 1; i <= t.length; i++) {
      if (i === t.length || cuts.has(off + i)) {
        const piece = t.slice(start, i);
        const pos = off + start;
        const extra: JMark[] = marks.filter((m) => m.f <= pos && pos < m.e).map((m) => (m.a ? { type: m.t, attrs: m.a } : { type: m.t }));
        const ms = [...(c.marks ?? []), ...extra];
        content.push(ms.length ? { type: 'text', text: piece, marks: ms } : { type: 'text', text: piece });
        start = i;
      }
    }
    off += t.length;
  }
  return { ...l, content };
}

/** Yan işaretleri satırdan kaldırır (Fountain'a yazılacak sürüm için) */
const stripSidecar = (l: JLine): JLine => ({
  ...l,
  content: l.content
    // silinmeye aday metin Fountain'da kalır; işaret meta veride taşınır
    .map((c) => (c.marks ? { ...c, marks: c.marks.filter((m) => !SIDECAR_MARKS.includes(m.type)) } : c))
    .map((c) => (c.marks && !c.marks.length ? { type: c.type, text: c.text } : c)) as JText[],
});

export function serializeDocument(d: ScriptDocument): string {
  const lines = normalizeDoc(d.doc).content;
  const heads = lines.filter((l) => l.attrs.el === 'sceneHeading' && lineText(l).trim());
  const marks: MarkEntry[] = [];
  let k = 0;
  for (const l of lines) {
    if (!exported(l)) continue;
    const m = extractMarks(l);
    if (m.length) marks.push({ k, h: hash(lineText(l)), m });
    k++;
  }
  const body = toFountain({ type: 'doc', content: lines.map(stripSidecar) }, d.title, d.settings.lang, {
    native: true,
    synopses: heads.map((h) => d.scenes[h.attrs.sid ?? '']?.synopsis),
  });
  const pageLocks: Record<string, number> = {};
  const scenes: Meta['scenes'] = {};
  for (const h of heads) {
    const sid = h.attrs.sid ?? '';
    if (h.attrs.pageLock && sid) pageLocks[sid] = Number(h.attrs.pageLock);
    const s = d.scenes[sid];
    if (s && (s.color || s.status !== 'draft' || s.storyDay)) scenes[h.attrs.sid!] = { color: s.color, status: s.status, storyDay: s.storyDay };
  }
  const characters: Meta['characters'] = {};
  for (const [name, c] of Object.entries(d.characters)) if (c.description || c.color) characters[name] = { description: c.description, color: c.color };
  const meta: Meta = {
    v: 1,
    app: 'writetheFout',
    settings: d.settings,
    sids: heads.map((h) => h.attrs.sid ?? ''),
    pageLocks,
    scenes,
    characters,
    notes: d.notes,
    marks,
  };
  // JSON içinde "*/" boneyard'ı kapatmasın
  const json = JSON.stringify(meta).replace(/\*\//g, '*\\/');
  return `${body}\n/* writetheFout\n${json}\n*/\n`;
}

export function parseDocument(text: string, newSid: () => string): ScriptDocument {
  let metaJson: Meta | null = null;
  const m = text.match(META_RE);
  if (m) {
    try {
      metaJson = JSON.parse(m[1]) as Meta;
    } catch {
      metaJson = null;
    }
    text = text.slice(0, m.index);
  }
  const parsed = parseFountain(text);
  let lines = parsed.doc.content;

  // sahne kimlikleri: başlık sırasına göre
  let hi = 0;
  lines = lines.map((l) => {
    if (l.attrs.el !== 'sceneHeading' || !lineText(l).trim()) return l;
    const sid = metaJson?.sids?.[hi++] || undefined;
    return sid ? { ...l, attrs: { ...l.attrs, sid, pageLock: metaJson?.pageLocks?.[sid] ?? null } } : l;
  });

  // yan işaretler: önce aynı sıradaki satır, değilse ±5 satır içinde aynı karma
  if (metaJson?.marks?.length) {
    const idx = lines.map((l, i) => (exported(l) ? i : -1)).filter((i) => i >= 0);
    for (const e of metaJson.marks) {
      let target = -1;
      for (const d of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
        const li = idx[e.k + d];
        if (li !== undefined && hash(lineText(lines[li])) === e.h) {
          target = li;
          break;
        }
      }
      if (target >= 0) lines[target] = applyMarks(lines[target], e.m);
    }
  }

  const doc = finalize({ type: 'doc', content: lines }, newSid);
  const heads = doc.content.filter((l) => l.attrs.el === 'sceneHeading' && lineText(l).trim());
  const scenes: Record<string, SceneMeta> = {};
  heads.forEach((h, i) => {
    const sid = h.attrs.sid!;
    const sm = metaJson?.scenes?.[sid];
    const synopsis = parsed.synopses[i] ?? '';
    if (sm || synopsis) {
      scenes[sid] = {
        sid,
        synopsis,
        color: sm?.color ?? null,
        status: (sm?.status as Status) ?? 'draft',
        storyDay: sm?.storyDay ?? '',
      };
    }
  });
  const characters: Record<string, CharacterProfile> = {};
  for (const [name, c] of Object.entries(metaJson?.characters ?? {})) characters[name] = { name, description: c.description ?? '', color: c.color ?? null };

  return {
    title: { ...emptyTitle(), ...parsed.title } as TitleInfo,
    settings: { ...DEFAULT_SETTINGS, ...(metaJson?.settings ?? {}) },
    doc,
    scenes,
    characters,
    notes: metaJson?.notes ?? [],
  };
}

/** Dosya adından görünen ad */
export const baseName = (path: string) => path.split(/[\\/]/).pop()?.replace(/\.(fountain|spmd|txt)$/i, '') ?? path;
