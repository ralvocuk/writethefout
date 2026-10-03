import { useStore } from '../store/useStore';
import { Modal } from './Dialogs';
import { checkForUpdates, installUpdate, useUpdate } from '../updater';

const close = () => useStore.getState().openDialogBox(null);

export function UpdateDialog() {
  const open = useStore((s) => s.dialog === 'update');
  const { phase, info, progress, error } = useUpdate();
  if (!open) return null;
  const busy = phase === 'checking' || phase === 'downloading' || phase === 'ready';
  const body = (() => {
    switch (phase) {
      case 'checking':
        return <p className="confirm-text">Yeni sürüm aranıyor…</p>;
      case 'none':
        return <p className="confirm-text">writetheFout. güncel. Sürüm {__APP_VERSION__}.</p>;
      case 'unconfigured':
        return (
          <>
            <p className="confirm-text">Bu kopya, güncelleme kaynağı olmadan derlenmiş.</p>
            <p className="hint">
              Otomatik güncelleme, GitHub'da yayımlanan sürümlerde çalışır. Projedeki <b>YAYINLA.bat</b> ilk sürümü yayımlar; o kurulumu bir
              kez yüklediğinde sonraki sürümler buradan tek tıkla gelir.
            </p>
          </>
        );
      case 'available':
      case 'downloading':
      case 'ready':
        return (
          <>
            <p className="confirm-text">
              Sürüm <b>{info?.version}</b> hazır{info?.current ? ` (şu an ${info.current})` : ''}.
            </p>
            {info?.notes ? <pre className="update-notes">{info.notes}</pre> : null}
            {phase !== 'available' ? (
              <div className="progress update-progress">
                <i className={phase === 'ready' ? 'full' : ''} style={{ width: `${Math.round((progress ?? 0.05) * 100)}%` }} />
              </div>
            ) : null}
            <p className="hint">
              {phase === 'ready'
                ? 'Kuruluyor; writetheFout. kendini kapatıp yeniden açacak.'
                : phase === 'downloading'
                  ? 'İndiriliyor…'
                  : 'Güncelleme indirilir, imzası doğrulanır ve kurulur. Kaydedilmemiş değişikliklerin önce sorulur.'}
            </p>
          </>
        );
      case 'error':
        return (
          <>
            <p className="confirm-text">Güncelleme denetlenemedi.</p>
            <p className="hint">{error}</p>
          </>
        );
      default:
        return <p className="confirm-text">Sürüm {__APP_VERSION__}.</p>;
    }
  })();
  return (
    <Modal
      title="Güncelleme"
      onClose={busy ? () => {} : close}
      foot={
        <>
          <span className="grow" />
          <button className="btn" onClick={close} disabled={phase === 'downloading' || phase === 'ready'}>
            {phase === 'available' ? 'Sonra' : 'Kapat'}
          </button>
          {phase === 'available' ? (
            <button className="btn primary" onClick={() => installUpdate()} autoFocus>
              Güncelle ve yeniden başlat
            </button>
          ) : phase === 'none' || phase === 'error' || phase === 'idle' ? (
            <button className="btn primary" onClick={() => checkForUpdates(true)}>
              Yeniden denetle
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
    <button className="update-badge" onClick={() => useStore.getState().openDialogBox('update')} title="Yeni sürüm hazır">
      <i />
      {info?.version} hazır
    </button>
  );
}
