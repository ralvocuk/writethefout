import { useStore } from '../store/useStore';
import { ThemeSwitch, Wordmark } from './Chrome';
import { UpdateBadge } from './Update';
import { RecentList, startImport } from './Dialogs';
import { baseName } from '../script/document';

/** Açılış ekranı: yeni / aç / örnek / içe aktar, son açılanlar ve kurtarılabilir çalışmalar */
export function Welcome() {
  const newDocument = useStore((s) => s.newDocument);
  const openDialog = useStore((s) => s.openDialog);
  const recovery = useStore((s) => s.recovery);
  const restore = useStore((s) => s.restoreRecovery);
  const discard = useStore((s) => s.discardRecovery);

  const choices = [
    { title: 'Yeni senaryo', body: 'Boş sayfa. Tab ve Enter ile kendiliğinden biçimlenir.', keys: 'Ctrl+N', run: () => newDocument(false) },
    { title: 'Aç…', body: 'Bilgisayarındaki bir .fountain senaryosunu aç.', keys: 'Ctrl+O', run: () => openDialog() },
    { title: 'İçe aktar…', body: 'Final Draft, Highland, Fade In ya da Celtx dosyasından devam et.', keys: '', run: () => startImport() },
    { title: 'Örnek senaryo', body: '“Fener Bekçisi” — iki perde, notlar, çift diyalog, etiketler.', keys: '', run: () => newDocument(true) },
  ];

  return (
    <main className="welcome">
      <div className="welcome-update">
        <UpdateBadge />
      </div>
      <div className="welcome-theme">
        <span className="muted">Tema</span>
        <ThemeSwitch />
      </div>
      <div className="welcome-inner">
        <h1>
          <Wordmark big />
        </h1>
        <p className="lede">Senaryo yazmak için bir masa. Gerisini sayfaya dök.</p>

        {recovery.length ? (
          <section className="recovery">
            <h3 className="label">Kurtarılabilir çalışma</h3>
            {recovery.map((r) => (
              <div className="recovery-row" key={r.slot}>
                <span>
                  <b>{r.path ? `${baseName(r.path)}.fountain` : 'Adsız senaryo'}</b>
                  <span className="muted">
                    {' '}
                    · kaydedilmemiş değişiklikler, {new Date(r.at).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
                <span>
                  <button className="btn primary" onClick={() => restore(r.slot)}>
                    Geri yükle
                  </button>{' '}
                  <button className="btn" onClick={() => discard(r.slot)}>
                    Sil
                  </button>
                </span>
              </div>
            ))}
          </section>
        ) : null}

        <div className="choices four">
          {choices.map((c) => (
            <button key={c.title} className="card choice" onClick={c.run}>
              <div className="card-title">
                <span className="card-heading">{c.title}</span>
              </div>
              <div className="card-body" style={{ WebkitLineClamp: 3 }}>
                {c.body}
              </div>
              <div className="card-foot">
                <span />
                {c.keys ? <span className="kbd">{c.keys}</span> : <span />}
              </div>
            </button>
          ))}
        </div>

        <section className="welcome-recent">
          <h3 className="label">Son açılanlar</h3>
          <RecentList compact />
        </section>

        <div className="foot">
          <span>Senaryolar bilgisayarında standart .fountain dosyası olarak durur; internet gerekmez.</span>
          <span>Sürüm {__APP_VERSION__}</span>
        </div>
      </div>
    </main>
  );
}
