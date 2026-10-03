import { useState } from 'react';
import { useStore } from '../store/useStore';
import { colorVar, formatNumber } from '../script/elements';
import { t } from '../i18n';
import { ColorPicker } from './Inspector';

/** Karakterler: replik sayıları, sahneleri ve profil notları. */
export function Characters() {
  const model = useStore((s) => s.model);
  const profiles = useStore((s) => s.characters);
  const update = useStore((s) => s.updateCharacter);
  const openScript = useStore((s) => s.openScript);
  const setFilter = useStore((s) => s.setFilter);
  const setTab = useStore((s) => s.setTab);
  const chars = model?.characters ?? [];
  const [sel, setSel] = useState<string | null>(chars[0]?.name ?? null);
  const c = chars.find((x) => x.name === sel) ?? chars[0];
  const maxLines = Math.max(1, ...chars.map((x) => x.lines));
  const totalLines = chars.reduce((a, x) => a + x.lines, 0) || 1;

  if (!chars.length) {
    return (
      <div className="view-pad">
        <p className="hint">{t('Henüz konuşan karakter yok. Senaryoda bir karakter adı yazıp diyalog ekle.')}</p>
      </div>
    );
  }
  const p = profiles[c.name] ?? { name: c.name, description: '', color: null };
  const sceneById = new Map(model!.scenes.map((s) => [s.sid, s]));

  return (
    <div className="split">
      <div className="split-list scroll">
        {chars.map((x) => {
          const col = colorVar(profiles[x.name]?.color);
          return (
            <button key={x.name} className={`char-row ${x.name === c.name ? 'active' : ''}`} onClick={() => setSel(x.name)}>
              <span className="char-name">
                {col ? <i className="chip" style={{ background: `var(${col})` }} /> : null}
                {x.name}
              </span>
              <span className="bar">
                <i style={{ width: `${(x.lines / maxLines) * 100}%`, background: col ? `var(${col})` : undefined }} />
              </span>
              <span className="num muted">{x.lines}</span>
            </button>
          );
        })}
      </div>
      <div className="split-detail scroll">
        <h2 className="detail-title">{c.name}</h2>
        <div className="stat-row">
          <Stat n={c.lines} label="replik" />
          <Stat n={c.words} label="kelime" />
          <Stat n={c.scenes.length} label="sahne" />
          <Stat n={Math.round((c.lines / totalLines) * 100)} label="% diyalog payı" />
        </div>
        <div className="insp-block flat">
          <label className="field">
            <span className="muted">{t('Renk')}</span>
            <ColorPicker value={p.color} onChange={(col) => update(c.name, { color: col })} />
          </label>
          <div className="label" style={{ marginTop: 14 }}>
            {t('Profil')}
          </div>
          <textarea
            className="synopsis"
            value={p.description}
            placeholder={t('Kim? Ne istiyor, neye ihtiyacı var? Nasıl konuşur?')}
            onChange={(e) => update(c.name, { description: e.target.value })}
          />
        </div>
        <div className="label" style={{ margin: '18px 0 8px' }}>
          {t('Geçtiği sahneler')}
          <button
            className="text-btn"
            style={{ marginLeft: 12 }}
            onClick={() => {
              setFilter({ character: c.name });
              setTab('board');
            }}
          >
            {t('Panoda göster')}
          </button>
        </div>
        <ol className="scene-list">
          {c.scenes.map((sid) => {
            const s = sceneById.get(sid);
            if (!s) return null;
            return (
              <li key={sid}>
                <button className="link" onClick={() => openScript(sid)}>
                  <span className="num muted">{s.number}</span> {s.heading}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

export function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="stat">
      <b className="num">{typeof n === 'number' ? formatNumber(n) : n}</b>
      <span>{t(label)}</span>
    </div>
  );
}
