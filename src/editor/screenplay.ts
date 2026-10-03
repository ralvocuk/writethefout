import { Extension, Mark, Node, mergeAttributes, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { CORE, EXTRA, HEADING_PREFIX, baseName, upperTr, type El } from '../script/elements';
import { scriptLabels, type Lang } from '../export/layout';

export { EL_LABEL } from '../script/elements';
export type ScreenplayElement = El;

/* ---------- Tuş akışı (saf tablolar; testleri tests/editor.test.ts) ---------- */

export const NEXT_ON_ENTER: Record<El, El> = {
  sceneHeading: 'action',
  action: 'action',
  character: 'dialogue',
  parenthetical: 'dialogue',
  dialogue: 'action',
  transition: 'sceneHeading',
  centered: 'action',
  lyrics: 'lyrics',
  section: 'sceneHeading',
  pageBreak: 'sceneHeading',
};

export const EMPTY_ENTER: Record<El, El> = {
  sceneHeading: 'action',
  action: 'sceneHeading',
  character: 'action',
  parenthetical: 'dialogue',
  dialogue: 'action',
  transition: 'sceneHeading',
  centered: 'action',
  lyrics: 'action',
  section: 'sceneHeading',
  pageBreak: 'pageBreak',
};

export const TAB_NEXT: Record<El, El> = {
  sceneHeading: 'action',
  action: 'character',
  character: 'transition',
  parenthetical: 'dialogue',
  dialogue: 'parenthetical',
  transition: 'sceneHeading',
  centered: 'action',
  lyrics: 'dialogue',
  section: 'sceneHeading',
  pageBreak: 'sceneHeading',
};

export const SHIFT_TAB_NEXT: Record<El, El> = {
  sceneHeading: 'transition',
  action: 'sceneHeading',
  character: 'action',
  parenthetical: 'character',
  dialogue: 'character',
  transition: 'character',
  centered: 'action',
  lyrics: 'dialogue',
  section: 'action',
  pageBreak: 'action',
};

const HEADING_RE = new RegExp(`^(${HEADING_PREFIX})\\.\\s`, 'u');
const TRANSITION_RE = /^[\p{Lu}\s]+\s?(:|\.)$/u;
const TRANSITION_WORDS = /(KESME|GEÇİŞ|KARARMA|AÇILMA|CUT TO|FADE (IN|OUT)|DISSOLVE TO|SMASH CUT|SCHNITT|ÜBERBLENDE|ABBLENDE|AUFBLENDE|CORTE A|FUNDIDO|ENCADENADO|COUPE|FONDU|ENCHAÎNÉ)/u;

/** Aksiyon satırının metninden elemanı tahmin eder. */
export function detectElement(text: string, current: El, prev: El | null): El {
  if (current !== 'action') return current;
  if (HEADING_RE.test(upperTr(text)) || HEADING_RE.test(text.toUpperCase())) return 'sceneHeading';
  const u = upperTr(text.trim());
  if (TRANSITION_RE.test(u) && TRANSITION_WORDS.test(u)) return 'transition';
  if (text.startsWith('(') && (prev === 'character' || prev === 'dialogue')) return 'parenthetical';
  if (/^#\s/.test(text)) return 'section';
  if (/^>.*<$/.test(text.trim()) && text.trim().length > 2) return 'centered';
  if (/^~/.test(text) && (prev === 'character' || prev === 'dialogue' || prev === 'lyrics' || prev === 'parenthetical')) return 'lyrics';
  if (text.trim() === '===') return 'pageBreak';
  return current;
}

export { baseName, upperTr };

/** Otomatik tamamlama: senaryo diline göre başlık önekleri ve günün saatleri */
export const STANDARD_HEADINGS = (lang: Lang = 'tr') => scriptLabels(lang).headings;
export const TIMES = (lang: Lang = 'tr') => scriptLabels(lang).times;

/** Ghost metin önerisi: yazılana uyan ilk adayın kalan kısmı. */
export function suggest(typed: string, candidates: string[]): string {
  if (!typed.trim()) return '';
  const t = upperTr(typed);
  for (const c of candidates) {
    const u = upperTr(c);
    if (u.length > t.length && u.startsWith(t)) return c.slice(typed.length);
  }
  return '';
}

export const newSid = () => Math.random().toString(36).slice(2, 10);

/* ---------- Şema ---------- */

export const ScreenplayDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'line+',
});

export const Line = Node.create({
  name: 'line',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      el: {
        default: 'action',
        parseHTML: (e) => e.getAttribute('data-el') ?? 'action',
        renderHTML: (a) => ({ 'data-el': a.el }),
      },
      sid: { default: null, renderHTML: (a) => (a.sid ? { 'data-sid': a.sid } : {}) },
      num: { default: null, renderHTML: (a) => (a.num ? { 'data-locked': a.num } : {}) },
      dual: { default: false, renderHTML: (a) => (a.dual ? { 'data-dual': 'true' } : {}) },
    };
  },
  parseHTML() {
    return [{ tag: 'p[data-el]' }, { tag: 'p' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes({ class: 'sp-line' }, HTMLAttributes), 0];
  },
});

/** [[not]] — basılmaz */
export const NoteMark = Mark.create({
  name: 'note',
  inclusive: false,
  parseHTML: () => [{ tag: 'span.sp-note' }],
  renderHTML: () => ['span', { class: 'sp-note' }, 0],
});

/** /* kapalı metin *\/ — basılmaz */
export const OmitMark = Mark.create({
  name: 'omit',
  inclusive: false,
  parseHTML: () => [{ tag: 'span.sp-omit' }],
  renderHTML: () => ['span', { class: 'sp-omit' }, 0],
});

/** Prodüksiyon etiketi */
export const TagMark = Mark.create({
  name: 'tag',
  inclusive: false,
  excludes: 'tag',
  addAttributes: () => ({ cat: { default: 'prop' } }),
  parseHTML: () => [{ tag: 'span[data-tag]', getAttrs: (e) => ({ cat: (e as HTMLElement).dataset.tag }) }],
  renderHTML: ({ HTMLAttributes }) => ['span', { class: 'sp-tag', 'data-tag': HTMLAttributes.cat }, 0],
});

/** Revizyon işareti (kuşak 1–8) */
export const RevMark = Mark.create({
  name: 'rev',
  inclusive: true,
  excludes: 'rev',
  addAttributes: () => ({ gen: { default: 1 } }),
  parseHTML: () => [{ tag: 'span[data-rev]', getAttrs: (e) => ({ gen: Number((e as HTMLElement).dataset.rev) }) }],
  renderHTML: ({ HTMLAttributes }) => ['span', { class: 'sp-rev', 'data-rev': HTMLAttributes.gen }, 0],
});

/** Revizyonda silinmeye aday metin (onaylanınca silinir) */
export const DelMark = Mark.create({
  name: 'del',
  inclusive: false,
  excludes: 'del rev',
  addAttributes: () => ({ gen: { default: 1 } }),
  parseHTML: () => [{ tag: 'span[data-del]', getAttrs: (e) => ({ gen: Number((e as HTMLElement).dataset.del) }) }],
  renderHTML: ({ HTMLAttributes }) => ['span', { class: 'sp-del', 'data-del': HTMLAttributes.gen }, 0],
});

/**
 * Revizyon modunda silme: eski metin silinmez, "silinmeye aday" işaretlenir.
 * Bu revizyonda yazılmış metin ise gerçekten silinir.
 */
export function markDeletion(state: EditorState, from: number, to: number, gen: number): Transaction {
  const tr = state.tr;
  const delType = state.schema.marks.del;
  const revType = state.schema.marks.rev;
  const segs: { from: number; to: number; rev: boolean; del: boolean }[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return;
    segs.push({
      from: Math.max(from, pos),
      to: Math.min(to, pos + node.nodeSize),
      rev: node.marks.some((m) => m.type === revType),
      del: node.marks.some((m) => m.type === delType),
    });
  });
  for (const sg of [...segs].reverse()) {
    if (sg.rev) tr.delete(sg.from, sg.to);
    else if (!sg.del) tr.addMark(sg.from, sg.to, delType.create({ gen }));
  }
  tr.setMeta('skipRev', true);
  return tr;
}

function revDelete(editor: Editor, dir: -1 | 1, gen: number): boolean {
  const { state, view } = editor;
  const sel = state.selection;
  if (!sel.empty) {
    const tr = markDeletion(state, sel.from, sel.to, gen);
    tr.setSelection(TextSelection.create(tr.doc, dir < 0 ? tr.mapping.map(sel.from) : tr.mapping.map(sel.to)));
    view.dispatch(tr);
    return true;
  }
  const $p = sel.$from;
  // satır başında/sonunda varsayılan davranış (satır birleştirme) kalsın
  if (dir < 0 && $p.parentOffset === 0) return false;
  if (dir > 0 && $p.parentOffset === $p.parent.content.size) return false;
  const from = dir < 0 ? $p.pos - 1 : $p.pos;
  const to = from + 1;
  const tr = markDeletion(state, from, to, gen);
  const cursor = dir < 0 ? tr.mapping.map(from, -1) : tr.mapping.map(to, 1);
  tr.setSelection(TextSelection.create(tr.doc, cursor));
  view.dispatch(tr.scrollIntoView());
  return true;
}

/* ---------- Davranış ---------- */

export interface ScreenplayOptions {
  known: () => { names: string[]; headings: string[]; lang?: Lang };
  revision: () => { on: boolean; gen: number };
}

interface GhostState {
  text: string;
  pos: number;
}
export const ghostKey = new PluginKey<GhostState>('sp-ghost');

function collect(doc: PMNode, skipPos: number) {
  const names = new Set<string>();
  const headings = new Set<string>();
  doc.forEach((n, offset) => {
    if (offset === skipPos) return;
    const t = n.textContent.trim();
    if (!t) return;
    if (n.attrs.el === 'character') names.add(baseName(t));
    if (n.attrs.el === 'sceneHeading') headings.add(upperTr(t));
  });
  return { names: [...names], headings: [...headings] };
}

function computeGhost(state: EditorState, opts: ScreenplayOptions): GhostState {
  const none = { text: '', pos: -1 };
  const { selection } = state;
  if (!selection.empty) return none;
  const $p = selection.$from;
  const block = $p.parent;
  if (block.type.name !== 'line' || $p.pos !== $p.end()) return none;
  const el = block.attrs.el as El;
  const typed = block.textContent;
  if (el !== 'character' && el !== 'sceneHeading' && el !== 'transition') return none;
  const local = collect(state.doc, $p.before());
  const ext = opts.known();
  if (el === 'character') {
    const pool = [...new Set([...local.names, ...ext.names])].sort();
    return { text: suggest(typed, pool), pos: $p.pos };
  }
  if (el === 'sceneHeading') {
    const dash = typed.lastIndexOf(' - ');
    if (dash >= 0) return { text: suggest(typed.slice(dash + 3), TIMES(ext.lang)), pos: $p.pos };
    const pool = [...new Set([...local.headings, ...ext.headings])].sort();
    return { text: suggest(typed, [...STANDARD_HEADINGS(ext.lang), ...pool]), pos: $p.pos };
  }
  return { text: suggest(typed, scriptLabels(ext.lang ?? 'tr').transitions), pos: $p.pos };
}

export function setElement(editor: Editor, el: El): boolean {
  const { state, view } = editor;
  const $p = state.selection.$from;
  const block = $p.parent;
  if (block.type.name !== 'line') return false;
  const tr = state.tr.setNodeMarkup($p.before(), undefined, { ...block.attrs, el, dual: el === 'character' ? block.attrs.dual : false });
  const text = block.textContent;
  if (el === 'parenthetical' && text === '') {
    tr.insertText('()', $p.start());
    tr.setSelection(TextSelection.create(tr.doc, $p.start() + 1));
  } else if (block.attrs.el === 'parenthetical' && text === '()') {
    tr.delete($p.start(), $p.end());
  }
  view.dispatch(tr.scrollIntoView());
  return true;
}

/** Bulunulan satırdan sonra zorunlu sayfa sonu ve yeni bir sahne başlığı ekler */
export function insertPageBreak(editor: Editor): boolean {
  const { state, view } = editor;
  const $p = state.selection.$from;
  if ($p.depth < 1) return false;
  const after = $p.after(1);
  const line = state.schema.nodes.line;
  const tr = state.tr.insert(after, [line.create({ el: 'pageBreak' }), line.create({ el: 'sceneHeading' })]);
  tr.setSelection(TextSelection.create(tr.doc, after + 2 + 1));
  view.dispatch(tr.scrollIntoView());
  return true;
}

export function toggleDual(editor: Editor): boolean {
  const { state, view } = editor;
  const $p = state.selection.$from;
  const block = $p.parent;
  if (block.type.name !== 'line' || block.attrs.el !== 'character') return false;
  view.dispatch(state.tr.setNodeMarkup($p.before(), undefined, { ...block.attrs, dual: !block.attrs.dual }));
  return true;
}

function acceptGhost(editor: Editor): boolean {
  const g = ghostKey.getState(editor.state);
  if (!g?.text) return false;
  editor.view.dispatch(editor.state.tr.insertText(g.text, g.pos));
  return true;
}

function handleEnter(editor: Editor): boolean {
  acceptGhost(editor);
  const { state, view } = editor;
  if (!state.selection.empty) {
    view.dispatch(state.tr.deleteSelection());
    return handleEnter(editor);
  }
  const $p = state.selection.$from;
  const block = $p.parent;
  if (block.type.name !== 'line') return false;
  const el = block.attrs.el as El;
  const lineType = state.schema.nodes.line;

  if (el === 'pageBreak') {
    const after = $p.after();
    const tr = state.tr.insert(after, lineType.create({ el: 'sceneHeading' }));
    tr.setSelection(TextSelection.create(tr.doc, after + 1));
    view.dispatch(tr.scrollIntoView());
    return true;
  }
  if (block.content.size === 0 || (el === 'parenthetical' && block.textContent === '()')) {
    return setElement(editor, EMPTY_ENTER[el]);
  }
  const atEnd = $p.pos === $p.end() || el === 'parenthetical';
  const tr = state.tr;
  if (atEnd) {
    const after = $p.after();
    // kapanmamış işaretler yeni satıra taşmasın
    tr.insert(after, lineType.create({ el: NEXT_ON_ENTER[el] }));
    tr.setSelection(TextSelection.create(tr.doc, after + 1));
    tr.setStoredMarks([]);
  } else {
    tr.split($p.pos, 1, [{ type: lineType, attrs: { el } }]);
  }
  view.dispatch(tr.scrollIntoView());
  return true;
}

export function toggleMarkOnSelection(editor: Editor, name: 'note' | 'omit'): boolean {
  const { state, view } = editor;
  const type = state.schema.marks[name];
  let { from, to } = state.selection;
  if (from === to) {
    // seçim yoksa satırın tamamı
    const $p = state.selection.$from;
    from = $p.start();
    to = $p.end();
  }
  if (from === to) {
    // boş satır: not yaz
    if (name === 'note') {
      const tr = state.tr.insertText('not', from);
      tr.addMark(from, from + 3, type.create());
      tr.setSelection(TextSelection.create(tr.doc, from, from + 3));
      view.dispatch(tr);
      return true;
    }
    return false;
  }
  const has = state.doc.rangeHasMark(from, to, type);
  view.dispatch(has ? state.tr.removeMark(from, to, type) : state.tr.addMark(from, to, type.create()));
  return true;
}

export const ScreenplayKeys = Extension.create<ScreenplayOptions>({
  name: 'screenplayKeys',
  priority: 1000,
  addOptions() {
    return {
      known: () => ({ names: [], headings: [] }),
      revision: () => ({ on: false, gen: 1 }),
    };
  },
  addKeyboardShortcuts() {
    const el = () => this.editor.state.selection.$from.parent.attrs.el as El | undefined;
    const map: Record<string, () => boolean> = {
      Enter: () => handleEnter(this.editor),
      'Shift-Enter': () => this.editor.commands.insertContent({ type: 'hardBreak' }),
      Tab: () => {
        const e = el();
        return e ? setElement(this.editor, TAB_NEXT[e]) : false;
      },
      'Shift-Tab': () => {
        const e = el();
        return e ? setElement(this.editor, SHIFT_TAB_NEXT[e]) : false;
      },
      Backspace: () => {
        const r = this.options.revision();
        return r.on ? revDelete(this.editor, -1, r.gen) : false;
      },
      Delete: () => {
        const r = this.options.revision();
        return r.on ? revDelete(this.editor, 1, r.gen) : false;
      },
      ArrowRight: () => acceptGhost(this.editor),
      End: () => acceptGhost(this.editor),
      'Mod-d': () => toggleDual(this.editor),
      'Mod-Shift-m': () => toggleMarkOnSelection(this.editor, 'note'),
      'Mod-Enter': () => insertPageBreak(this.editor),
      'Mod-/': () => toggleMarkOnSelection(this.editor, 'omit'),
    };
    CORE.forEach((e, i) => (map[`Mod-${i + 1}`] = () => setElement(this.editor, e)));
    // Ctrl+7 ortalı, Ctrl+8 şarkı, Ctrl+9 bölüm (sayfa sonu: Ctrl+Enter)
    EXTRA.slice(0, 3).forEach((e, i) => (map[`Mod-${i + 7}`] = () => setElement(this.editor, e)));
    return map;
  },
  addProseMirrorPlugins() {
    const opts = this.options;
    const revKey = new PluginKey('sp-rev');
    return [
      new Plugin<GhostState>({
        key: ghostKey,
        state: {
          init: (_, s) => computeGhost(s, opts),
          apply: (_tr, _v, _old, s) => computeGhost(s, opts),
        },
        props: {
          decorations(state) {
            const g = ghostKey.getState(state);
            if (!g?.text) return null;
            const span = document.createElement('span');
            span.className = 'sp-ghost';
            span.textContent = g.text;
            return DecorationSet.create(state.doc, [Decoration.widget(g.pos, span, { side: 1, key: `g-${g.text}` })]);
          },
          handleTextInput(view, from, to, text) {
            const $p = view.state.doc.resolve(from);
            const block = $p.parent;
            if (block.type.name !== 'line') return false;
            const el = block.attrs.el as El;
            if (el === 'pageBreak') return true;
            // revizyon modunda seçili eski metnin üstüne yazmak: eskisi silinmeye aday, yenisi revizyon
            const rv = opts.revision();
            if (rv.on && from !== to) {
              const tr = markDeletion(view.state, from, to, rv.gen);
              const at = tr.mapping.map(to, 1);
              tr.insertText(text, at);
              tr.removeMark(at, at + text.length, view.state.schema.marks.del);
              tr.addMark(at, at + text.length, view.state.schema.marks.rev.create({ gen: rv.gen }));
              tr.setSelection(TextSelection.create(tr.doc, at + text.length));
              view.dispatch(tr);
              return true;
            }
            if (text === '(' && block.content.size === 0 && el === 'dialogue') {
              const tr = view.state.tr.setNodeMarkup($p.before(), undefined, { ...block.attrs, el: 'parenthetical' });
              tr.insertText('()', from);
              tr.setSelection(TextSelection.create(tr.doc, from + 1));
              view.dispatch(tr);
              return true;
            }
            if (text === ')' && from === to && view.state.doc.textBetween(from, from + 1) === ')') {
              view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from + 1)));
              return true;
            }
            return false;
          },
        },
        appendTransaction(trs, _old, state) {
          if (!trs.some((t) => t.docChanged)) return null;
          const tr = state.tr;
          let changed = false;
          // 1) Eleman algılama (imleçteki satır)
          const $p = state.selection.$from;
          const block = $p.parent;
          if (block.type.name === 'line' && $p.depth === 1) {
            const idx = $p.index(0);
            const prev = idx > 0 ? (state.doc.child(idx - 1).attrs.el as El) : null;
            const el = block.attrs.el as El;
            const next = detectElement(block.textContent, el, prev);
            if (next !== el) {
              tr.setNodeMarkup($p.before(), undefined, { ...block.attrs, el: next });
              const text = block.textContent;
              // işaret karakterlerini temizle
              const start = $p.start();
              if (next === 'section') tr.delete(start, start + 2);
              if (next === 'centered') {
                tr.delete(start + text.length - 1, start + text.length);
                tr.delete(start, start + 1);
              }
              if (next === 'lyrics') tr.delete(start, start + 1);
              if (next === 'pageBreak') tr.delete(start, start + text.length);
              changed = true;
            }
          }
          // 2) Sahne kimlikleri: her başlığın benzersiz sid'i olsun
          const seen = new Set<string>();
          tr.doc.forEach((n, pos) => {
            if (n.attrs.el === 'sceneHeading') {
              if (!n.attrs.sid || seen.has(n.attrs.sid)) {
                tr.setNodeMarkup(pos, undefined, { ...n.attrs, sid: newSid(), num: seen.has(n.attrs.sid) ? null : n.attrs.num });
                changed = true;
              } else seen.add(n.attrs.sid);
            } else if (n.attrs.sid || n.attrs.num) {
              tr.setNodeMarkup(pos, undefined, { ...n.attrs, sid: null, num: null });
              changed = true;
            }
          });
          return changed ? tr : null;
        },
      }),
      // Revizyon modu: yeni yazılan metni işaretle
      new Plugin({
        key: revKey,
        appendTransaction(trs: readonly Transaction[], _old, state) {
          const { on, gen } = opts.revision();
          if (!on) return null;
          const type = state.schema.marks.rev;
          const tr = state.tr;
          let any = false;
          trs.forEach((t, ti) => {
            if (!t.docChanged || t.getMeta('history$') || t.getMeta('skipRev')) return;
            t.mapping.maps.forEach((map, i) => {
              map.forEach((_os, _oe, ns, ne) => {
                if (ne <= ns) return;
                // önce bu işlemin kalan adımları, sonra sonraki işlemler üzerinden son belgeye eşle
                let from = t.mapping.slice(i + 1).map(ns, -1);
                let to = t.mapping.slice(i + 1).map(ne, 1);
                for (const later of trs.slice(ti + 1)) {
                  from = later.mapping.map(from, -1);
                  to = later.mapping.map(to, 1);
                }
                to = Math.min(to, tr.doc.content.size);
                if (to > from) {
                  tr.addMark(from, to, type.create({ gen }));
                  any = true;
                }
              });
            });
          });
          if (!any) return null;
          tr.setMeta('skipRev', true);
          tr.setMeta('addToHistory', false);
          return tr;
        },
      }),
    ];
  },
});

export const SCREENPLAY_PLACEHOLDER: Record<El, string> = {
  sceneHeading: 'İç. Mekan - Gündüz',
  action: 'Ne görüyoruz?',
  character: 'Karakter',
  parenthetical: '',
  dialogue: 'Ne diyor?',
  transition: 'Kesme:',
  centered: 'Ortalı metin',
  lyrics: 'Şarkı sözü',
  section: 'Bölüm adı (basılmaz)',
  pageBreak: '',
};
