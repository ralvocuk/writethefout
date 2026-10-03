import { useStore } from '../store/useStore';
import { ThemeSwitch, Wordmark } from './Chrome';
import { UpdateBadge } from './Update';
import { RecentList, startImport } from './Dialogs';
import { baseName } from '../script/document';
import { LangSwitch } from './LangSwitch';
import { locale, t } from '../i18n';

/** Açılış ekranı: yeni / aç / örnek / içe aktar, son açılanlar ve kurtarılabilir çalışmalar */
export function Welcome() {
  const newDocument = useStore((s) => s.newDocument);
  const openDialog = useStore((s) => s.openDialog);
  const recovery = useStore((s) => s.recovery);
  const restore = useStore((s) => s.restoreRecovery);
  const discard = useStore((s) => s.discardRecovery);

  const choices = [
    { title: t('Yeni senaryo'), body: t('Boş sayfa. Tab ve Enter ile kendiliğinden biçimlenir.'), keys: 'Ctrl+N', run: () => newDocument(false) },
    { title: t('Aç…'), body: t('Bilgisayarındaki bir .fountain senaryosunu aç.'), keys: 'Ctrl+O', run: () => openDialog() },
    { title: t('İçe aktar…'), body: t('Final Draft, Highland, Fade In ya da Celtx dosyasından devam et.'), keys: '', run: () => startImport() },
    { title: t('Örnek senaryo'), body: t('“Fener Bekçisi” — iki perde, notlar, çift diyalog, etiketler (Türkçe).'), keys: '', run: () => newDocument(true) },
  ];

  return (
    <main className="welcome">
      <div className="welcome-update">
        <UpdateBadge />
      </div>
      <div className="welcome-theme">
        <LangSwitch />
        <span>
          <span className="muted">{t('Tema')}</span>
          <ThemeSwitch />
        </span>
      </div>
      <div className="welcome-inner">
        <h1>
          <Wordmark big />
        </h1>
        <p className="lede">{t('Senaryo yazmak için bir masa. Gerisini sayfaya dök.')}</p>

        {recovery.length ? (
          <section className="recovery">
            <h3 className="label">{t('Kurtarılabilir çalışma')}</h3>
            {recovery.map((r) => (
              <div className="recovery-row" key={r.slot}>
                <span>
                  <b>{r.path ? `${baseName(r.path)}.fountain` : t('Adsız senaryo')}</b>
                  <span className="muted">
                    {' '}
                    · {t('kaydedilmemiş değişiklikler, {when}', { when: new Date(r.at).toLocaleString(locale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
                  </span>
                </span>
                <span>
                  <button className="btn primary" onClick={() => restore(r.slot)}>
                    {t('Geri yükle')}
                  </button>{' '}
                  <button className="btn" onClick={() => discard(r.slot)}>
                    {t('Sil')}
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
          <h3 className="label">{t('Son açılanlar')}</h3>
          <RecentList compact />
        </section>

        <div className="foot">
          <span>{t('Senaryolar bilgisayarında standart .fountain dosyası olarak durur; internet gerekmez.')}</span>
          <span>{t('Sürüm {v}', { v: __APP_VERSION__ })}</span>
        </div>
      </div>
    </main>
  );
}
