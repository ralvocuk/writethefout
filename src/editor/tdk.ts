/**
 * Yazarken öneri balonu: yazmayı bıraktığın kelime için
 *  1) yazım hatası varsa en olası doğru yazım ("seyehat" → "seyahat", "herşey" → "her şey"),
 *  2) TDK'ya göre farklı yazılıyorsa düzeltme işaretli biçim ("mekan" → "mekân"),
 *  3) iki biçim de doğru ama anlamı farklıysa "bunu mu demek istediniz?" ("hala" → "hâlâ", anlamlarıyla).
 * Enter kabul eder, Esc kapatır (anlam ayrımında o kelime için bir daha sormaz), yazmaya devam etmek kapatır.
 * TDK'dan bulunan kesin öneriler belgede noktalı mavi çizgiyle görünür (sağ tıkla düzeltilir).
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { cachedSuggestion, eligible, suggestionFor } from '../spell/tdk';
import { WORD_RE } from '../spell/engine';

export type SuggestKind = 'spell' | 'tdk' | 'ambiguous';

export interface TdkPending {
  from: number;
  to: number;
  word: string;
  suggestion: string;
  kind: SuggestKind;
  meaning?: string;
  ownMeaning?: string;
}

interface TdkState {
  pending: TdkPending | null;
  /** önbellekten gelen öneri işaretleri */
  marks: DecorationSet;
}

export interface SuggestOptions {
  /** TDK önerileri açık mı (Türkçe senaryo + ayar) */
  tdk: () => boolean;
  /** yazım hatası önerileri açık mı (yazım denetimi + desteklenen dil) */
  spell: () => boolean;
  /** kelime yanlış mı (yazım denetimi) */
  isWrong: (word: string) => Promise<boolean | undefined>;
  /** yazım önerileri (en olası başta) */
  suggestions: (word: string) => Promise<string[]>;
  labels: () => { spell: string; tdk: string; ambiguous: string };
}

export const tdkKey = new PluginKey<TdkState>('wtf-tdk');

const SKIP_EL = new Set(['character', 'pageBreak', 'section']);

/** Anlam ayrımında Esc ile reddedilen kelimeler (kalıcı) ve bu oturumda zaten sorulanlar */
const DISMISS_KEY = 'wtf.tdk.dismissed';
const dismissed = new Set<string>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]') as string[];
    } catch {
      return [];
    }
  })(),
);
const askedThisSession = new Set<string>();
const lowerTr = (s: string) => s.toLocaleLowerCase('tr-TR');
function dismissForever(word: string) {
  dismissed.add(lowerTr(word));
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]));
  } catch {
    /* yok say */
  }
}

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

/** Belgede önbellekte kesin TDK önerisi olan kelimeler */
function cachedMarks(state: EditorState): DecorationSet {
  const decos: Decoration[] = [];
  state.doc.forEach((block, pos) => {
    if (SKIP_EL.has(block.attrs.el)) return;
    const text = block.textBetween(0, block.content.size, '\n', ' ');
    for (const m of text.matchAll(WORD_RE)) {
      const w = m[0];
      if (!eligible(w)) continue;
      const sug = cachedSuggestion(w);
      if (!sug || sug.ambiguous) continue;
      const from = pos + 1 + m.index!;
      decos.push(Decoration.inline(from, from + w.length, { class: 'tdk-sug', title: `TDK: ${sug.text}` }, { tdk: sug.text, word: w }));
    }
  });
  return DecorationSet.create(state.doc, decos);
}

function bubble(p: TdkPending, label: string) {
  return () => {
    const el = document.createElement('span');
    el.className = `tdk-bubble ${p.kind}`;
    el.contentEditable = 'false';
    el.setAttribute('role', 'status');
    const head = document.createElement('span');
    head.className = 'tdk-head';
    const s = document.createElement('small');
    s.textContent = label;
    const b = document.createElement('b');
    b.textContent = p.suggestion;
    const k = document.createElement('span');
    k.className = 'kbd';
    k.textContent = '↵';
    head.append(s, b, k);
    el.append(head);
    if (p.meaning || p.ownMeaning) {
      const m = document.createElement('span');
      m.className = 'tdk-meaning';
      if (p.meaning) {
        const a = document.createElement('span');
        a.append(Object.assign(document.createElement('i'), { textContent: p.suggestion }), document.createTextNode(`: ${p.meaning}`));
        m.append(a);
      }
      if (p.ownMeaning) {
        const o = document.createElement('span');
        o.append(Object.assign(document.createElement('i'), { textContent: p.word }), document.createTextNode(`: ${p.ownMeaning}`));
        m.append(o);
      }
      el.append(m);
    }
    return el;
  };
}

export const TdkSuggest = Extension.create<SuggestOptions>({
  name: 'tdkSuggest',
  // Enter'ı senaryo tuş akışından önce yakalamalı
  priority: 1100,
  addOptions() {
    return {
      tdk: () => false,
      spell: () => false,
      isWrong: async () => undefined,
      suggestions: async () => [],
      labels: () => ({ spell: 'Yazım', tdk: 'TDK', ambiguous: '?' }),
    };
  },
  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin<TdkState>({
        key: tdkKey,
        state: {
          init: (_c, state) => ({ pending: null, marks: opts.tdk() ? cachedMarks(state) : DecorationSet.empty }),
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
            const l = opts.labels();
            return s.marks.add(state.doc, [
              Decoration.inline(s.pending.from, s.pending.to, { class: `tdk-target ${s.pending.kind}` }),
              Decoration.widget(s.pending.to, bubble(s.pending, l[s.pending.kind]), {
                side: 1,
                key: `tdk-${s.pending.kind}-${s.pending.suggestion}`,
                ignoreSelection: true,
              }),
            ]);
          },
          handleKeyDown(view, e) {
            const s = tdkKey.getState(view.state);
            if (!s?.pending) return false;
            const p = s.pending;
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
              const cur = view.state.doc.textBetween(p.from, p.to);
              if (cur === p.word) {
                view.dispatch(view.state.tr.insertText(p.suggestion, p.from, p.to).setMeta(tdkKey, { pending: null }));
                return true;
              }
            }
            if (e.key === 'Escape') {
              if (p.kind === 'ambiguous') dismissForever(p.word);
              view.dispatch(view.state.tr.setMeta(tdkKey, { pending: null }));
              return true;
            }
            return false;
          },
        },
        view(view: EditorView) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          let ticket = 0;

          const show = (w: { from: number; to: number; word: string }, p: Omit<TdkPending, 'from' | 'to' | 'word'>, my: number) => {
            if (my !== ticket || view.isDestroyed || p.suggestion === w.word) return;
            const now = wordBeforeCursor(view.state);
            if (!now || now.from !== w.from || now.word !== w.word) return;
            view.dispatch(
              view.state.tr
                .setMeta(tdkKey, { pending: { ...w, ...p }, marks: opts.tdk() ? cachedMarks(view.state) : DecorationSet.empty })
                .setMeta('addToHistory', false),
            );
          };

          const check = async () => {
            if (view.isDestroyed || !view.hasFocus()) return;
            const w = wordBeforeCursor(view.state);
            if (!w) return;
            const my = ++ticket;
            try {
              // 1) yazım hatası
              if (opts.spell()) {
                const wrong = await opts.isWrong(w.word);
                if (my !== ticket) return;
                if (wrong) {
                  const list = await opts.suggestions(w.word);
                  if (list[0]) show(w, { suggestion: list[0], kind: 'spell' }, my);
                  return;
                }
              }
              // 2) TDK: düzeltme işareti ve anlam ayrımı
              if (!opts.tdk() || !eligible(w.word)) return;
              const sug = await suggestionFor(w.word);
              if (!sug || my !== ticket) return;
              const key = lowerTr(w.word);
              if (sug.ambiguous) {
                if (dismissed.has(key) || askedThisSession.has(key)) return;
                askedThisSession.add(key);
                show(w, { suggestion: sug.text, kind: 'ambiguous', meaning: sug.meaning, ownMeaning: sug.ownMeaning }, my);
              } else show(w, { suggestion: sug.text, kind: 'tdk', meaning: sug.meaning }, my);
            } catch {
              /* çevrimdışı ya da sözlük hazır değil */
            }
          };

          return {
            update(v, prev) {
              if (v.state.doc.eq(prev.doc) && v.state.selection.eq(prev.selection)) return;
              ticket++;
              clearTimeout(timer);
              if (!v.state.doc.eq(prev.doc)) timer = setTimeout(() => void check(), 450);
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

/** Testler için */
export function _resetSuggest() {
  dismissed.clear();
  askedThisSession.clear();
}
