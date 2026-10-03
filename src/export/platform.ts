/** Dosya kaydetme/açma: masaüstünde Tauri, tarayıcıda indirme. */
import { isTauri } from '../data/repository';
import type { FontSet } from './pdf';
import regularUrl from '../assets/fonts/CourierPrime_400Regular.ttf?url';
import boldUrl from '../assets/fonts/CourierPrime_700Bold.ttf?url';
import italicUrl from '../assets/fonts/CourierPrime_400Regular_Italic.ttf?url';
import boldItalicUrl from '../assets/fonts/CourierPrime_700Bold_Italic.ttf?url';

let fontCache: FontSet | null = null;
export async function loadFonts(): Promise<FontSet> {
  if (fontCache) return fontCache;
  const get = async (u: string) => new Uint8Array(await (await fetch(u)).arrayBuffer());
  const [regular, bold, italic, boldItalic] = await Promise.all([regularUrl, boldUrl, italicUrl, boldItalicUrl].map(get));
  fontCache = { regular, bold, italic, boldItalic };
  return fontCache;
}

export interface SaveResult {
  path: string | null;
}

/** Kullanıcıya konum sorup dosyayı yazar. İptal edilirse path = null. */
export async function saveFile(
  defaultName: string,
  data: Uint8Array | string,
  filter: { name: string; extensions: string[] },
): Promise<SaveResult> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await save({ defaultPath: defaultName, filters: [filter] });
    if (!path) return { path: null };
    await invoke('write_file', { path, data: Array.from(bytes) });
    return { path };
  }
  const blob = new Blob([bytes as BlobPart]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = defaultName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return { path: defaultName };
}

export async function openPath(path: string) {
  if (!isTauri()) return;
  const { openPath: open } = await import('@tauri-apps/plugin-opener');
  await open(path);
}

export async function revealPath(path: string) {
  if (!isTauri()) return;
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
  await revealItemInDir(path);
}

/** Dosya seçtirip ham içeriğini döndürür (içe aktarma). */
export async function pickFile(extensions: string[]): Promise<{ name: string; bytes: Uint8Array } | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    const path = await open({ multiple: false, filters: [{ name: 'Senaryo', extensions }] });
    if (!path || Array.isArray(path)) return null;
    const data = await invoke<number[]>('read_file', { path });
    return { name: path.split(/[\\/]/).pop() ?? path, bytes: new Uint8Array(data) };
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = extensions.map((e) => `.${e}`).join(',');
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) } : null);
    };
    input.click();
  });
}

/* ---------- Yedek kasası ---------- */

export interface BackupEntry {
  name: string;
  size: number;
  modified: number;
}

const LOCAL_BACKUPS = 'wtf.backups.v1';

export async function backupSave(name: string, content: string) {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('backup_save', { name, content });
    return;
  }
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_BACKUPS) || '[]') as (BackupEntry & { content: string })[];
    all.unshift({ name, size: content.length, modified: Date.now(), content });
    localStorage.setItem(LOCAL_BACKUPS, JSON.stringify(all.slice(0, 10)));
  } catch {
    /* tarayıcıda yer yoksa geç */
  }
}

export async function backupList(): Promise<BackupEntry[]> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<BackupEntry[]>('backup_list');
  }
  try {
    return (JSON.parse(localStorage.getItem(LOCAL_BACKUPS) || '[]') as BackupEntry[]).map(({ name, size, modified }) => ({ name, size, modified }));
  } catch {
    return [];
  }
}

export async function backupRead(name: string): Promise<string> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<string>('backup_read', { name });
  }
  const all = JSON.parse(localStorage.getItem(LOCAL_BACKUPS) || '[]') as (BackupEntry & { content: string })[];
  return all.find((b) => b.name === name)?.content ?? '';
}

export async function backupFolder() {
  if (!isTauri()) return;
  const { invoke } = await import('@tauri-apps/api/core');
  const path = await invoke<string>('backup_path');
  await openPath(path);
}

export const safeName = (s: string) =>
  (s || 'senaryo')
    .replace(/[\\/:*?"<>|]+/g, '')
    .trim()
    .slice(0, 80) || 'senaryo';
