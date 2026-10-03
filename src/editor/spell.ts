/** Yazım denetimi: hatalı kelimelerin altını çizer (dalgalı kırmızı), imlecin üstündeki kelimeyi rahat bırakır. */
import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { WORD_RE } from '../spell/engine';
import { spell } from '../spell/client';

export const spellKey = new PluginKey<DecorationSet>('wtf-spell');

/** Denetlenmeyen satırlar ve işaretler */
const SKIP_EL = new Set(['character', 'pageBreak']);
const SKIP_MARKS = new Set(['omit', 'del']);

export interface SpellHit {
  from: number;
  to: number;
  word: string;
}

/** Belgedeki hatalı kelimeler; `pending` bilinmeyenleri toplar */
export function scanErrors(state: EditorState, skipAt: number | null, pending: Set<string>): SpellHit[] {
  const out: SpellHit[] = [];
  state.doc.forEach((block, pos) => {
    if (SKIP_EL.has(block.attrs.el)) return;
    let text = '';
    const at: number[] = [];
    block.forEach((child, offset) => {
      const p = pos + 1 + offset;
      if (child.isText && !child.marks.some((m) => SKIP_MARKS.has(m.type.name))) {
        for (let k = 0; k < child.text!.length; k++) at.push(p + k);
        text += child.text;
      } else {
        const n = child.isText ? child.text!.length : 1;
        for (let k = 0; k < n; k++) at.push(p + k);
        text += ' '.repeat(n);
      }
    });
    for (const m of text.matchAll(WORD_RE)) {
      const word = m[0];
      const from = at[m.index!];
      const to = at[m.index! + word.length - 1] + 1;
      if (skipAt !== null && skipAt >= from && skipAt <= to) continue;
      const wrong = spell.isWrong(word);
      if (wrong === undefined) pending.add(word);
      else if (wrong) out.push({ from, to, word });
    }
  });
  return out;
}

const buildSet = (state: EditorState, hits: SpellHit[]) =>
  DecorationSet.create(
    state.doc,
    hits.map((h) => Decoration.inline(h.from, h.to, { class: 'spell-err', 'data-word': h.word }, { word: h.word })),
  );

export const SpellCheck = Extension.create<{ enabled: () => boolean }>({
  name: 'spellcheck',
  addOptions() {
    return { enabled: () => true };
  },
  addProseMirrorPlugins() {
    const enabled = this.options.enabled;
    return [
      new Plugin<DecorationSet>({
        key: spellKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(spellKey) as DecorationSet | undefined;
            if (meta) return meta;
            return tr.docChanged ? set.map(tr.mapping, tr.doc) : set;
          },
        },
        props: {
          decorations: (state) => spellKey.getState(state),
        },
        view(view: EditorView) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          let lastSkip: number | null = null;
          const run = () => {
            if (view.isDestroyed) return;
            if (!enabled()) {
              if (spellKey.getState(view.state) !== DecorationSet.empty) view.dispatch(view.state.tr.setMeta(spellKey, DecorationSet.empty).setMeta('addToHistory', false));
              return;
            }
            spell.start();
            const sel = view.state.selection;
            // yazılmakta olan kelimeye dokunma
            lastSkip = sel.empty && view.hasFocus() ? sel.from : null;
            const pending = new Set<string>();
            const hits = scanErrors(view.state, lastSkip, pending);
            if (pending.size) spell.request([...pending]);
            view.dispatch(view.state.tr.setMeta(spellKey, buildSet(view.state, hits)).setMeta('addToHistory', false));
          };
          const schedule = (ms = 350) => {
            clearTimeout(timer);
            timer = setTimeout(run, ms);
          };
          const unsub = spell.subscribe(() => schedule(30));
          schedule(50);
          return {
            update(v, prev) {
              if (!v.state.doc.eq(prev.doc)) schedule();
              else if (lastSkip !== null && !v.state.selection.eq(prev.selection)) {
                // imleç kelimeden çıktıysa o kelimeyi de denetle
                const s = v.state.selection;
                const $a = v.state.doc.resolve(Math.min(lastSkip, v.state.doc.content.size));
                const $s = s.$from;
                if (!s.empty || $a.parent !== $s.parent || Math.abs(s.from - lastSkip) > 1) schedule(150);
              }
            },
            destroy() {
              clearTimeout(timer);
              unsub();
            },
          };
        },
      }),
    ];
  },
});

/** Konumdaki hata (sağ tık menüsü için) */
export function errorAt(state: EditorState, pos: number): SpellHit | null {
  const set = spellKey.getState(state);
  const found = set?.find(pos, pos, (spec) => !!spec.word) ?? [];
  const d = found[0];
  return d ? { from: d.from, to: d.to, word: d.spec.word } : null;
}

/** Sıradaki yazım hatasına git (F8) */
export function gotoNextError(editor: Editor): boolean {
  const set = spellKey.getState(editor.state);
  const all = (set?.find() ?? []).sort((a, b) => a.from - b.from);
  if (!all.length) return false;
  const here = editor.state.selection.to;
  const next = all.find((d) => d.from >= here) ?? all[0];
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, next.from, next.to)).scrollIntoView());
  editor.view.focus();
  return true;
}

/** Bir hatayı öneriyle değiştir */
export function replaceWord(editor: Editor, hit: SpellHit, text: string) {
  editor.view.dispatch(editor.state.tr.insertText(text, hit.from, hit.to));
  editor.view.focus();
}

/** Sayım (durum çubuğu) */
export function errorCount(state: EditorState): number {
  return spellKey.getState(state)?.find().length ?? 0;
}
