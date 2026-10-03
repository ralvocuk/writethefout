/**
 * Senaryo dosyaları: aç, kaydet (atomik), değiştirilme zamanı.
 * Masaüstünde Tauri komutları; tarayıcıda (geliştirme ve testler) localStorage içinde sanal dosyalar.
 */
import { isTauri } from './repository';

export const SCRIPT_EXTENSIONS = ['fountain'];
const VFS = 'wtf.vfs.v1';

type Vfs = Record<string, { text: string; mtime: number }>;
const vfs = (): Vfs => {
  try {
    return JSON.parse(localStorage.getItem(VFS) || '{}');
  } catch {
    return {};
  }
};
const saveVfs = (v: Vfs) => {
  try {
    localStorage.setItem(VFS, JSON.stringify(v));
  } catch {
    /* yer yoksa geç */
  }
};

export async function readText(path: string): Promise<{ text: string; mtime: number | null }> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('read_text', { path });
  }
  const f = vfs()[path];
  if (!f) throw new Error('Dosya bulunamadı.');
  return f;
}

/** Atomik yazar; yeni değiştirilme zamanını döndürür */
export async function writeText(path: string, text: string): Promise<number | null> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('write_text', { path, text });
  }
  const v = vfs();
  const mtime = Date.now();
  v[path] = { text, mtime };
  saveVfs(v);
  return mtime;
}

export async function fileMtime(path: string): Promise<number | null> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('file_mtime', { path });
  }
  return vfs()[path]?.mtime ?? null;
}

export async function fileExists(path: string): Promise<boolean> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke('file_exists', { path });
  }
  return !!vfs()[path];
}

/** Açılacak senaryoyu seçtir */
export async function pickOpenPath(): Promise<string | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const p = await open({ multiple: false, filters: [{ name: 'Fountain senaryosu', extensions: SCRIPT_EXTENSIONS }] });
    return typeof p === 'string' ? p : null;
  }
  // tarayıcı: gerçek dosyayı sanal dosya sistemine al
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.fountain';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      const path = `C:\\Senaryolar\\${f.name}`;
      const v = vfs();
      v[path] = { text: await f.text(), mtime: f.lastModified };
      saveVfs(v);
      resolve(path);
    };
    input.click();
  });
}

/** Kaydedilecek yolu seçtir */
export async function pickSavePath(defaultName: string): Promise<string | null> {
  const name = defaultName.toLowerCase().endsWith('.fountain') ? defaultName : `${defaultName}.fountain`;
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const p = await save({ defaultPath: name, filters: [{ name: 'Fountain senaryosu', extensions: SCRIPT_EXTENSIONS }] });
    if (!p) return null;
    return /\.fountain$/i.test(p) ? p : `${p}.fountain`;
  }
  const p = window.prompt('Kaydedilecek dosya adı', name);
  if (!p) return null;
  const clean = p.replace(/[\\/]/g, '');
  return `C:\\Senaryolar\\${/\.fountain$/i.test(clean) ? clean : `${clean}.fountain`}`;
}

/** Uygulama bir dosyayla açıldıysa (çift tıklama ya da ?file=) */
export async function startupFile(): Promise<string | null> {
  const q = new URLSearchParams(window.location.search).get('file');
  if (q) return q;
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    // yalnızca ana pencere komut satırı argümanını kullanır
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    if (getCurrentWindow().label !== 'main') return null;
    return invoke<string | null>('startup_file');
  }
  return null;
}

/** Yeni uygulama penceresi (isteğe bağlı bir dosyayla) */
export async function openNewWindow(path?: string) {
  if (!isTauri()) {
    window.open(path ? `?file=${encodeURIComponent(path)}` : '?new=1', '_blank');
    return;
  }
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const label = `w${Date.now().toString(36)}`;
  new WebviewWindow(label, {
    url: path ? `index.html?file=${encodeURIComponent(path)}` : 'index.html?new=1',
    title: 'writetheFout.',
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
  });
}

export async function setWindowTitle(title: string) {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().setTitle(title);
  } else document.title = title;
}

/** Pencere çerçevesinin (başlık çubuğu) açık/koyu görünümü */
export async function setWindowTheme(dark: boolean) {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().setTheme(dark ? 'dark' : 'light');
}

/** Pencere kapatılmak istendiğinde çağrılır; false dönerse kapatma iptal edilir */
export async function onCloseRequested(handler: () => Promise<boolean>) {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const w = getCurrentWindow();
    return w.onCloseRequested(async (e) => {
      e.preventDefault();
      if (await handler()) await w.destroy();
    });
  }
  const fn = (e: BeforeUnloadEvent) => {
    e.preventDefault();
  };
  return () => window.removeEventListener('beforeunload', fn);
}

export async function closeWindow() {
  if (isTauri()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } else window.close();
}

/** Yerel menü olaylarını dinle */
export async function onMenu(handler: (id: string) => void) {
  if (!isTauri()) return () => {};
  const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  return getCurrentWebviewWindow().listen<string>('menu', (e) => handler(e.payload));
}
