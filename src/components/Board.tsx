import { useState } from 'react';
import { useStore } from '../store/useStore';
import { STATUS_LABEL } from '../data/types';
import { SCENE_COLORS, colorVar, formatEighths } from '../script/elements';
import { t } from '../i18n';
import type { SceneInfo } from '../script/model';

/** Kartın hafif, kalıcı eğimi: kimliğinden türetilir. */
const tiltOf = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((h % 9) - 4) / 10;
};

let dragSid: string | null = null;

export function Board() {
  const model = useStore((s) => s.model);
  const filter = useStore((s) => s.filter);
  const scenes = useStore((s) => s.scenes);
  const moveToSection = useStore((s) => s.moveSceneToSection);
  const [dropSec, setDropSec] = useState<number | null | 'none'>('none');

  const visible = (s: SceneInfo) =>
    (!filter.character || s.characters.includes(filter.character)) &&
    (!filter.color || scenes[s.sid]?.color === filter.color) &&
    (!filter.location || s.location === filter.location);

  const groups: { title: string; idx: number | null; cards: SceneInfo[] }[] = [];
  for (const s of model?.scenes ?? []) {
    const last = groups.at(-1);
    if (!last || last.title !== (s.section ?? t('Senaryo'))) {
      const sec = model!.sections.filter((x) => x.idx < s.idx).at(-1);
      groups.push({ title: s.section ?? t('Senaryo'), idx: s.section ? (sec?.idx ?? null) : null, cards: [s] });
    } else last.cards.push(s);
  }

  return (
    <div className="board">
      <FilterBar />
      {groups.length === 0 ? <p className="hint">{t('Henüz sahne yok. Yaz sekmesinde bir sahne başlığı yaz.')}</p> : null}
      {groups.map((g, gi) => (
        <section className="board-group" key={`${g.idx}-${gi}`}>
          <div
            className={`label ${dropSec === g.idx ? 'drop' : ''}`}
            onDragOver={(e) => {
              if (dragSid) {
                e.preventDefault();
                setDropSec(g.idx);
              }
            }}
            onDragLeave={() => setDropSec('none')}
            onDrop={() => {
              if (dragSid) moveToSection(dragSid, g.idx);
              dragSid = null;
              setDropSec('none');
            }}
          >
            <span>{g.title}</span>
            <span className="num">
              {t('{n} sahne', { n: g.cards.length })} · {t('{len} sayfa', { len: formatEighths(g.cards.reduce((a, c) => a + c.eighths, 0)) })}
            </span>
          </div>
          <div className="cards">
            {g.cards.filter(visible).map((c) => (
              <Card key={c.sid} scene={c} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Card({ scene }: { scene: SceneInfo }) {
  const meta = useStore((s) => s.scenes[scene.sid]);
  const openScript = useStore((s) => s.openScript);
  const moveScene = useStore((s) => s.moveScene);
  const [drop, setDrop] = useState(false);
  const [dragging, setDragging] = useState(false);
  const color = colorVar(meta?.color);

  return (
    <button
      className={`card ${drop ? 'drop-before' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ ['--tilt' as string]: `${tiltOf(scene.sid)}deg`, ['--strip' as string]: color ? `var(${color})` : 'transparent' }}
      draggable
      onClick={() => openScript(scene.sid)}
      onDragStart={() => {
        dragSid = scene.sid;
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(e) => {
        if (dragSid && dragSid !== scene.sid) {
          e.preventDefault();
          setDrop(true);
        }
      }}
      onDragLeave={() => setDrop(false)}
      onDrop={() => {
        if (dragSid) moveScene(dragSid, scene.sid);
        dragSid = null;
        setDrop(false);
      }}
    >
      <div className="card-title" lang={useStore.getState().settings.lang}>
        <span className="card-no num">{scene.number}</span>
        <span className="card-heading">{scene.heading || t('Başlıksız sahne')}</span>
      </div>
      {meta?.status === 'done' ? <span className="status-stamp">{STATUS_LABEL.done}</span> : null}
      <div className={`card-body ${meta?.synopsis ? '' : 'empty'}`}>{meta?.synopsis || t('Özet yazılmadı.')}</div>
      <div className="card-foot">
        <span className="card-chars">{scene.characters.slice(0, 3).join(', ') || '—'}</span>
        <span className="num">{t('{len} s.', { len: formatEighths(scene.eighths) })}</span>
      </div>
    </button>
  );
}

export function FilterBar() {
  const model = useStore((s) => s.model);
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const locations = [...new Set(model?.scenes.map((s) => s.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const any = filter.character || filter.color || filter.location;
  return (
    <div className="filterbar">
      <span className="label">{t('Filtrele')}</span>
      <select value={filter.character ?? ''} onChange={(e) => setFilter({ character: e.target.value || null })}>
        <option value="">{t('Tüm karakterler')}</option>
        {model?.characters.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
          </option>
        ))}
      </select>
      <select value={filter.location ?? ''} onChange={(e) => setFilter({ location: e.target.value || null })}>
        <option value="">{t('Tüm mekânlar')}</option>
        {locations.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      <select value={filter.color ?? ''} onChange={(e) => setFilter({ color: e.target.value || null })}>
        <option value="">{t('Tüm renkler')}</option>
        {SCENE_COLORS.map((c) => (
          <option key={c.id} value={c.id}>
            {t(c.name)}
          </option>
        ))}
      </select>
      {any ? (
        <button className="text-btn" onClick={() => setFilter({ character: null, color: null, location: null })}>
          {t('Temizle')}
        </button>
      ) : null}
    </div>
  );
}
