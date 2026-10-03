import { useEffect, useMemo, useState } from 'react';
import { Printer } from '@phosphor-icons/react';
import { useStore } from '../store/useStore';
import {
  CH,
  LEFT,
  LINE,
  MARGIN_TOP,
  PAPER,
  RIGHT_EDGE,
  scriptLabels,
  numberScenes,
  paginate,
  titlePageLayout,
  type PLine,
  type Paper,
  type Run,
} from '../export/layout';
import { t } from '../i18n';

const len = (s: string) => [...s].length;

function Runs({ runs, bold }: { runs: Run[]; bold?: boolean }) {
  return (
    <>
      {runs.map((r, i) => (
        <span key={i} style={{ fontWeight: r.b || bold ? 700 : 400, fontStyle: r.i ? 'italic' : 'normal', textDecoration: r.u ? 'underline' : 'none' }}>
          {r.text}
        </span>
      ))}
    </>
  );
}

function Line({ l, w }: { l: PLine; w: number }) {
  const style: React.CSSProperties =
    l.align === 'right'
      ? { right: `${w - RIGHT_EDGE}pt` }
      : l.align === 'center'
        ? { left: `${(LEFT + RIGHT_EDGE) / 2}pt`, transform: 'translateX(-50%)' }
        : { left: `${l.x}pt` };
  return (
    <div className="pv-text" style={style}>
      <Runs runs={l.runs} bold={l.el === 'sceneHeading'} />
    </div>
  );
}

/** Baskı önizleme: PDF ile aynı sayfalama; sistemin yazdırma penceresine gönderir. */
export function Preview() {
  const model = useStore((s) => s.model);
  const settings = useStore((s) => s.settings);
  const title = useStore((s) => s.title);
  const updateSettings = useStore((s) => s.updateSettings);
  const [opts, setOpts] = useState({ sceneNumbers: true, titlePage: true, revisedOnly: false, revisionMarks: true, scale: 0.9 });

  const pages = useMemo(
    () =>
      model
        ? paginate(numberScenes(model.blocks), { paper: settings.paper, lang: settings.lang, sceneNumbers: opts.sceneNumbers, headingSpace: 2, autoContd: true })
        : [],
    [model, settings.paper, settings.lang, opts.sceneNumbers],
  );
  const revised = pages.filter((p) => p.lines.some((l) => l?.rev || l?.pair?.rev)).map((p) => p.number);
  const shown = opts.revisedOnly ? pages.filter((p) => revised.includes(p.number)) : pages;
  const { w, h } = PAPER[settings.paper];
  const revLabel = `${scriptLabels(settings.lang).revision(settings.revisionGen)} — ${new Date().toLocaleDateString(scriptLabels(settings.lang).locale)}`;
  const showTitle = opts.titlePage && !opts.revisedOnly && !!title.title;

  // yazdırma için sayfa boyutu
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = `@page { size: ${settings.paper === 'a4' ? 'A4' : 'letter'}; margin: 0; }`;
    document.head.appendChild(el);
    return () => el.remove();
  }, [settings.paper]);

  if (!model) return null;
  const set = (p: Partial<typeof opts>) => setOpts((o) => ({ ...o, ...p }));

  return (
    <div className="preview">
      <div className="pv-toolbar">
        <button className="btn primary" onClick={() => window.print()}>
          <Printer size={15} weight="light" /> {t('Yazdır')}
        </button>
        <div className="segmented small">
          {(['a4', 'letter'] as Paper[]).map((p) => (
            <button key={p} aria-pressed={settings.paper === p} onClick={() => updateSettings({ paper: p })}>
              {p === 'a4' ? 'A4' : 'US Letter'}
            </button>
          ))}
        </div>
        <label className="check-inline">
          <input type="checkbox" checked={opts.titlePage} onChange={(e) => set({ titlePage: e.target.checked })} /> {t('Başlık sayfası')}
        </label>
        <label className="check-inline">
          <input type="checkbox" checked={opts.sceneNumbers} onChange={(e) => set({ sceneNumbers: e.target.checked })} /> {t('Sahne numaraları')}
        </label>
        {revised.length ? (
          <>
            <label className="check-inline">
              <input type="checkbox" checked={opts.revisionMarks} onChange={(e) => set({ revisionMarks: e.target.checked })} /> {t('Revizyon işaretleri')}
            </label>
            <label className="check-inline">
              <input type="checkbox" checked={opts.revisedOnly} onChange={(e) => set({ revisedOnly: e.target.checked })} /> {t('Yalnızca değişen sayfalar')}
            </label>
          </>
        ) : null}
        <span className="grow" />
        <span className="muted num">
          {t('{n} sayfa', { n: shown.length })}{showTitle ? ` + ${t('başlık')}` : ''}
        </span>
        <input
          type="range"
          min={0.5}
          max={1.4}
          step={0.05}
          value={opts.scale}
          onChange={(e) => set({ scale: Number(e.target.value) })}
          aria-label={t('Önizleme ölçeği')}
        />
      </div>
      <div className="pv-pages print-root" style={{ ['--pv-scale' as string]: opts.scale }}>
        {showTitle ? (
          <div className="pv-page" style={{ width: `${w}pt`, height: `${h}pt` }}>
            {titlePageLayout(title, settings.paper, settings.lang).map((l, i) => (
              <div
                key={i}
                className="pv-text"
                style={{
                  top: `${l.y - 9}pt`,
                  ...(l.align === 'center'
                    ? { left: `${l.x}pt`, transform: 'translateX(-50%)' }
                    : l.align === 'right'
                      ? { right: `${w - l.x}pt` }
                      : { left: `${l.x}pt` }),
                  fontWeight: l.bold ? 700 : 400,
                }}
              >
                {l.text}
              </div>
            ))}
          </div>
        ) : null}
        {shown.map((p) => {
          const revOnPage = opts.revisionMarks && revised.includes(p.number);
          return (
            <div className="pv-page" key={p.number} style={{ width: `${w}pt`, height: `${h}pt` }}>
              {p.number > 1 ? (
                <div className="pv-text" style={{ top: `${36 - 9}pt`, right: `${w - RIGHT_EDGE}pt` }}>
                  {p.number}.
                </div>
              ) : null}
              {revOnPage ? (
                <div className="pv-text" style={{ top: `${36 - 9}pt`, left: `${LEFT}pt` }}>
                  {revLabel}
                </div>
              ) : null}
              {p.lines.map((l, idx) =>
                l ? (
                  <div key={idx} className="pv-line" style={{ top: `${MARGIN_TOP + idx * LINE - 9}pt` }}>
                    <Line l={l} w={w} />
                    {l.pair ? <Line l={l.pair} w={w} /> : null}
                    {l.sceneNo ? (
                      <>
                        <div className="pv-text" style={{ left: `${LEFT - 30 - len(l.sceneNo) * CH}pt` }}>
                          {l.sceneNo}
                        </div>
                        <div className="pv-text" style={{ left: `${RIGHT_EDGE + 18}pt` }}>
                          {l.sceneNo}
                        </div>
                      </>
                    ) : null}
                    {opts.revisionMarks && (l.rev || l.pair?.rev) ? (
                      <div className="pv-text" style={{ left: `${RIGHT_EDGE + (l.sceneNo ? 46 : 30)}pt` }}>
                        *
                      </div>
                    ) : null}
                  </div>
                ) : null,
              )}
            </div>
          );
        })}
      </div>
      <p className="hint pv-hint">
        {t('Önizleme, PDF ile aynı sayfalama motorunu kullanır. {more} ve {contd} sayfa geçişlerinde otomatik eklenir.', {
          more: scriptLabels(settings.lang).more,
          contd: scriptLabels(settings.lang).contd,
        })}
      </p>
    </div>
  );
}
