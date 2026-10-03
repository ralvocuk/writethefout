import { useStore } from '../store/useStore';
import { STATUS_LABEL, emptySceneMeta, type Status } from '../data/types';
import { colorVar, formatEighths } from '../script/elements';
import { FilterBar } from './Board';
import { ColorPicker } from './Inspector';
import { t } from '../i18n';

/** Anahat: tüm sahneler tek tabloda, süzülebilir ve düzenlenebilir. */
export function Outline() {
  const model = useStore((s) => s.model);
  const scenes = useStore((s) => s.scenes);
  const filter = useStore((s) => s.filter);
  const updateScene = useStore((s) => s.updateScene);
  const openScript = useStore((s) => s.openScript);

  const rows = (model?.scenes ?? []).filter(
    (s) =>
      (!filter.character || s.characters.includes(filter.character)) &&
      (!filter.color || scenes[s.sid]?.color === filter.color) &&
      (!filter.location || s.location === filter.location),
  );
  let lastSection: string | null | undefined;

  return (
    <div className="view-pad">
      <FilterBar />
      <table className="outline">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>{t('Sahne')}</th>
            <th>{t('Zaman')}</th>
            <th className="num">{t('Sayfa')}</th>
            <th className="num">{t('Uzunluk')}</th>
            <th>{t('Karakterler')}</th>
            <th>{t('Özet')}</th>
            <th>{t('Renk')}</th>
            <th>{t('Durum')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const sm = scenes[s.sid] ?? emptySceneMeta(s.sid);
            const color = colorVar(sm.color);
            const showSection = s.section !== lastSection;
            lastSection = s.section;
            return [
              showSection && s.section ? (
                <tr key={`sec-${s.sid}`} className="outline-section" lang={useStore.getState().settings.lang}>
                  <td colSpan={9}>{s.section}</td>
                </tr>
              ) : null,
              <tr key={s.sid} style={{ ['--strip' as string]: color ? `var(${color})` : 'transparent' }}>
                <td className="num no">{s.number}</td>
                <td>
                  <button className="link" lang={useStore.getState().settings.lang} onClick={() => openScript(s.sid)}>
                    {s.intExt ? <span className="ie">{s.intExt}.</span> : null} {s.location || s.heading || t('Başlıksız sahne')}
                  </button>
                  {s.notes.length ? <span className="note-dot" title={s.notes.join('\n')} /> : null}
                </td>
                <td className="muted">{s.time}</td>
                <td className="num">{s.page}</td>
                <td className="num">{formatEighths(s.eighths)}</td>
                <td className="chars">{s.characters.join(', ')}</td>
                <td>
                  <input
                    className="cell-input"
                    value={sm.synopsis}
                    placeholder={t('Özet…')}
                    onChange={(e) => updateScene(s.sid, { synopsis: e.target.value })}
                  />
                </td>
                <td>
                  <ColorPicker value={sm.color} onChange={(c) => updateScene(s.sid, { color: c })} />
                </td>
                <td>
                  <select value={sm.status} onChange={(e) => updateScene(s.sid, { status: e.target.value as Status })}>
                    {(['draft', 'revised', 'done'] as Status[]).map((st) => (
                      <option key={st} value={st}>
                        {STATUS_LABEL[st]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="hint">{t('Eşleşen sahne yok.')}</p> : null}
    </div>
  );
}
