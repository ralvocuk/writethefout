/** Bul ve değiştir: Türkçe büyük/küçük harf duyarsız arama (İ/i, I/ı doğru eşleşir). */
import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface SearchState {
  query: string;
  matchCase: boolean;
  matches: { from: number; to: number }[];
  current: number;
}

export const searchKey = new PluginKey<SearchState>('sp-search');

const fold = (s: string, matchCase: boolean) => (matchCase ? s : s.toLocaleLowerCase('tr-TR'));

export function findMatches(state: EditorState, query: string, matchCase: boolean) {
  const out: { from: number; to: number }[] = [];
  if (!query) return out;
  const q = fold(query, matchCase);
  state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // blok metnini konumlarıyla birlikte topla
    let text = '';
    const at: number[] = [];
    node.forEach((child, offset) => {
      if (child.isText) {
        for (let k = 0; k < child.text!.length; k++) at.push(pos + 1 + offset + k);
        text += child.text;
      } else {
        at.push(pos + 1 + offset);
        text += '\n';
      }
    });
    const hay = fold(text, matchCase);
    let i = hay.indexOf(q);
    while (i !== -1) {
      out.push({ from: at[i], to: at[i + q.length - 1] + 1 });
      i = hay.indexOf(q, i + Math.max(1, q.length));
    }
    return false;
  });
  return out;
}

export const Search = Extension.create({
  name: 'search',
  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ query: '', matchCase: false, matches: [], current: -1 }),
          apply(tr, v, _old, state) {
            const meta = tr.getMeta(searchKey) as Partial<SearchState> | undefined;
            if (!meta && !tr.docChanged) return v;
            const next = { ...v, ...meta };
            if (meta?.query !== undefined || meta?.matchCase !== undefined || tr.docChanged) {
              next.matches = findMatches(state, next.query, next.matchCase);
              if (next.current >= next.matches.length) next.current = next.matches.length - 1;
              if (next.current < 0 && next.matches.length) next.current = 0;
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            const s = searchKey.getState(state);
            if (!s?.matches.length) return null;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === s.current ? 'find-hit current' : 'find-hit' })),
            );
          },
        },
      }),
    ];
  },
});

export function setSearch(editor: Editor, patch: Partial<SearchState>) {
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, patch));
}

export function gotoMatch(editor: Editor, dir: 1 | -1) {
  const s = searchKey.getState(editor.state);
  if (!s?.matches.length) return;
  const cur = (s.current + dir + s.matches.length) % s.matches.length;
  const m = s.matches[cur];
  const tr = editor.state.tr.setMeta(searchKey, { current: cur }).setSelection(TextSelection.create(editor.state.doc, m.from, m.to));
  editor.view.dispatch(tr.scrollIntoView());
}

export function replaceCurrent(editor: Editor, text: string) {
  const s = searchKey.getState(editor.state);
  if (!s || s.current < 0 || !s.matches[s.current]) return;
  const m = s.matches[s.current];
  editor.view.dispatch(editor.state.tr.insertText(text, m.from, m.to));
  gotoMatch(editor, 1);
}

export function replaceAll(editor: Editor, text: string): number {
  const s = searchKey.getState(editor.state);
  if (!s?.matches.length) return 0;
  const tr = editor.state.tr;
  // sondan başa: konumlar kaymasın
  for (const m of [...s.matches].reverse()) tr.insertText(text, m.from, m.to);
  editor.view.dispatch(tr);
  return s.matches.length;
}
