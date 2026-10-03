/**
 * Otomatik güncelleme (GitHub Releases + imzalı paketler, tauri-plugin-updater).
 * Açılışta sessizce denetler; yeni sürüm varsa küçük bir bildirim gösterir.
 */
import { create } from 'zustand';
import { isTauri } from './data/repository';
import { t } from './i18n';
import { useStore } from './store/useStore';

type Phase = 'idle' | 'checking' | 'available' | 'none' | 'downloading' | 'ready' | 'error' | 'unconfigured';

interface UpdateInfo {
  version: string;
  current: string;
  date?: string;
  notes?: string;
}

interface UpdateState {
  phase: Phase;
  info: UpdateInfo | null;
  /** 0–1 (bilinmiyorsa null) */
  progress: number | null;
  error: string | null;
  /** kullanıcı bildirimi kapattı */
  dismissed: boolean;
}

export const useUpdate = create<UpdateState>(() => ({ phase: 'idle', info: null, progress: null, error: null, dismissed: false }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pending: any = null;

const describe = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e);
  if (/does not have any endpoints|empty ?endpoints/i.test(m)) return 'unconfigured';
  return m;
};

export async function checkForUpdates(manual = false) {
  if (manual) useStore.getState().openDialogBox('update');
  if (!isTauri()) {
    useUpdate.setState({ phase: 'unconfigured', error: null });
    return;
  }
  const st = useUpdate.getState();
  if (st.phase === 'checking' || st.phase === 'downloading') return;
  useUpdate.setState({ phase: 'checking', error: null });
  try {
    const { check } = await import('@tauri-apps/plugin-updater');
    const u = await check({ timeout: 20000 });
    if (!u) {
      useUpdate.setState({ phase: 'none', info: null });
      return;
    }
    pending = u;
    useUpdate.setState({
      phase: 'available',
      dismissed: false,
      info: { version: u.version, current: u.currentVersion, date: u.date, notes: u.body },
    });
  } catch (e) {
    const d = describe(e);
    if (d === 'unconfigured') useUpdate.setState({ phase: 'unconfigured', error: null });
    // açılıştaki sessiz denetimde ağ hatası gösterme
    else useUpdate.setState({ phase: manual ? 'error' : 'idle', error: d });
  }
}

export async function installUpdate() {
  if (!pending) return;
  if (!(await useStore.getState().guardUnsaved(t('Güncellemeden önce kaydedilsin mi?')))) return;
  useUpdate.setState({ phase: 'downloading', progress: 0, error: null });
  let total = 0;
  let got = 0;
  try {
    await pending.downloadAndInstall((ev: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => {
      if (ev.event === 'Started') total = ev.data?.contentLength ?? 0;
      else if (ev.event === 'Progress') {
        got += ev.data?.chunkLength ?? 0;
        useUpdate.setState({ progress: total ? Math.min(1, got / total) : null });
      } else if (ev.event === 'Finished') useUpdate.setState({ progress: 1 });
    });
    useUpdate.setState({ phase: 'ready' });
    // Windows'ta kurulum uygulamayı kendisi kapatıp yeniden açar; diğer sistemlerde yeniden başlat
    const { relaunch } = await import('@tauri-apps/plugin-process');
    await relaunch();
  } catch (e) {
    useUpdate.setState({ phase: 'error', error: describe(e) });
  }
}

/** Açılıştan birkaç saniye sonra sessiz denetim (günde en çok bir kez değil, her açılışta; maliyeti tek bir küçük istek) */
export function scheduleStartupCheck() {
  if (!isTauri()) return;
  setTimeout(() => void checkForUpdates(false), 6000);
}
