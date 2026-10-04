import { useStore } from '../store/useStore';
import { runCommand } from '../commands';
import { STATUS_LABEL, emptySceneMeta, type Status } from '../data/types';
import { REVISIONS, SCENE_COLORS, TAG_CATS, colorVar, formatEighths } from '../script/elements';
import { t } from '../i18n';

const STATUSES: Status[] = ['draft', 'revised', 'done'];

export function ColorPicker({ value, onChange }: { value: string | null; onChange: (c: string | null) => void }) {
  return (
    <div className="color-pick" role="radiogroup" aria-label={t('Renk')}>
      <button role="radio" aria-checked={!value} className="none" title={t('Renk yok')} onClick={() => onChange(null)} />
      {SCENE_COLORS.map((c) => (
        <button
          key={c.id}
          role="radio"
          aria-checked={value === c.id}
          title={t(c.name)}
          style={{ background: `var(${c.v})` }}
          onClick={() => onChange(c.id)}
        />
      ))}
    </div>
  );
}

export function Inspector() {
  const model = useStore((s) => s.model);
  const sid = useStore((s) => s.cursorSid);
  const scenes = useStore((s) => s.scenes);
  const updateScene = useStore((s) => s.updateScene);
  const setPageLock = useStore((s) => s.setPageLock);
  const active = useStore((s) => s.active);

  const scene = model?.scenes.find((s) => s.sid === sid);
  const sm = sid ? (scenes[sid] ?? emptySceneMeta(sid)) : null;

  return (
    <aside className="inspector scroll" aria-label={t('Ayrıntılar')}>
      {active.kind === 'script' && scene && sm ? (
        <>
          <div className="insp-block scene-card-head">
            <div className="label">
              <span>{t('Sahne {n}', { n: scene.number })}</span>
              <span className="num">
                {t('s. {page} · {len} sayfa', { page: scene.page, len: formatEighths(scene.eighths) })}
              </span>
            </div>
            <div className="insp-heading" lang={useStore.getState().settings.lang}>{scene.heading || t('Başlıksız sahne')}</div>
            <textarea
              className="synopsis"
              value={sm.synopsis}
              placeholder={t('Bu sahnede ne değişiyor? Bir iki cümle.')}
              onChange={(e) => updateScene(scene.sid, { synopsis: e.target.value })}
            />
          </div>
          <div className="insp-block">
            <div className="label">{t('Durum')}</div>
            <div className="segmented" role="group" aria-label={t('Durum')}>
              {STATUSES.map((s) => (
                <button key={s} aria-pressed={sm.status === s} onClick={() => updateScene(scene.sid, { status: s })}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="insp-block">
            <label className="field">
              <span className="muted">{t('Renk')}</span>
              <ColorPicker value={sm.color} onChange={(c) => updateScene(scene.sid, { color: c })} />
            </label>
            <label className="field">
              <span className="muted">{t('Hikâye günü')}</span>
              <input value={sm.storyDay} placeholder={t('ör. 1. gün')} onChange={(e) => updateScene(scene.sid, { storyDay: e.target.value })} />
            </label>
            <div className="field">
              <span className="muted">{t('Sayfa başlangıcı')}</span>
              <div className="lock-row">
                <input
                  type="number"
                  min={2}
                  max={999}
                  value={scene.pageLock ?? ''}
                  placeholder={t('Otomatik')}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    setPageLock(scene.sid, v ? Number(v) : null);
                  }}
                  aria-label={t('Sahne başlangıç sayfası')}
                />
                {scene.pageLock ? (
                  <button className="text-btn" onClick={() => setPageLock(scene.sid, null)}>{t('Kilidi aç')}</button>
                ) : (
                  <button className="text-btn" onClick={() => setPageLock(scene.sid, scene.page)}>{t('Mevcut sayfaya kilitle')}</button>
                )}
              </div>
              <span className="hint">{scene.pageLock ? t('Sahne bu sayfadan önce başlatılmaz.') : t('Sayfa akışı otomatik.')}</span>
            </div>
            <div className="field">
              <span className="muted">{t('Karakterler')}</span>
              <span className="chips">
                {scene.characters.length ? scene.characters.map((c) => <span key={c} className="tag-chip">{c}</span>) : <span className="muted">—</span>}
              </span>
            </div>
          </div>
          {scene.notes.length ? (
            <div className="insp-block">
              <div className="label">{t('Notlar')}</div>
              {scene.notes.map((n, i) => (
                <p key={i} className="note-quote">
                  {n}
                </p>
              ))}
            </div>
          ) : null}
          {scene.tags.length ? (
            <div className="insp-block">
              <div className="label">{t('Etiketler')}</div>
              <div className="chips">
                {scene.tags.map((tag, i) => {
                  const cat = TAG_CATS.find((c) => c.id === tag.cat);
                  return (
                    <span key={i} className="tag-chip" title={cat ? t(cat.name) : undefined}>
                      <i style={{ background: `var(${cat?.color ?? '--ink-3'})` }} />
                      {tag.text}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="insp-block">
          <p className="hint" style={{ margin: 0 }}>
            {t('İmleci bir sahneye götürdüğünde özeti, rengi ve karakterleri burada görünür.')}
          </p>
        </div>
      )}

      <RevisionPanel />
      <SnapshotPanel />

      <div className="insp-block" style={{ borderBottom: 0 }}>
        <div className="label">{t('Kısayollar')}</div>
        <div className="hint shortcuts">
          <div><span className="kbd">Tab</span> / <span className="kbd">Enter</span> {t('eleman akışı')}</div>
          <div><span className="kbd">Ctrl</span><span className="kbd">1–6</span> {t('temel elemanlar')}</div>
          <div><span className="kbd">Ctrl</span><span className="kbd">7 8 9</span> {t('ortalı, şarkı sözü, bölüm')}</div>
          <div><span className="kbd">Ctrl</span><span className="kbd">Enter</span> {t('sayfa sonu')} · <span className="kbd">Ctrl</span><span className="kbd">D</span> {t('çift diyalog')}</div>
          <div><span className="kbd">Ctrl</span><span className="kbd">⇧</span><span className="kbd">M</span> {t('not')} · <span className="kbd">Ctrl</span><span className="kbd">/</span> {t('metni gizle')}</div>
          <div><span className="kbd">Ctrl</span><span className="kbd">T</span> {t('etiketle')} · <span className="kbd">Ctrl</span><span className="kbd">F</span> {t('bul')}</div>
          <div><span className="kbd">Ctrl</span><span className="kbd">E</span> {t('dışa aktar')} · <span className="kbd">Ctrl</span><span className="kbd">K</span> {t('komutlar')}</div>
        </div>
      </div>
    </aside>
  );
}

function RevisionPanel() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const model = useStore((s) => s.model);
  const counts = { rev: 0, del: 0, gens: new Set<number>() };
  for (const b of model?.blocks ?? []) {
    for (const r of b.runs) if (r.rev) (counts.rev++, counts.gens.add(r.rev));
    if (b.delGen) counts.del++;
  }
  const revised = counts.rev > 0 || counts.del > 0;
  return (
    <div className="insp-block">
      <div className="label">
        <span>{t('Revizyon')}</span>
        <label className="switch">
          <input type="checkbox" checked={settings.revisionOn} onChange={(e) => updateSettings({ revisionOn: e.target.checked })} />
          <span>{settings.revisionOn ? t('Açık') : t('Kapalı')}</span>
        </label>
      </div>
      <div className="rev-swatches" role="radiogroup" aria-label={t('Revizyon turu')}>
        {REVISIONS.map((r, i) => (
          <button
            key={r.name}
            role="radio"
            aria-checked={settings.revisionGen === i + 1}
            title={t('{n}. tur: {color}', { n: i + 1, color: t(r.name) })}
            style={{ ['--c' as string]: `var(--rev-${i + 1})` }}
            onClick={() => updateSettings({ revisionGen: i + 1 })}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <p className="hint" style={{ margin: '8px 0 0' }}>
        {settings.revisionOn
          ? t("Yeni yazdıkların {color} renkle işaretleniyor; sildiğin eski metin üstü çizili kalır. PDF'te değişen satırlara * düşer.", {
              color: t(REVISIONS[settings.revisionGen - 1].name).toLocaleLowerCase(),
            })
          : t('Açınca yazdıkların seçili renkle işaretlenir, silinen metin onaylanana kadar üstü çizili kalır.')}
      </p>
      {revised ? (
        <>
        <div className="field">
          <span className="muted">{t('Revize sayfaları')}</span>
          <span className="num">{model?.revisionPages.length ? model.revisionPages.join(', ') : '—'}</span>
        </div>
        <div className="rev-actions">
          <span className="muted num">
            {counts.gens.size > 1 ? `${t('{n} tur', { n: counts.gens.size })} · ` : ''}
            {counts.rev ? t('değişiklik var') : ''}
            {counts.del ? `${counts.rev ? ', ' : ''}${t('silinmeye aday metin var')}` : ''}
          </span>
          {counts.gens.size > 1 ? (
            <button className="text-btn" onClick={() => runCommand('rev-all-current')}>
              {t('Hepsini {n}. tura taşı', { n: settings.revisionGen })}
            </button>
          ) : null}
          <button className="text-btn" onClick={() => runCommand('rev-commit')}>
            {t('Revizyonları onayla')}
          </button>
        </div>
        </>
      ) : null}
      <SceneNumberLock />
    </div>
  );
}

function SceneNumberLock() {
  const model = useStore((s) => s.model);
  const lock = useStore((s) => s.lockNumbers);
  const locked = model?.blocks.some((b) => b.el === 'sceneHeading' && b.num) ?? false;
  return (
    <div className="lock-row">
      <span className="muted">{locked ? t('Sahne numaraları kilitli') : t('Sahne numaraları serbest')}</span>
      <button className="text-btn" onClick={() => lock(!locked)}>
        {locked ? t('Kilidi aç') : t('Kilitle')}
      </button>
    </div>
  );
}

function SnapshotPanel() {
  const snapshots = useStore((s) => s.snapshots);
  const take = useStore((s) => s.takeSnapshot);
  const restore = useStore((s) => s.restoreSnapshot);
  const active = useStore((s) => s.active);
  if (active.kind !== 'script') return null;
  return (
    <div className="insp-block">
      <div className="label">
        <span>{t('Anlık görüntüler')}</span>
        <button className="text-btn" onClick={() => take()} title="Ctrl+5">
          {t('Şimdi al')}
        </button>
      </div>
      {snapshots.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>
          {t('Büyük bir değişiklikten önce senaryonun bir kopyasını sakla.')} <span className="kbd">Ctrl</span>
          <span className="kbd">5</span>
        </p>
      ) : (
        snapshots.slice(0, 8).map((s) => (
          <div className="snap" key={s.id}>
            <span>
              <span className="when">{s.label}</span>
              <span className="meta num">{t('{n} k.', { n: s.wordCount })}</span>
            </span>
            <button className="text-btn" onClick={() => restore(s)}>
              {t('Geri yükle')}
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export { colorVar };
