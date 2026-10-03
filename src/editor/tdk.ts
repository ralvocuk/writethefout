/**
 * TDK yazım önerisi editörde: yazmayı bıraktığın kelime TDK'ya göre farklı yazılıyorsa
 * altında küçük bir öneri balonu çıkar ("mekân  ↵"). Enter kabul eder, Esc ya da yazmaya devam etmek kapatır.
 * Daha önce bulunan öneriler belgede noktalı mavi çizgiyle gösterilir (sağ tıkla düzeltilir).
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { cachedSuggestion, eligible, suggestionFor } from '../spell/tdk';
import { WORD_RE } from '../spell/engine';

export interface TdkPending {
  from: number;
  to: number;
  word: string;
  suggestion: string;
}

interface TdkState {
  pending: TdkPending | null;
  /** önbellekten gelen öneri işaretleri */
  marks: DecorationSet;
}

export const tdkKey = new PluginKey<TdkState>('wtf-tdk');

const SKIP_EL = new Set(['character', 'pageBreak', 'section']);

/** İmlecin hemen solundaki kelime (imleç kelimenin sonundaysa) */
export function wordBeforeCursor(state: EditorState): { from: number; to: number; word: string } | null {
  const sel = state.selection;
  if (!sel.empty) return null;
  const $p = sel.$from;
  if (SKIP_EL.has($p.parent.attrs.el)) return null;
  const text = $p.parent.textBetween(0, $p.parent.content.size, '\n', ' ');
  const off = $p.parentOffset;
  if (off < text.length && /[\p{L}]/u.test(text[off])) return null;
  let start = off;
  while (start > 0 && /[\p{L}]/u.test(text[start - 1])) start--;
  if (off - start < 3) return null;
  const base = $p.start();
  return { from: base + start, to: base + off, word: text.slice(start, off) };
}

/** Belgede önbellekte önerisi olan kelimeler */
function cachedMarks(state: EditorState): DecorationSet {
  const decos: Decoration[] = [];
  state.doc.forEach((block, pos) => {
    if (SKIP_EL.has(block.attrs.el)) return;
    const text = block.textBetween(0, block.content.size, '\n', ' ');
    for (const m of text.matchAll(WORD_RE)) {
      const w = m[0];
      if (!eligible(w)) continue;
      const sug = cachedSuggestion(w);
      if (!sug) continue;
      const from = pos + 1 + m.index!;
      decos.push(Decoration.inline(from, from + w.length, { class: 'tdk-sug', title: `TDK: ${sug}` }, { tdk: sug, word: w }));
    }
  });
  return DecorationSet.create(state.doc, decos);
}

function bubble(p: TdkPending, hint: string) {
  return () => {
    const el = document.createElement('span');
    el.className = 'tdk-bubble';
    el.contentEditable = 'false';
    el.setAttribute('role', 'status');
    const b = document.createElement('b');
    b.textContent = p.suggestion;
    const k = document.createElement('span');
    k.className = 'kbd';
    k.textContent = '↵';
    const s = document.createElement('small');
    s.textContent = hint;
    el.append(s, b, k);
    return el;
  };
}

export const TdkSuggest = Extension.create<{ enabled: () => boolean; hint: () => string }>({
  name: 'tdkSuggest',
  // Enter'ı senaryo tuş akışından önce yakalamalı
  priority: 1100,
  addOptions() {
    return { enabled: () => false, hint: () => 'TDK' };
  },
  addProseMirrorPlugins() {
    const { enabled, hint } = this.options;
    return [
      new Plugin<TdkState>({
        key: tdkKey,
        state: {
          init: (_c, state) => ({ pending: null, marks: enabled() ? cachedMarks(state) : DecorationSet.empty }),
          apply(tr, v) {
            const meta = tr.getMeta(tdkKey) as Partial<TdkState> | undefined;
            let next = v;
            if (tr.docChanged) next = { pending: null, marks: next.marks.map(tr.mapping, tr.doc) };
            else if (tr.selectionSet && next.pending) next = { ...next, pending: null };
            if (meta) next = { ...next, ...meta };
            return next;
          },
        },
        props: {
          decorations(state) {
            const s = tdkKey.getState(state);
            if (!s) return null;
            if (!s.pending) return s.marks;
            return s.marks.add(state.doc, [
              Decoration.inline(s.pending.from, s.pending.to, { class: 'tdk-target' }),
              Decoration.widget(s.pending.to, bubble(s.pending, hint()), { side: 1, key: `tdk-${s.pending.suggestion}`, ignoreSelection: true }),
            ]);
          },
          handleKeyDown(view, e) {
            const s = tdkKey.getState(view.state);
            if (!s?.pending) return false;
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
              const p = s.pending;
              const cur = view.state.doc.textBetween(p.from, p.to);
              if (cur === p.word) {
                view.dispatch(view.state.tr.insertText(p.suggestion, p.from, p.to).setMeta(tdkKey, { pending: null }));
                return true;
              }
            }
            if (e.key === 'Escape') {
              view.dispatch(view.state.tr.setMeta(tdkKey, { pending: null }));
              return true;
            }
            return false;
          },
        },
        view(view: EditorView) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          let ticket = 0;
          const check = () => {
            if (view.isDestroyed || !enabled() || !view.hasFocus()) return;
            const w = wordBeforeCursor(view.state);
            if (!w || !eligible(w.word)) return;
            const my = ++ticket;
            suggestionFor(w.word)
              .then((sug) => {
                if (my !== ticket || view.isDestroyed || !sug || sug === w.word) return;
                const now = wordBeforeCursor(view.state);
                if (!now || now.from !== w.from || now.word !== w.word) return;
                view.dispatch(
                  view.state.tr
                    .setMeta(tdkKey, { pending: { ...w, suggestion: sug }, marks: cachedMarks(view.state) })
                    .setMeta('addToHistory', false),
                );
              })
              .catch(() => {});
          };
          return {
            update(v, prev) {
              if (v.state.doc.eq(prev.doc) && v.state.selection.eq(prev.selection)) return;
              ticket++;
              clearTimeout(timer);
              if (!v.state.doc.eq(prev.doc)) timer = setTimeout(check, 450);
            },
            destroy() {
              clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});

/** Konumdaki TDK işareti (sağ tık menüsü için) */
export function tdkAt(state: EditorState, pos: number): { from: number; to: number; word: string; suggestion: string } | null {
  const s = tdkKey.getState(state);
  const found = s?.marks.find(pos, pos, (spec) => !!spec.tdk) ?? [];
  const d = found[0];
  return d ? { from: d.from, to: d.to, word: d.spec.word, suggestion: d.spec.tdk } : null;
}
