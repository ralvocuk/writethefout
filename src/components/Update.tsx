import { useStore } from '../store/useStore';
import { Modal } from './Dialogs';
import { checkForUpdates, installUpdate, useUpdate } from '../updater';
import { t } from '../i18n';

const close = () => useStore.getState().openDialogBox(null);

export function UpdateDialog() {
  const open = useStore((s) => s.dialog === 'update');
  const { phase, info, progress, error } = useUpdate();
  if (!open) return null;
  const busy = phase === 'checking' || phase === 'downloading' || phase === 'ready';
  const body = (() => {
    switch (phase) {
      case 'checking':
        return <p className="confirm-text">{t('Yeni sürüm aranıyor…')}</p>;
      case 'none':
        return <p className="confirm-text">{t('writetheFout. güncel. Sürüm {v}.', { v: __APP_VERSION__ })}</p>;
      case 'unconfigured':
        return (
          <>
            <p className="confirm-text">{t('Bu kopya, güncelleme kaynağı olmadan derlenmiş.')}</p>
            <p className="hint">
              {t("Otomatik güncelleme, GitHub'da yayımlanan sürümlerde çalışır. Projedeki YAYINLA.bat ilk sürümü yayımlar; o kurulumu bir kez yüklediğinde sonraki sürümler buradan tek tıkla gelir.")}
            </p>
          </>
        );
      case 'available':
      case 'downloading':
      case 'ready':
        return (
          <>
            <p className="confirm-text">
              {info?.current ? t('Sürüm {v} hazır (şu an {cur}).', { v: info?.version, cur: info.current }) : t('Sürüm {v} hazır.', { v: info?.version })}
            </p>
            {info?.notes ? <pre className="update-notes">{info.notes}</pre> : null}
            {phase !== 'available' ? (
              <div className="progress update-progress">
                <i className={phase === 'ready' ? 'full' : ''} style={{ width: `${Math.round((progress ?? 0.05) * 100)}%` }} />
              </div>
            ) : null}
            <p className="hint">
              {phase === 'ready'
                ? t('Kuruluyor; writetheFout. kendini kapatıp yeniden açacak.')
                : phase === 'downloading'
                  ? t('İndiriliyor…')
                  : t('Güncelleme indirilir, imzası doğrulanır ve kurulur. Kaydedilmemiş değişikliklerin önce sorulur.')}
            </p>
          </>
        );
      case 'error':
        return (
          <>
            <p className="confirm-text">{t('Güncelleme denetlenemedi.')}</p>
            <p className="hint">{error}</p>
          </>
        );
      default:
        return <p className="confirm-text">{t('Sürüm {v}.', { v: __APP_VERSION__ })}</p>;
    }
  })();
  return (
    <Modal
      title={t('Güncelleme')}
      onClose={busy ? () => {} : close}
      foot={
        <>
          <span className="grow" />
          <button className="btn" onClick={close} disabled={phase === 'downloading' || phase === 'ready'}>
            {phase === 'available' ? t('Sonra') : t('Kapat')}
          </button>
          {phase === 'available' ? (
            <button className="btn primary" onClick={() => installUpdate()} autoFocus>
              {t('Güncelle ve yeniden başlat')}
            </button>
          ) : phase === 'none' || phase === 'error' || phase === 'idle' ? (
            <button className="btn primary" onClick={() => checkForUpdates(true)}>
              {t('Yeniden denetle')}
            </button>
          ) : null}
        </>
      }
    >
      <div className="dialog-body">{body}</div>
    </Modal>
  );
}

/** Yeni sürüm varsa üst çubukta küçük bir işaret */
export function UpdateBadge() {
  const { phase, info, dismissed } = useUpdate();
  if (phase !== 'available' || dismissed) return null;
  return (
    <button className="update-badge" onClick={() => useStore.getState().openDialogBox('update')} title={t('Yeni sürüm hazır')}>
      <i />
      {t('{v} hazır', { v: info?.version })}
    </button>
  );
}
