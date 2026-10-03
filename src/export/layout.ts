/**
 * Senaryo sayfalama motoru (PDF, editördeki canlı sayfa sonları ve sahne uzunlukları ortak kullanır).
 * Endüstri biçimi: Courier 12pt (7,2 pt/karakter, 12 pt/satır), 1,5" sol / 1" sağ-üst-alt boşluk.
 */
import { baseName, type El } from '../script/elements';
import { blockText, type Run, type ScriptBlock } from '../script/blocks';

export type { Run, ScriptBlock };
export type Paper = 'a4' | 'letter';
export type Lang = 'tr' | 'en' | 'de' | 'es' | 'fr';

export interface LayoutOptions {
  paper: Paper;
  lang: Lang;
  sceneNumbers: boolean;
  /** Sahne başlığından önce kaç boş satır */
  headingSpace: 1 | 2;
  /** Aynı karakter araya aksiyon girerek konuşmaya devam ederse (DEVAM) ekle */
  autoContd?: boolean;
  /** bu karakterin replikleri vurgulanır (oyuncu sayfaları); karakter adı `baseName` biçiminde */
  highlight?: string;
}

export const PAPER: Record<Paper, { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
};

export const CH = 7.2;
export const LINE = 12;
export const MARGIN_TOP = 72;
export const MARGIN_BOTTOM = 72;
export const LEFT = 108;
export const RIGHT_EDGE = LEFT + 60 * CH; // 540pt

type Geo = { x: number; width: number; align?: 'left' | 'right' | 'center' };
export const GEOMETRY: Record<Exclude<El, 'section' | 'pageBreak'>, Geo> = {
  sceneHeading: { x: LEFT, width: 60 },
  action: { x: LEFT, width: 60 },
  character: { x: 266.4, width: 38 },
  parenthetical: { x: 223.2, width: 23 },
  dialogue: { x: 180, width: 35 },
  transition: { x: LEFT, width: 60, align: 'right' },
  centered: { x: LEFT, width: 60, align: 'center' },
  lyrics: { x: 180, width: 35 },
};

/** Çift diyalog sütunları */
const DUAL: Record<'L' | 'R', Record<'character' | 'parenthetical' | 'dialogue' | 'lyrics', Geo>> = {
  L: {
    character: { x: 194, width: 24 },
    parenthetical: { x: 137, width: 22 },
    dialogue: { x: 122, width: 27 },
    lyrics: { x: 122, width: 27 },
  },
  R: {
    character: { x: 404, width: 18 },
    parenthetical: { x: 347, width: 22 },
    dialogue: { x: 332, width: 28 },
    lyrics: { x: 332, width: 28 },
  },
};

/** Senaryo dilleri: sayfa etiketleri, başlık sayfası, sahne başlığı önekleri ve revizyon adları o dilin sektör kurallarına göre */
export interface ScriptLabels {
  more: string;
  contd: string;
  written: string;
  /** sahne başlığı önekleri (yardım metni ve otomatik tamamlama için) */
  heads: string;
  headings: string[];
  times: string[];
  transitions: string[];
  /** boş sahne başlığında görünen örnek */
  placeholder: string;
  cue: string;
  locale: string;
  /** revizyon turu adı (1–8) */
  revision: (gen: number) => string;
}

const REV_COLORS: Record<Lang, string[]> = {
  tr: ['Mavi', 'Pembe', 'Sarı', 'Yeşil', 'Altın', 'Devetüyü', 'Gül', 'Kiraz'],
  en: ['Blue', 'Pink', 'Yellow', 'Green', 'Goldenrod', 'Buff', 'Salmon', 'Cherry'],
  de: ['Blau', 'Rosa', 'Gelb', 'Grün', 'Goldgelb', 'Chamois', 'Lachs', 'Kirsche'],
  es: ['Azul', 'Rosa', 'Amarilla', 'Verde', 'Dorada', 'Beige', 'Salmón', 'Cereza'],
  fr: ['Bleue', 'Rose', 'Jaune', 'Verte', 'Dorée', 'Chamois', 'Saumon', 'Cerise'],
};

export const SCRIPT_LANGS: { id: Lang; name: string }[] = [
  { id: 'tr', name: 'Türkçe' },
  { id: 'en', name: 'English' },
  { id: 'de', name: 'Deutsch' },
  { id: 'es', name: 'Español' },
  { id: 'fr', name: 'Français' },
];

const SCRIPT: Record<Lang, Omit<ScriptLabels, 'revision'> & { rev: (c: string) => string }> = {
  tr: {
    more: '(DEVAM EDİYOR)',
    contd: '(DEVAM)',
    written: 'Yazan',
    heads: 'İÇ. / DIŞ.',
    headings: ['İÇ. ', 'DIŞ. ', 'İÇ/DIŞ. '],
    times: ['GÜNDÜZ', 'GECE', 'SABAH', 'AKŞAM', 'ŞAFAK', 'DEVAM', 'AYNI ANDA'],
    transitions: ['KESME:', 'KARARMA.', 'GEÇİŞ:', 'AÇILMA:'],
    placeholder: 'İÇ. MEKÂN - GÜNDÜZ',
    cue: 'İPUCU',
    locale: 'tr-TR',
    rev: (c) => `${c} revizyon`,
  },
  en: {
    more: '(MORE)',
    contd: "(CONT'D)",
    written: 'Written by',
    heads: 'INT. / EXT.',
    headings: ['INT. ', 'EXT. ', 'INT./EXT. '],
    times: ['DAY', 'NIGHT', 'MORNING', 'EVENING', 'DAWN', 'DUSK', 'CONTINUOUS', 'LATER', 'MOMENTS LATER'],
    transitions: ['CUT TO:', 'FADE OUT.', 'DISSOLVE TO:', 'SMASH CUT TO:', 'FADE IN:'],
    placeholder: 'INT. LOCATION - DAY',
    cue: 'CUE',
    locale: 'en-US',
    rev: (c) => `${c} Revision`,
  },
  de: {
    more: '(WEITER)',
    contd: '(FORTS.)',
    written: 'Drehbuch von',
    heads: 'INNEN / AUSSEN',
    headings: ['INNEN. ', 'AUSSEN. ', 'INNEN/AUSSEN. '],
    times: ['TAG', 'NACHT', 'MORGEN', 'ABEND', 'DÄMMERUNG', 'FORTLAUFEND', 'SPÄTER'],
    transitions: ['SCHNITT AUF:', 'ABBLENDE.', 'ÜBERBLENDE AUF:', 'AUFBLENDE:'],
    placeholder: 'INNEN. ORT - TAG',
    cue: 'STICHWORT',
    locale: 'de-DE',
    rev: (c) => `Revision ${c}`,
  },
  es: {
    more: '(SIGUE)',
    contd: '(CONT.)',
    written: 'Escrito por',
    heads: 'INT. / EXT.',
    headings: ['INT. ', 'EXT. ', 'INT./EXT. '],
    times: ['DÍA', 'NOCHE', 'MAÑANA', 'TARDE', 'AMANECER', 'ATARDECER', 'CONTINUO', 'MÁS TARDE'],
    transitions: ['CORTE A:', 'FUNDIDO A NEGRO.', 'ENCADENADO A:', 'FUNDIDO DE ENTRADA:'],
    placeholder: 'INT. LUGAR - DÍA',
    cue: 'PIE',
    locale: 'es-ES',
    rev: (c) => `Revisión ${c.toLocaleLowerCase('es')}`,
  },
  fr: {
    more: '(À SUIVRE)',
    contd: '(SUITE)',
    written: 'Écrit par',
    heads: 'INT. / EXT.',
    headings: ['INT. ', 'EXT. ', 'INT./EXT. '],
    times: ['JOUR', 'NUIT', 'MATIN', 'SOIR', 'AUBE', 'CRÉPUSCULE', 'CONTINU', 'PLUS TARD'],
    transitions: ['COUPE SUR :', 'FONDU AU NOIR.', 'ENCHAÎNÉ SUR :', 'OUVERTURE AU NOIR :'],
    placeholder: 'INT. LIEU - JOUR',
    cue: 'RÉPLIQUE',
    locale: 'fr-FR',
    rev: (c) => `Révision ${c.toLocaleLowerCase('fr')}`,
  },
};

export function scriptLabels(lang: Lang): ScriptLabels {
  const s = SCRIPT[lang] ?? SCRIPT.tr;
  const colors = REV_COLORS[lang] ?? REV_COLORS.tr;
  return { ...s, revision: (gen) => s.rev(colors[Math.max(0, Math.min(7, gen - 1))]) };
}

/** Eski arayüz */
export const LABELS: Record<Lang, { more: string; contd: string; written: string }> = new Proxy({} as Record<Lang, { more: string; contd: string; written: string }>, {
  get: (_o, k) => scriptLabels(k as Lang),
});

export const upper = (s: string, lang: Lang) => (lang === 'tr' ? s.toLocaleUpperCase('tr-TR') : s.toLocaleUpperCase(scriptLabels(lang).locale));

export interface PLine {
  el: El | 'more';
  x: number;
  align: 'left' | 'right' | 'center';
  runs: Run[];
  sceneNo?: string;
  /** kaynak: belge blok sırası + basılı karakter sırası */
  src?: { b: number; o: number };
  /** aynı satırda sağ sütun (çift diyalog) */
  pair?: PLine;
  /** sahne kimliği (uzunluk hesabı) */
  sid?: string;
  /** satırdaki en yüksek revizyon kuşağı */
  rev?: number;
  /** vurgulanan replik satırı */
  hl?: boolean;
}

export interface Page {
  number: number;
  /** null = boş satır */
  lines: (PLine | null)[];
}

/* ---------- Satır kırma ---------- */

interface Ch {
  c: string;
  r: Run;
  o: number;
}

function toRuns(chars: Ch[]): Run[] {
  const out: Run[] = [];
  for (const ch of chars) {
    const last = out.at(-1);
    const { b, i, u, rev } = ch.r;
    if (last && last.b === b && last.i === i && last.u === u && last.rev === rev) last.text += ch.c;
    else out.push({ text: ch.c, b, i, u, rev });
  }
  return out;
}

export interface WrappedLine {
  runs: Run[];
  /** satırın ilk karakterinin basılı metindeki sırası */
  start: number;
}

/** Biçimli metni verilen karakter genişliğinde satırlara böler (tek aralıklı yazı). */
export function wrapLines(runs: Run[], width: number): WrappedLine[] {
  const chars: Ch[] = [];
  let o = 0;
  for (const r of runs) for (const c of r.text) {
    chars.push({ c, r, o });
    o += c.length;
  }
  const paras: Ch[][] = [[]];
  for (const ch of chars) {
    if (ch.c === '\n') paras.push([]);
    else paras.at(-1)!.push(ch);
  }
  const lines: WrappedLine[] = [];
  for (const para of paras) {
    let s = 0;
    while (s < para.length && para[s].c === ' ') s++;
    if (s >= para.length) {
      lines.push({ runs: [], start: para[0]?.o ?? o });
      continue;
    }
    while (s < para.length) {
      if (para.length - s <= width) {
        lines.push({ runs: toRuns(para.slice(s)), start: para[s].o });
        break;
      }
      let cut = -1;
      for (let k = s + width; k > s; k--) {
        if (para[k]?.c === ' ') {
          cut = k;
          break;
        }
      }
      const end = cut === -1 ? s + width : cut;
      lines.push({ runs: toRuns(para.slice(s, end)), start: para[s].o });
      s = end;
      while (s < para.length && para[s].c === ' ') s++;
    }
  }
  return lines;
}

/** Eski arayüz (testler) */
export const wrapRuns = (runs: Run[], width: number) => wrapLines(runs, width).map((l) => l.runs);

/* ---------- Birimler ---------- */

interface Unit {
  kind: 'heading' | 'action' | 'dialogue' | 'transition' | 'dual' | 'break';
  before: number;
  lines: PLine[];
  speaker?: string;
  sid?: string;
}

const CAPS: El[] = ['sceneHeading', 'character', 'transition'];

function blockLines(b: ScriptBlock, opts: LayoutOptions, geo: Geo, sid: string | undefined, suffix = ''): PLine[] {
  const caps = CAPS.includes(b.el);
  let runs = caps ? b.runs.map((r) => ({ ...r, text: upper(r.text, opts.lang) })) : b.runs;
  if (b.el === 'character') runs = runs.map((r) => ({ ...r, text: r.text.replace(/\s*\^\s*$/u, '') }));
  if (suffix) runs = [...runs, { text: ` ${suffix}` }];
  if (b.el === 'lyrics') runs = runs.map((r) => ({ ...r, i: true }));
  return wrapLines(runs, geo.width).map((w, k) => ({
    el: b.el,
    x: geo.x,
    align: geo.align ?? 'left',
    runs: w.runs,
    sceneNo: k === 0 && opts.sceneNumbers && b.el === 'sceneHeading' ? b.sceneNo : undefined,
    src: b.idx !== undefined ? { b: b.idx, o: w.start } : undefined,
    sid,
    rev: w.runs.reduce((m, r) => Math.max(m, r.rev ?? 0), 0) || undefined,
  }));
}

function geoFor(el: El, side?: 'L' | 'R'): Geo {
  if (side && (el === 'character' || el === 'parenthetical' || el === 'dialogue' || el === 'lyrics')) return DUAL[side][el];
  return GEOMETRY[el as keyof typeof GEOMETRY] ?? GEOMETRY.action;
}

const speakerOf = (b: ScriptBlock, lang: Lang) =>
  upper(blockText(b).replace(/\s*\^\s*$/u, '').replace(/\s*\([^)]*\)\s*$/u, '').trim(), lang);

export function buildUnits(blocks: ScriptBlock[], opts: LayoutOptions): Unit[] {
  const units: Unit[] = [];
  // tamamen silinmiş satırların yıldızı bir sonraki basılı satıra taşınır
  let carry = 0;
  const list: ScriptBlock[] = [];
  for (const b of blocks) {
    const printed = b.el === 'pageBreak' || (b.el !== 'section' && blockText(b).trim() !== '');
    if (!printed) {
      if (b.delGen) carry = Math.max(carry, b.delGen);
      continue;
    }
    if (carry && b.runs.length) {
      list.push({ ...b, runs: b.runs.map((r, i) => (i === 0 ? { ...r, rev: Math.max(r.rev ?? 0, carry) } : r)) });
      carry = 0;
    } else list.push(b);
  }
  const lab = LABELS[opts.lang];
  const mark = (lines: PLine[], cue: ScriptBlock) => {
    if (opts.highlight && baseName(blockText(cue)) === opts.highlight) for (const l of lines) l.hl = true;
    return lines;
  };
  let sid: string | undefined;
  let lastSpeaker: string | null = null;

  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.el === 'sceneHeading') {
      sid = b.sid ?? `h${b.idx}`;
      lastSpeaker = null;
      units.push({ kind: 'heading', before: opts.headingSpace, lines: blockLines(b, opts, geoFor(b.el), sid), sid });
      continue;
    }
    if (b.el === 'pageBreak') {
      units.push({ kind: 'break', before: 0, lines: [], sid });
      continue;
    }
    if (b.el === 'character') {
      // karakter + parantez/diyalog/şarkı grubunu topla
      let j = i + 1;
      while (j < list.length && ['dialogue', 'parenthetical', 'lyrics'].includes(list[j].el)) j++;
      const group = list.slice(i, j);
      const speaker = speakerOf(b, opts.lang);
      const next = list[j];
      const nextIsDual = next?.el === 'character' && next.dual;

      if (nextIsDual) {
        let k = j + 1;
        while (k < list.length && ['dialogue', 'parenthetical', 'lyrics'].includes(list[k].el)) k++;
        const right = list.slice(j, k);
        const L = mark(group.flatMap((g) => blockLines(g, opts, geoFor(g.el, 'L'), sid)), b);
        const R = mark(right.flatMap((g) => blockLines(g, opts, geoFor(g.el, 'R'), sid)), next);
        const rows = Math.max(L.length, R.length);
        const lines: PLine[] = [];
        for (let r = 0; r < rows; r++) {
          const l = L[r] ?? { el: 'dialogue' as El, x: 0, align: 'left' as const, runs: [], sid };
          if (R[r]) l.pair = R[r];
          lines.push(l);
        }
        units.push({ kind: 'dual', before: 1, lines, sid });
        lastSpeaker = null;
        i = k - 1;
        continue;
      }

      const contd = opts.autoContd && lastSpeaker === speaker && !/\(/.test(blockText(b)) ? lab.contd : '';
      const lines = mark(group.flatMap((g) => blockLines(g, opts, geoFor(g.el), sid, g === b ? contd : '')), b);
      units.push({ kind: 'dialogue', before: 1, lines, speaker, sid });
      lastSpeaker = speaker;
      i = j - 1;
      continue;
    }
    if (b.el === 'transition') {
      units.push({ kind: 'transition', before: 1, lines: blockLines(b, opts, geoFor(b.el), sid), sid });
      continue;
    }
    // aksiyon, ortalı, şarkı ve karaktersiz diyalog
    units.push({ kind: 'action', before: 1, lines: blockLines(b, opts, geoFor(b.el), sid), sid });
  }
  return units;
}

function minHead(u: Unit): number {
  if (u.kind === 'action') return Math.min(u.lines.length, 2);
  if (u.kind === 'dialogue') {
    const charLines = u.lines.findIndex((l) => l.el !== 'character');
    return Math.min(u.lines.length, (charLines === -1 ? u.lines.length : charLines) + 2);
  }
  return u.lines.length;
}

/* ---------- Sayfalama ---------- */

export function linesPerPage(paper: Paper) {
  return Math.floor((PAPER[paper].h - MARGIN_TOP - MARGIN_BOTTOM) / LINE);
}

export function paginate(blocks: ScriptBlock[], opts: LayoutOptions): Page[] {
  const L = linesPerPage(opts.paper);
  const units = buildUnits(blocks, opts);
  const pages: Page[] = [{ number: 1, lines: [] }];
  const page = () => pages.at(-1)!;
  const newPage = () => pages.push({ number: pages.length + 1, lines: [] });
  const used = () => page().lines.length;
  const lab = LABELS[opts.lang];

  const place = (lines: PLine[], before: number) => {
    if (used() > 0) for (let k = 0; k < before; k++) page().lines.push(null);
    page().lines.push(...lines);
  };

  for (let ui = 0; ui < units.length; ui++) {
    const u = units[ui];
    if (u.kind === 'break') {
      if (used() > 0) newPage();
      continue;
    }
    const before = used() === 0 ? 0 : u.before;
    const free = L - used() - before;

    if (u.kind === 'heading') {
      const next = units[ui + 1];
      const tail = next && next.kind !== 'heading' && next.kind !== 'break' ? next.before + minHead(next) : 0;
      if (u.lines.length + tail > free && used() > 0) newPage();
      place(u.lines, used() === 0 ? 0 : u.before);
      continue;
    }

    if (u.lines.length <= free) {
      place(u.lines, before);
      continue;
    }

    if (u.kind === 'action' && used() > 0 && free >= 2 && u.lines.length - free >= 2) {
      place(u.lines.slice(0, free), before);
      newPage();
      place(u.lines.slice(free), 0);
      continue;
    }

    if (u.kind === 'dialogue' && used() > 0) {
      const charCount = u.lines.findIndex((l) => l.el !== 'character');
      let k = free - 1;
      while (k > charCount + 1) {
        if (u.lines[k - 1].el === 'dialogue' && u.lines.length - k >= 2) break;
        k--;
      }
      const ok = charCount >= 0 && k > charCount + 1 && u.lines[k - 1].el === 'dialogue' && u.lines.length - k >= 2;
      if (ok) {
        place(u.lines.slice(0, k), before);
        const hl = u.lines[0].hl;
        page().lines.push({ el: 'more', x: GEOMETRY.character.x, align: 'left', runs: [{ text: lab.more }], sid: u.sid, hl });
        newPage();
        place(
          [
            { el: 'character', x: GEOMETRY.character.x, align: 'left', runs: [{ text: `${u.speaker} ${lab.contd}` }], sid: u.sid, hl },
            ...u.lines.slice(k),
          ],
          0,
        );
        continue;
      }
    }

    if (used() > 0) newPage();
    let rest = u.lines;
    while (rest.length > L) {
      place(rest.slice(0, L), 0);
      rest = rest.slice(L);
      newPage();
    }
    place(rest, 0);
  }

  for (const p of pages) while (p.lines.length && p.lines.at(-1) === null) p.lines.pop();
  return pages.filter((p, i) => i === 0 || p.lines.length > 0).map((p, i) => ({ ...p, number: i + 1 }));
}

/* ---------- Sahne numaraları ---------- */

/**
 * Kilitli numaralar korunur; aralarına eklenen sahneler 12A, 12B… alır.
 * Hiç kilit yoksa 1, 2, 3…
 */
export function numberScenes<T extends ScriptBlock>(blocks: T[]): T[] {
  const heads = blocks.filter((b) => b.el === 'sceneHeading' && blockText(b).trim());
  const anyLocked = heads.some((h) => h.num);
  const nums = new Map<T, string>();
  if (!anyLocked) heads.forEach((h, i) => nums.set(h, String(i + 1)));
  else {
    let base = '0';
    let suffix = 0;
    for (const h of heads) {
      if (h.num) {
        base = h.num;
        suffix = 0;
        nums.set(h, h.num);
      } else {
        suffix++;
        const letter = String.fromCharCode(64 + Math.min(suffix, 26));
        // ilk kilitli sahneden önce eklenenler: A1, B1…
        nums.set(h, base === '0' ? `${letter}1` : `${base}${letter}`);
      }
    }
  }
  return blocks.map((b) => (nums.has(b) ? { ...b, sceneNo: nums.get(b) } : b));
}

/* ---------- Sahne uzunlukları ---------- */

export interface SceneSpan {
  sid: string;
  page: number;
  /** 1/8 sayfa */
  eighths: number;
}

export function sceneSpans(pages: Page[], paper: Paper): SceneSpan[] {
  const L = linesPerPage(paper);
  const map = new Map<string, { page: number; lines: number }>();
  for (const p of pages) {
    let pendingBlank = 0;
    for (const ln of p.lines) {
      if (!ln) {
        pendingBlank++;
        continue;
      }
      if (!ln.sid) {
        pendingBlank = 0;
        continue;
      }
      const e = map.get(ln.sid) ?? { page: p.number, lines: 0 };
      e.lines += 1 + pendingBlank;
      pendingBlank = 0;
      map.set(ln.sid, e);
    }
  }
  return [...map.entries()].map(([sid, e]) => ({ sid, page: e.page, eighths: Math.max(1, Math.round((e.lines / L) * 8)) }));
}

/* ---------- Başlık sayfası ---------- */

export interface TitleLine {
  text: string;
  /** sol kenardan (pt) — hizalamaya göre çapa noktası */
  x: number;
  /** üstten (pt), taban çizgisi */
  y: number;
  align: 'left' | 'center' | 'right';
  bold?: boolean;
}

export interface TitleFields {
  title: string;
  author: string;
  contact: string;
  credit?: string;
  source?: string;
  draftDate?: string;
  notes?: string;
  copyright?: string;
}

/** Endüstri düzeni: başlık sayfanın üçte birinde ortada, iletişim sol altta, taslak tarihi sağ altta. */
export function titlePageLayout(t: TitleFields, paper: Paper, lang: Lang): TitleLine[] {
  const { h } = PAPER[paper];
  const mid = (LEFT + RIGHT_EDGE) / 2;
  const out: TitleLine[] = [];
  let y = 252;
  const center = (text: string, bold = false) => {
    for (const l of text.split('\n')) {
      out.push({ text: l, x: mid, y, align: 'center', bold });
      y += LINE;
    }
  };
  center(upper(t.title || (lang === 'tr' ? 'Adsız' : 'Untitled'), lang), true);
  y += LINE * 3;
  center(t.credit || LABELS[lang].written);
  y += LINE;
  if (t.author) center(t.author);
  if (t.source) {
    y += LINE * 3;
    center(t.source);
  }
  // alt blok: sol altta iletişim (en altta), üstünde telif ve not
  const bottom = [t.notes, t.copyright, t.contact].filter((x): x is string => !!x && !!x.trim()).join('\n\n');
  const lines = bottom ? bottom.split('\n') : [];
  lines.forEach((l, i) => out.push({ text: l, x: LEFT, y: h - 72 - (lines.length - 1 - i) * LINE, align: 'left' }));
  if (t.draftDate) {
    const dl = t.draftDate.split('\n');
    dl.forEach((l, i) => out.push({ text: l, x: RIGHT_EDGE, y: h - 72 - (dl.length - 1 - i) * LINE, align: 'right' }));
  }
  return out;
}
