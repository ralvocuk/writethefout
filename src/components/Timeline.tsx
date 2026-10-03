import { useStore } from '../store/useStore';
import { colorVar, formatEighths } from '../script/elements';
import { t } from '../i18n';


/** Zaman çizelgesi: sahneler uzunluklarıyla yan yana; altında karakter şeritleri. */
export function Timeline() {
  const model = useStore((s) => s.model);
  const metas = useStore((s) => s.scenes);
  const profiles = useStore((s) => s.characters);
  const openScript = useStore((s) => s.openScript);
  const cursorSid = useStore((s) => s.cursorSid);
  const scenes = model?.scenes ?? [];
  if (!scenes.length) return <div className="view-pad"><p className="hint">{t('Henüz sahne yok.')}</p></div>;

  // kısa senaryolar ekranı doldursun, uzunlar kaydırılsın
  const totalEighths = scenes.reduce((a, s) => a + s.eighths, 0);
  const px = Math.max(9, Math.min(80, 960 / Math.max(1, totalEighths)));
  const widths = scenes.map((s) => Math.max(26, s.eighths * px));
  const lefts: number[] = [];
  widths.reduce((acc, w, i) => ((lefts[i] = acc), acc + w + 2), 0);
  const total = lefts.at(-1)! + widths.at(-1)!;
  const chars = model!.characters.slice(0, 10);

  // bölüm bantları
  const bands: { title: string; from: number; to: number }[] = [];
  scenes.forEach((s, i) => {
    const title = s.section ?? '';
    const last = bands.at(-1);
    if (last && last.title === title) last.to = lefts[i] + widths[i];
    else bands.push({ title, from: lefts[i], to: lefts[i] + widths[i] });
  });
  // hikâye günleri
  const days: { title: string; from: number; to: number }[] = [];
  scenes.forEach((s, i) => {
    const title = metas[s.sid]?.storyDay ?? '';
    const last = days.at(-1);
    if (last && last.title === title) last.to = lefts[i] + widths[i];
    else days.push({ title, from: lefts[i], to: lefts[i] + widths[i] });
  });

  return (
    <div className="view-pad timeline-wrap">
      <p className="hint" style={{ marginTop: 0 }}>
        {t('Her blok bir sahne; genişliği sayfa uzunluğuyla orantılı, çizgili bloklar dış mekân. Tıklayınca sahneye gider.')}
      </p>
      <div className="timeline scroll">
        <div className="tl-inner" style={{ width: total + 140 }}>
          <div className="tl-row tl-bands">
            <span className="tl-label">{t('Bölüm')}</span>
            <div className="tl-track">
              {bands.map((b, i) => (
                <div key={i} className={`tl-band ${b.title ? '' : 'empty'}`} lang={model?.blocks ? useStore.getState().settings.lang : undefined} style={{ left: b.from, width: b.to - b.from }}>
                  {b.title}
                </div>
              ))}
            </div>
          </div>
          <div className="tl-row tl-bands">
            <span className="tl-label">{t('Gün')}</span>
            <div className="tl-track">
              {days.map((b, i) => (
                <div key={i} className={`tl-band day ${b.title ? '' : 'empty'}`} lang={useStore.getState().settings.lang} style={{ left: b.from, width: b.to - b.from }}>
                  {b.title}
                </div>
              ))}
            </div>
          </div>
          <div className="tl-row tl-scenes">
            <span className="tl-label">{t('Sahneler')}</span>
            <div className="tl-track">
              {scenes.map((s, i) => {
                const c = colorVar(metas[s.sid]?.color);
                return (
                  <button
                    key={s.sid}
                    className={`tl-scene ${cursorSid === s.sid ? 'active' : ''} ${s.intExt === 'DIŞ' ? 'ext' : ''}`}
                    style={{ left: lefts[i], width: widths[i], ['--c' as string]: c ? `var(${c})` : 'var(--rule-strong)' }}
                    title={`${s.number}. ${s.heading}\n${t('{len} sayfa', { len: formatEighths(s.eighths) })}${metas[s.sid]?.synopsis ? `\n${metas[s.sid].synopsis}` : ''}`}
                    onClick={() => openScript(s.sid)}
                  >
                    <span className="num">{s.number}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {chars.map((ch) => {
            const col = colorVar(profiles[ch.name]?.color);
            return (
              <div className="tl-row tl-char" key={ch.name}>
                <span className="tl-label" title={ch.name}>
                  {ch.name}
                </span>
                <div className="tl-track">
                  <div className="tl-line" style={{ width: total }} />
                  {scenes.map((s, i) =>
                    s.characters.includes(ch.name) ? (
                      <i
                        key={s.sid}
                        className="tl-dot"
                        style={{ left: lefts[i], width: widths[i], background: col ? `var(${col})` : 'var(--ink-2)' }}
                        title={`${ch.name} · ${s.number}. ${s.heading}`}
                      />
                    ) : null,
                  )}
                </div>
              </div>
            );
          })}
          <div className="tl-row tl-ruler">
            <span className="tl-label" />
            <div className="tl-track">
              {scenes.map((s, i) =>
                i === 0 || s.page !== scenes[i - 1].page ? (
                  <span key={s.sid} className="tl-tick num" style={{ left: lefts[i] }}>
                    {t('s.{n}', { n: s.page })}
                  </span>
                ) : null,
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
