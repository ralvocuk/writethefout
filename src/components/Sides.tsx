import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { Modal } from './Dialogs';
import { numberScenes } from '../export/layout';
import { lineListBlocks, scenesWith, sidesBlocks, speechesOf } from '../export/sides';
import { loadFonts, openPath, revealPath, safeName, saveFile } from '../export/platform';
import { baseName } from '../script/document';
import { formatEighths, formatNumber, upperTr } from '../script/elements';

const close = () => useStore.getState().openDialogBox(null);
type Mode = 'sides' | 'lines';

/** Oyuncu sayfaları ve replik dökümü (PDF) */
export function SidesDialog() {
  const open = useStore((s) => s.dialog === 'sides');
  const model = useStore((s) => s.model);
  const settings = useStore((s) => s.settings);
  const title = useStore((s) => s.title);
  const doc = useStore((s) => s.doc);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode>('sides');
  const [picked, setPicked] = useState<string[]>([]);
  const [highlight, setHighlight] = useState(true);
  const [newPage, setNewPage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ path: string; pages: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chars = model?.characters ?? [];
  useEffect(() => {
    if (!open) return;
    setDone(null);
    setError(null);
    if (!chars.some((c) => c.name === name)) setName(chars[0]?.name ?? '');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const scenes = useMemo(() => (model && name ? scenesWith(model.scenes, name) : []), [model, name]);
  useEffect(() => setPicked(scenes.map((s) => s.sid)), [scenes]);
  const blocks = useMemo(() => (model ? numberScenes(model.blocks) : []), [model]);
  const speeches = useMemo(() => (name ? speechesOf(blocks, name) : []), [blocks, name]);

  if (!open || !model) return null;
  const info = chars.find((c) => c.name === name);
  const eighths = scenes.filter((s) => picked.includes(s.sid)).reduce((a, s) => a + s.eighths, 0);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const out =
        mode === 'sides' ? sidesBlocks(blocks, model.scenes, picked, { newPagePerScene: newPage }) : lineListBlocks(speeches, settings.lang);
      const label = mode === 'sides' ? (settings.lang === 'tr' ? 'oyuncu sayfaları' : 'sides') : settings.lang === 'tr' ? 'replik dökümü' : 'lines';
      const { renderPdf } = await import('../export/pdf');
      const r = await renderPdf(
        out,
        {
          paper: settings.paper,
          lang: settings.lang,
          sceneNumbers: true,
          headingSpace: 2,
          highlight: highlight ? name : undefined,
          header: `${upperTr(name)} — ${label}`,
        },
        null,
        await loadFonts(),
      );
      const base = safeName(title.title || (doc.path ? baseName(doc.path) : 'senaryo'));
      const res = await saveFile(`${base} - ${name} - ${label}.pdf`, r.bytes, { name: 'PDF', extensions: ['pdf'] });
      if (res.path) setDone({ path: res.path, pages: r.pages });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || !name || (mode === 'sides' ? !picked.length : !speeches.length);

  return (
    <Modal
      title="Oyuncu sayfaları"
      aside={info ? `${info.lines} replik · ${scenes.length} sahne` : ''}
      onClose={close}
      wide
      foot={
        <>
          {error ? <span className="error">{error}</span> : null}
          {done ? (
            <span className="done">
              Kaydedildi · {done.pages} sayfa.{' '}
              <button className="text-btn" onClick={() => openPath(done.path)}>
                Aç
              </button>{' '}
              <button className="text-btn" onClick={() => revealPath(done.path)}>
                Klasörde göster
              </button>
            </span>
          ) : null}
          <span className="grow" />
          <button className="btn" onClick={close}>
            Kapat
          </button>
          <button className="btn primary" disabled={disabled} onClick={run}>
            {busy ? 'Hazırlanıyor…' : 'PDF olarak kaydet'}
          </button>
        </>
      }
    >
      {chars.length === 0 ? (
        <div className="dialog-body">
          <p className="hint">Senaryoda henüz konuşan bir karakter yok.</p>
        </div>
      ) : (
        <>
          <div className="formats two" role="radiogroup" aria-label="Tür">
            <button role="radio" aria-checked={mode === 'sides'} className="format" onClick={() => setMode('sides')}>
              <span className="format-name">Sahneler</span>
              <span className="format-ext">sides</span>
              <span className="format-desc">Karakterin oynadığı sahneler, senaryodaki sayfa düzeni ve sahne numaralarıyla. Seçme ve çekim günü için.</span>
            </button>
            <button role="radio" aria-checked={mode === 'lines'} className="format" onClick={() => setMode('lines')}>
              <span className="format-name">Replik dökümü</span>
              <span className="format-ext">ipuçlarıyla</span>
              <span className="format-desc">Yalnızca karakterin replikleri; her birinin önünde karşısındakinin son cümlesi. Ezber ve okuma provası için.</span>
            </button>
          </div>
          <div className="dialog-body">
            <label className="opt-row">
              <span className="muted">Karakter</span>
              <select className="select" value={name} onChange={(e) => setName(e.target.value)}>
                {chars.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} — {c.lines} replik
                  </option>
                ))}
              </select>
            </label>
            <label className="opt-row check">
              <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} />
              <span>Replikleri fosforlu kalemle vurgula</span>
            </label>
            {mode === 'sides' ? (
              <>
                <label className="opt-row check">
                  <input type="checkbox" checked={newPage} onChange={(e) => setNewPage(e.target.checked)} />
                  <span>Her sahne yeni sayfada başlasın</span>
                </label>
                <div className="sides-head">
                  <span className="label">Sahneler</span>
                  <span className="muted num">
                    {picked.length}/{scenes.length} seçili · {formatEighths(eighths)} sayfa
                  </span>
                  <span className="grow" />
                  <button className="text-btn" onClick={() => setPicked(picked.length === scenes.length ? [] : scenes.map((s) => s.sid))}>
                    {picked.length === scenes.length ? 'Hiçbiri' : 'Tümü'}
                  </button>
                </div>
                <div className="sides-list">
                  {scenes.map((s) => (
                    <label key={s.sid} className="sides-row">
                      <input
                        type="checkbox"
                        checked={picked.includes(s.sid)}
                        onChange={(e) => setPicked(e.target.checked ? [...picked, s.sid] : picked.filter((x) => x !== s.sid))}
                      />
                      <span className="num muted">{s.number}</span>
                      <span className="sides-heading">{s.heading}</span>
                      <span className="num muted">{formatEighths(s.eighths)}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <p className="hint">
                {formatNumber(speeches.length)} replik, {new Set(speeches.map((s) => s.sid)).size} sahnede. İpucu satırları italik basılır.
              </p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
