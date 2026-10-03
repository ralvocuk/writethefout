import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Focus, Placeholder } from '@tiptap/extensions';
import { TextSelection } from '@tiptap/pm/state';
import { create } from 'zustand';
import { editorBridge, useStore } from '../store/useStore';
import {
  Line,
  NoteMark,
  OmitMark,
  RevMark,
  DelMark,
  SCREENPLAY_PLACEHOLDER,
  ScreenplayDocument,
  ScreenplayKeys,
  TagMark,
} from '../editor/screenplay';
import { Pagination, pageAt } from '../editor/pagination';
import { SpellCheck, errorAt, replaceWord, type SpellHit } from '../editor/spell';
import { TdkSuggest, tdkAt } from '../editor/tdk';
import { spell } from '../spell/client';
import { locale, t } from '../i18n';
import { scriptLabels } from '../export/layout';
import { Search, gotoMatch, replaceAll, replaceCurrent, searchKey, setSearch } from '../editor/search';
import { EL_LABEL, TAG_CATS, formatEighths, formatNumber, type El } from '../script/elements';

/** İmlecin bulunduğu eleman (durum çubuğu için) */
export const useCaret = create<{ el: El | null }>(() => ({ el: null }));
/** Etkin editör (kısa yollar ve komutlar için) */
export const activeEditor: { current: Editor | null } = { current: null };

export function ScriptEditor() {
  const script = useStore((s) => s.script);
  const revision = useStore((s) => s.revision);
  const paper = useStore((s) => s.settings.paper);
  const lang = useStore((s) => s.settings.lang);
  if (!script) return null;
  return <EditorInner key={`${revision}:${paper}:${lang}`} />;
}

function EditorInner() {
  const saveScript = useStore((s) => s.saveScript);
  const setCursor = useStore((s) => s.setCursor);
  const stamp = useStore((s) => s.stamp);
  const title = useStore((s) => s.title);
  const settings = useStore((s) => s.settings);
  const zoom = useStore((s) => s.zoom);
  const model = useStore((s) => s.model);
  const sheetRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pending = useRef<Editor | null>(null);
  const [flag, setFlag] = useState<{ el: El; top: number; num: boolean } | null>(null);
  const [tagMenu, setTagMenu] = useState<{ x: number; y: number } | null>(null);
  const [spellMenu, setSpellMenu] = useState<{ x: number; y: number; hit: SpellHit; options: string[] | null; tdk?: string } | null>(null);
  const spellOn = useStore((s) => s.spellOn);
  const initial = useMemo(() => {
    const d = useStore.getState().script;
    return d ? JSON.parse(d) : undefined;
  }, []);

  const flush = () => {
    clearTimeout(timer.current);
    const ed = pending.current;
    if (!ed || ed.isDestroyed) return;
    pending.current = null;
    saveScript(JSON.stringify(ed.getJSON()), ed.getText({ blockSeparator: '\n' }));
  };

  const track = (ed: Editor) => {
    if (ed.isDestroyed || !ed.view.dom.isConnected) return;
    const { $from } = ed.state.selection;
    if ($from.depth < 1) return;
    const idx = $from.index(0);
    const block = ed.state.doc.child(idx);
    const el = (block.attrs.el as El) ?? 'action';
    useCaret.setState({ el });
    let sid: string | null = null;
    for (let i = idx; i >= 0; i--) {
      const n = ed.state.doc.child(i);
      if (n.attrs.el === 'sceneHeading') {
        sid = n.attrs.sid;
        break;
      }
    }
    const total = (ed.view.dom.querySelectorAll('.pg-break').length || 0) + 1;
    setCursor(sid, { current: pageAt(ed.state, $from.pos), total });
    const dom = ed.view.nodeDOM($from.before(1)) as HTMLElement | null;
    const sheet = sheetRef.current;
    const z = useStore.getState().zoom || 1;
    if (dom && sheet) setFlag({ el, top: (dom.getBoundingClientRect().top - sheet.getBoundingClientRect().top) / z + 3, num: dom.hasAttribute('data-num') });
  };

  const typewriter = (ed: Editor) => {
    if (!useStore.getState().focus || ed.isDestroyed) return;
    const scroller = sheetRef.current?.closest('.center') as HTMLElement | null;
    if (!scroller) return;
    const c = ed.view.coordsAtPos(ed.state.selection.from);
    const box = scroller.getBoundingClientRect();
    scroller.scrollBy({ top: c.top - (box.top + box.height * 0.42), behavior: 'smooth' });
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        document: false,
        paragraph: false,
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        link: false,
        trailingNode: false,
        strike: false,
      }),
      ScreenplayDocument,
      Line,
      NoteMark,
      OmitMark,
      TagMark,
      RevMark,
      DelMark,
      Search,
      TdkSuggest.configure({
        enabled: () => useStore.getState().tdkOn && useStore.getState().settings.lang === 'tr',
        hint: () => t('TDK yazımı'),
      }),
      SpellCheck.configure({ enabled: () => useStore.getState().spellOn && spell.supports(useStore.getState().settings.lang) }),
      ScreenplayKeys.configure({
        known: () => {
          const m = useStore.getState().model;
          return { names: m?.characters.map((c) => c.name) ?? [], headings: m?.scenes.map((s) => s.heading) ?? [], lang: useStore.getState().settings.lang };
        },
        revision: () => {
          const st = useStore.getState().settings;
          return { on: st.revisionOn, gen: st.revisionGen };
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          const el = node.attrs.el as El;
          const sl = scriptLabels(useStore.getState().settings.lang);
          if (el === 'sceneHeading') return sl.placeholder;
          if (el === 'transition') return sl.transitions[0];
          return t(SCREENPLAY_PLACEHOLDER[el] ?? '');
        },
        showOnlyCurrent: true,
      }),
      Focus.configure({ className: 'has-focus', mode: 'shallowest' }),
      Pagination.configure({
        settings: () => ({ paper: useStore.getState().settings.paper, lang: useStore.getState().settings.lang }),
        onLayout: () => {
          const ed = activeEditor.current;
          if (ed) requestAnimationFrame(() => track(ed));
        },
      }),
    ],
    content: initial,
    autofocus: 'start',
    editorProps: { attributes: { lang: settings.lang, spellcheck: 'false', 'aria-label': t('Senaryo') } },
    onUpdate: ({ editor: ed }) => {
      pending.current = ed;
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, 600);
      track(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      track(ed);
      typewriter(ed);
      setTagMenu(null);
    },
    onCreate: ({ editor: ed }) => requestAnimationFrame(() => track(ed)),
  });

  // Etkin editör referansı (StrictMode'da çift kurulumda doğru örneği tutar)
  useEffect(() => {
    if (!editor) return;
    activeEditor.current = editor;
    return () => {
      if (activeEditor.current === editor) activeEditor.current = null;
    };
  }, [editor]);

  useEffect(() => {
    editorBridge.flush = flush;
    editorBridge.scrollToSid = (sid: string) => {
      const ed = activeEditor.current;
      if (!ed) return;
      let target = -1;
      ed.state.doc.forEach((n, pos) => {
        if (target < 0 && n.attrs.sid === sid) target = pos;
      });
      if (target < 0) return;
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, target + 1 + ed.state.doc.nodeAt(target)!.content.size)));
      ed.view.focus();
      (ed.view.nodeDOM(target) as HTMLElement | null)?.scrollIntoView({ block: 'center' });
    };
    editorBridge.scrollToBlock = (idx: number) => {
      const ed = activeEditor.current;
      if (!ed || idx >= ed.state.doc.childCount) return;
      let pos = 0;
      for (let i = 0; i < idx; i++) pos += ed.state.doc.child(i).nodeSize;
      ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, pos + 1)));
      ed.view.focus();
      (ed.view.nodeDOM(pos) as HTMLElement | null)?.scrollIntoView({ block: 'center' });
    };
    return () => flush();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onBlur = () => flush();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  });

  // Yazım denetimi: aç/kapat ve karakter adlarını bilinen kelimelere ekle
  useEffect(() => spell.poke(), [spellOn]);
  useEffect(() => {
    if (spell.supports(settings.lang)) spell.setLang(settings.lang);
  }, [settings.lang]);
  useEffect(() => {
    if (model) spell.setNames(model.characters.map((c) => c.name));
  }, [model]);

  const onContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!editor || !target.closest('.spell-err, .tdk-sug')) return;
    const at = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    const box = sheetRef.current!.getBoundingClientRect();
    const pos = { x: (e.clientX - box.left) / zoom, y: (e.clientY - box.top) / zoom + 8 };
    const tdk = at ? tdkAt(editor.state, at.pos) : null;
    if (tdk && !target.closest('.spell-err')) {
      e.preventDefault();
      setTagMenu(null);
      setSpellMenu({ ...pos, hit: { from: tdk.from, to: tdk.to, word: tdk.word }, options: [], tdk: tdk.suggestion });
      return;
    }
    const hit = at ? errorAt(editor.state, at.pos) : null;
    if (!hit) return;
    e.preventDefault();
    setTagMenu(null);
    setSpellMenu({ ...pos, hit, options: null, tdk: tdk?.suggestion });
    spell.suggest(hit.word).then((options) => setSpellMenu((m) => (m && m.hit.from === hit.from ? { ...m, options } : m)));
  };

  useEffect(() => {
    if (!spellMenu) return;
    // herhangi bir tuş menüyü kapatır (yazmaya devam edilince)
    const esc = () => setSpellMenu(null);
    const away = (e: MouseEvent) => !(e.target as HTMLElement).closest('.spell-menu') && setSpellMenu(null);
    window.addEventListener('keydown', esc);
    window.addEventListener('mousedown', away);
    return () => {
      window.removeEventListener('keydown', esc);
      window.removeEventListener('mousedown', away);
    };
  }, [spellMenu]);

  // Ctrl+T (komut kaydından): seçili metni etiketle
  useEffect(() => {
    const open = () => {
      if (!editor) return;
      if (editor.state.selection.empty) {
        useStore.getState().notify(t('Etiketlemek için önce bir kelime ya da ifade seç'));
        return;
      }
      const c = editor.view.coordsAtPos(editor.state.selection.to);
      const box = sheetRef.current!.getBoundingClientRect();
      setTagMenu({ x: (c.left - box.left) / zoom, y: (c.bottom - box.top) / zoom + 6 });
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setTagMenu(null);
    window.addEventListener('wtf-tag', open);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('wtf-tag', open);
      window.removeEventListener('keydown', esc);
    };
  }, [editor, zoom]);

  const showStamp = stamp && Date.now() - stamp < 2000;
  const scenes = model?.scenes.length ?? 0;
  const totalEighths = model?.scenes.reduce((a, s) => a + s.eighths, 0) ?? 0;

  return (
    <div ref={sheetRef} className="sheet script" style={{ zoom }} onContextMenu={onContextMenu}>
      {showStamp ? (
        <div className="stamp" key={stamp}>
          <span>
            {t('Saklandı')}
            <b>{new Date(stamp).toLocaleDateString(locale(), { day: 'numeric', month: 'long' })}</b>
            {t('{n} sayfa', { n: model?.pages ?? 0 })}
          </span>
        </div>
      ) : null}
      <div className="scene-head">
        <input
          className="scene-title"
          value={title.title}
          placeholder={t('Senaryonun adı')}
          onChange={(e) => useStore.getState().updateTitle({ title: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') {
              e.preventDefault();
              editor?.commands.focus('start');
            }
          }}
          aria-label={t('Senaryo adı')}
        />
        <div className="scene-meta">
          <span className="label num">{t('{n} sahne', { n: scenes })}</span>
          <span className="sep" />
          <span className="label num">{t('{n} sayfa', { n: model?.pages ?? 1 })}</span>
          <span className="sep" />
          <span className="label num">≈ {t('{n} dk', { n: Math.max(1, Math.round(totalEighths / 8)) })}</span>
          {settings.revisionOn ? (
            <>
              <span className="sep" />
              <span className="label rev-label" style={{ color: `var(--rev-${settings.revisionGen})` }}>
                {t('Revizyon modu · {n}. tur', { n: settings.revisionGen })}
              </span>
            </>
          ) : null}
        </div>
      </div>
      {flag ? (
        <div className={`el-flag ${flag.num ? 'over-num' : ''}`} style={{ top: flag.top }}>
          {EL_LABEL[flag.el]}
        </div>
      ) : null}
      <EditorContent editor={editor} />
      {spellMenu && editor ? (
        <div className="tag-menu spell-menu" style={{ left: spellMenu.x, top: spellMenu.y }} role="menu" aria-label={t('Yazım önerileri')}>
          <div className="label">“{spellMenu.hit.word}”</div>
          {spellMenu.tdk ? (
            <button
              role="menuitem"
              className="spell-option tdk-option"
              onClick={() => {
                replaceWord(editor, spellMenu.hit, spellMenu.tdk!);
                setSpellMenu(null);
              }}
            >
              {spellMenu.tdk} <small>{t('TDK yazımı')}</small>
            </button>
          ) : null}
          {spellMenu.tdk && spellMenu.options?.length === 0 ? null : spellMenu.options === null ? (
            <div className="muted spell-wait">{t('Öneriler aranıyor…')}</div>
          ) : spellMenu.options.length ? (
            spellMenu.options.map((o) => (
              <button
                key={o}
                role="menuitem"
                className="spell-option"
                onClick={() => {
                  replaceWord(editor, spellMenu.hit, o);
                  setSpellMenu(null);
                }}
              >
                {o}
              </button>
            ))
          ) : (
            <div className="muted spell-wait">{t('Öneri yok')}</div>
          )}
          <hr />
          <button
            role="menuitem"
            onClick={() => {
              spell.addToDictionary(spellMenu.hit.word);
              setSpellMenu(null);
              editor.commands.focus();
            }}
          >
            {t('Sözlüğe ekle')}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              spell.ignore(spellMenu.hit.word);
              setSpellMenu(null);
              editor.commands.focus();
            }}
          >
            {t('Bu oturumda yoksay')}
          </button>
        </div>
      ) : null}
      {tagMenu && editor ? (
        <div className="tag-menu" style={{ left: tagMenu.x, top: tagMenu.y }} role="menu">
          <div className="label">{t('Etiketle')}</div>
          {TAG_CATS.map((c) => (
            <button
              key={c.id}
              role="menuitem"
              onClick={() => {
                editor.chain().focus().setMark('tag', { cat: c.id }).run();
                setTagMenu(null);
              }}
            >
              <i style={{ background: `var(${c.color})` }} />
              {t(c.name)}
            </button>
          ))}
          <button
            role="menuitem"
            className="muted"
            onClick={() => {
              editor.chain().focus().unsetMark('tag').run();
              setTagMenu(null);
            }}
          >
            {t('Etiketi kaldır')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Bul / değiştir çubuğu */
export function FindBar() {
  const open = useStore((s) => s.findOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [r, setR] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [, force] = useState(0);
  const ed = activeEditor.current;

  useEffect(() => {
    if (!ed) return;
    setSearch(ed, { query: open ? q : '', matchCase });
    force((x) => x + 1);
  }, [q, matchCase, open, ed]);

  // açıldığında ve Ctrl+F tekrar basıldığında arama kutusuna odaklan
  useEffect(() => {
    if (!open) return;
    const focusInput = () => requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    focusInput();
    window.addEventListener('wtf-find', focusInput);
    return () => window.removeEventListener('wtf-find', focusInput);
  }, [open]);

  if (!open) return null;
  const st = ed ? searchKey.getState(ed.state) : null;
  const close = () => {
    useStore.getState().toggle('findOpen', false);
    if (ed) setSearch(ed, { query: '' });
    ed?.commands.focus();
  };
  return (
    <div className="findbar" role="search">
      <input
        ref={inputRef}
        value={q}
        placeholder={t('Bul')}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && ed) {
            gotoMatch(ed, e.shiftKey ? -1 : 1);
            force((x) => x + 1);
          }
          if (e.key === 'Escape') close();
        }}
      />
      <span className="num muted count">
        {st?.matches.length ? `${st.current + 1}/${st.matches.length}` : q ? '0' : ''}
      </span>
      <button className="icon-btn small" title={t('Önceki (Shift+Enter)')} onClick={() => ed && (gotoMatch(ed, -1), force((x) => x + 1))}>
        ↑
      </button>
      <button className="icon-btn small" title={t('Sonraki (Enter)')} onClick={() => ed && (gotoMatch(ed, 1), force((x) => x + 1))}>
        ↓
      </button>
      <button className={`icon-btn small ${matchCase ? 'on' : ''}`} title={t('Büyük/küçük harfe duyarlı')} onClick={() => setMatchCase(!matchCase)}>
        Aa
      </button>
      <span className="divider" />
      <input
        value={r}
        placeholder={t('Değiştir')}
        onChange={(e) => setR(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && ed) {
            replaceCurrent(ed, r);
            force((x) => x + 1);
          }
          if (e.key === 'Escape') close();
        }}
      />
      <button className="text-btn" onClick={() => ed && (replaceCurrent(ed, r), force((x) => x + 1))}>
        {t('Değiştir')}
      </button>
      <button className="text-btn" onClick={() => ed && (replaceAll(ed, r), force((x) => x + 1))}>
        {t('Tümü')}
      </button>
      <button className="icon-btn small" title={t('Kapat (Esc)')} onClick={close}>
        ×
      </button>
    </div>
  );
}

export { formatEighths, formatNumber };
