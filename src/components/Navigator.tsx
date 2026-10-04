import { useState } from 'react';
import { NotePencil, Plus, FilmStrip } from '@phosphor-icons/react';
import { editorBridge, useStore } from '../store/useStore';
import { colorVar, formatEighths } from '../script/elements';
import { activeEditor } from './ScriptEditor';
import { TextSelection } from '@tiptap/pm/state';
import { t } from '../i18n';

let dragSid: string | null = null;

/** Sahneyi ya da bölümü senaryonun sonuna ekler */
export function appendElement(kind: 'sceneHeading' | 'section') {
  const st = useStore.getState();
  st.openScript();
  setTimeout(() => {
    const ed = activeEditor.current;
    if (!ed) return;
    const end = ed.state.doc.content.size;
    const node = ed.schema.nodes.line.create({ el: kind });
    const tr = ed.state.tr.insert(end, node);
    tr.setSelection(TextSelection.create(tr.doc, end + 1));
    ed.view.dispatch(tr.scrollIntoView());
    ed.view.focus();
  }, 80);
}

export function Navigator() {
  const model = useStore((s) => s.model);
  const scenes = useStore((s) => s.scenes);
  const notes = useStore((s) => s.notes);
  const active = useStore((s) => s.active);
  const cursorSid = useStore((s) => s.cursorSid);
  const openScript = useStore((s) => s.openScript);
  const openNote = useStore((s) => s.openNote);
  const moveScene = useStore((s) => s.moveScene);
  const moveToSection = useStore((s) => s.moveSceneToSection);
  const addNote = useStore((s) => s.addNote);
  const [drop, setDrop] = useState<string | null>(null);
  const sl = useStore((s) => s.settings.lang);

  // bölümlere göre grupla
  const groups: { title: string | null; idx: number | null; items: NonNullable<typeof model>['scenes'] }[] = [];
  for (const s of model?.scenes ?? []) {
    const last = groups.at(-1);
    if (!last || last.title !== s.section) {
      const sec = model!.sections.find((x) => x.title === s.section && (!last || x.idx > (last.items.at(-1)?.idx ?? -1)));
      groups.push({ title: s.section, idx: sec?.idx ?? null, items: [s] });
    } else last.items.push(s);
  }
  // içi boş bölümler
  for (const sec of model?.sections ?? []) if (!groups.some((g) => g.idx === sec.idx)) groups.push({ title: sec.title, idx: sec.idx, items: [] });

  const onScript = active.kind === 'script';

  return (
    <nav className="binder" aria-label={t('Sahneler')}>
      <div className="binder-tree scroll">
        <div className="binder-section">
          <span className="label label-with-icon"><FilmStrip size={13} weight="light" />{t('Sahneler')}</span>
          <span className="label num">{model?.scenes.length ?? 0}</span>
        </div>
        {groups.map((g, gi) => (
          <section key={`${g.idx ?? 'root'}-${gi}`}>
            {g.title ? (
              <div
                className={`nav-section ${drop === `sec-${g.idx}` ? 'drop-inside' : ''}`}
                lang={sl}
                onClick={() => {
                  if (g.idx === null) return;
                  openScript();
                  setTimeout(() => editorBridge.scrollToBlock(g.idx!), 80);
                }}
                onDragOver={(e) => {
                  if (dragSid) {
                    e.preventDefault();
                    setDrop(`sec-${g.idx}`);
                  }
                }}
                onDragLeave={() => setDrop(null)}
                onDrop={() => {
                  if (dragSid) moveToSection(dragSid, g.idx);
                  dragSid = null;
                  setDrop(null);
                }}
              >
                {g.title}
              </div>
            ) : null}
            {g.items.map((s) => {
              const meta = scenes[s.sid];
              const color = colorVar(meta?.color);
              return (
                <div
                  key={s.sid}
                  className={`row scene-row ${onScript && cursorSid === s.sid ? 'active' : ''} ${drop === s.sid ? 'drop-before' : ''}`}
                  role="treeitem"
                  aria-selected={onScript && cursorSid === s.sid}
                  tabIndex={0}
                  draggable
                  title={meta?.synopsis || s.heading}
                  onClick={() => openScript(s.sid)}
                  onKeyDown={(e) => e.key === 'Enter' && openScript(s.sid)}
                  onDragStart={(e) => {
                    dragSid = s.sid;
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragOver={(e) => {
                    if (dragSid && dragSid !== s.sid) {
                      e.preventDefault();
                      setDrop(s.sid);
                    }
                  }}
                  onDragLeave={() => setDrop(null)}
                  onDrop={() => {
                    if (dragSid) moveScene(dragSid, s.sid);
                    dragSid = null;
                    setDrop(null);
                  }}
                >
                  <span className="scene-no num">{s.number}</span>
                  <i className="chip" style={{ background: color ? `var(${color})` : 'transparent', borderColor: color ? 'transparent' : undefined }} />
                  <span className="name" lang={sl}>{s.heading || t('Başlıksız sahne')}</span>
                  <span className="count num">{formatEighths(s.eighths)}</span>
                </div>
              );
            })}
          </section>
        ))}

        <div className="binder-section">
          <span className="label">{t('Notlar')}</span>
          <button className="icon-btn small" title={t('Yeni not')} onClick={addNote}>
            <Plus size={12} />
          </button>
        </div>
        {notes.map((n) => (
          <div
            key={n.id}
            className={`row ${active.kind === 'note' && active.id === n.id ? 'active' : ''}`}
            role="treeitem"
            tabIndex={0}
            onClick={() => openNote(n.id)}
          >
            <span className="caret" />
            <NotePencil size={14} weight="light" className="ico" />
            <span className="name">{n.title}</span>
          </div>
        ))}
        {notes.length === 0 ? <div className="row muted">{t('Henüz not yok')}</div> : null}
      </div>
      <div className="binder-foot">
        <button onClick={() => appendElement('sceneHeading')} title={t('Sona yeni sahne')}>
          <Plus size={13} /> {t('Sahne')}
        </button>
        <button onClick={() => appendElement('section')} title={t('Sona yeni bölüm (basılmaz)')}>
          <Plus size={13} /> {t('Bölüm')}
        </button>
        <button onClick={addNote} title={t('Yeni not')}>
          <Plus size={13} /> {t('Not')}
        </button>
      </div>
    </nav>
  );
}
