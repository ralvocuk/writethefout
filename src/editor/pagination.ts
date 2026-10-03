/**
 * Canlı sayfalama: PDF ile aynı motoru kullanarak editörde sayfa sonlarını,
 * sayfa numaralarını ve sahne numaralarını gösterir.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { blocksFromNode } from '../script/blocks';
import { numberScenes, paginate, type Lang, type Paper } from '../export/layout';

export interface PaginationOptions {
  settings: () => { paper: Paper; lang: Lang };
  onLayout?: (info: { pages: number; starts: number[] }) => void;
}

interface PState {
  deco: DecorationSet;
  starts: number[];
}

export const paginationKey = new PluginKey<PState>('sp-pages');

export function computeLayout(state: EditorState, paper: Paper, lang: Lang) {
  const doc = state.doc;
  const offsets: number[] = [];
  doc.forEach((_n, offset) => offsets.push(offset));
  const blocks = numberScenes(blocksFromNode(doc));
  const pages = paginate(blocks, { paper, lang, sceneNumbers: true, headingSpace: 2 });

  const decos: Decoration[] = [];
  const starts: number[] = [0];
  for (const p of pages) {
    if (p.number === 1) continue;
    const first = p.lines.find((l) => l?.src);
    if (!first?.src) continue;
    const b = blocks[first.src.b];
    const blockPos = offsets[first.src.b];
    const inner = b.map && first.src.o < b.map.length ? b.map[first.src.o] : 0;
    // satırın başındaysa blokların arasına (sütun girintisinden bağımsız), değilse satır içine
    const pos = inner === 0 ? blockPos : blockPos + 1 + inner;
    starts.push(pos);
    const contd = p.lines[0] && !p.lines[0].src ? p.lines[0].runs.map((r) => r.text).join('') : '';
    decos.push(
      Decoration.widget(
        pos,
        () => {
          const el = document.createElement('span');
          el.className = 'pg-break';
          el.contentEditable = 'false';
          el.dataset.page = `${p.number}.`;
          if (contd) el.dataset.contd = contd;
          return el;
        },
        { side: -1, key: `pg-${p.number}-${pos}-${contd}`, ignoreSelection: true },
      ),
    );
  }
  // Sahne numaraları
  blocks.forEach((b, i) => {
    if (b.el === 'sceneHeading' && b.sceneNo) {
      const pos = offsets[i];
      const node = doc.child(i);
      decos.push(Decoration.node(pos, pos + node.nodeSize, { 'data-num': b.sceneNo }));
    }
  });
  return { deco: DecorationSet.create(doc, decos), starts, pages: pages.length };
}

/** İmlecin bulunduğu sayfa (1'den) */
export function pageAt(state: EditorState, pos: number): number {
  const s = paginationKey.getState(state)?.starts ?? [0];
  let p = 1;
  for (let i = 0; i < s.length; i++) if (pos >= s[i]) p = i + 1;
  return p;
}

export const Pagination = Extension.create<PaginationOptions>({
  name: 'pagination',
  addOptions() {
    return { settings: () => ({ paper: 'a4' as Paper, lang: 'tr' as Lang }) };
  },
  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin<PState>({
        key: paginationKey,
        state: {
          init: (_, state) => {
            const { paper, lang } = opts.settings();
            const r = computeLayout(state, paper, lang);
            return { deco: r.deco, starts: r.starts };
          },
          apply(tr, value) {
            const fresh = tr.getMeta(paginationKey) as PState | undefined;
            if (fresh) return fresh;
            if (!tr.docChanged) return value;
            return { deco: value.deco.map(tr.mapping, tr.doc), starts: value.starts.map((s) => tr.mapping.map(s)) };
          },
        },
        props: {
          decorations: (state) => paginationKey.getState(state)?.deco,
        },
        view(view: EditorView) {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const run = () => {
            if (view.isDestroyed) return;
            const { paper, lang } = opts.settings();
            const r = computeLayout(view.state, paper, lang);
            view.dispatch(view.state.tr.setMeta(paginationKey, { deco: r.deco, starts: r.starts }).setMeta('addToHistory', false));
            opts.onLayout?.({ pages: r.pages, starts: r.starts });
          };
          setTimeout(run, 0);
          return {
            update(v, prev) {
              if (v.state.doc === prev.doc) return;
              clearTimeout(timer);
              timer = setTimeout(run, 250);
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
