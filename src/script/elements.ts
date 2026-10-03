/** Senaryo elemanları ve ortak tanımlar. Editör, sayfalama, dışa/içe aktarma bu dosyayı paylaşır. */

export type El =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'centered'
  | 'lyrics'
  | 'section'
  | 'pageBreak';

/** Tab/Enter akışına giren temel elemanlar (Ctrl+1…6) */
export const CORE: El[] = ['sceneHeading', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];
/** Ek elemanlar (Ctrl+7…0) */
export const EXTRA: El[] = ['centered', 'lyrics', 'section', 'pageBreak'];

export const EL_LABEL: Record<El, string> = {
  sceneHeading: 'Sahne başlığı',
  action: 'Aksiyon',
  character: 'Karakter',
  parenthetical: 'Parantez',
  dialogue: 'Diyalog',
  transition: 'Geçiş',
  centered: 'Ortalı',
  lyrics: 'Şarkı sözü',
  section: 'Bölüm',
  pageBreak: 'Sayfa sonu',
};

/** Basılmayan elemanlar */
export const NON_PRINTING: El[] = ['section'];

/** Hollywood revizyon renkleri (kuşak sırasıyla) */
export const REVISIONS = [
  { name: 'Mavi', en: 'Blue', color: '#3d6fb6' },
  { name: 'Pembe', en: 'Pink', color: '#d0648f' },
  { name: 'Sarı', en: 'Yellow', color: '#c9a227' },
  { name: 'Yeşil', en: 'Green', color: '#4f8f4a' },
  { name: 'Altın', en: 'Goldenrod', color: '#b8862b' },
  { name: 'Devetüyü', en: 'Buff', color: '#a8865a' },
  { name: 'Gül', en: 'Salmon', color: '#c86a5a' },
  { name: 'Kiraz', en: 'Cherry', color: '#a3273a' },
] as const;

/** Prodüksiyon dökümü etiket kategorileri */
export const TAG_CATS = [
  { id: 'cast', name: 'Oyuncu', color: '--pig-bordeaux' },
  { id: 'extra', name: 'Figüran', color: '--pig-earth' },
  { id: 'prop', name: 'Aksesuar', color: '--pig-indigo' },
  { id: 'costume', name: 'Kostüm', color: '--pig-olive' },
  { id: 'makeup', name: 'Makyaj', color: '--pig-mustard' },
  { id: 'vehicle', name: 'Araç', color: '--pig-slate' },
  { id: 'animal', name: 'Hayvan', color: '--pig-earth' },
  { id: 'sfx', name: 'Efekt', color: '--pig-bordeaux' },
  { id: 'sound', name: 'Ses / Müzik', color: '--pig-indigo' },
  { id: 'set', name: 'Dekor', color: '--pig-olive' },
] as const;
export type TagCat = (typeof TAG_CATS)[number]['id'];

/** Sahne renkleri (doğal pigmentler) */
export const SCENE_COLORS = [
  { id: 'indigo', name: 'Lacivert', v: '--pig-indigo' },
  { id: 'earth', name: 'Toprak', v: '--pig-earth' },
  { id: 'olive', name: 'Zeytin', v: '--pig-olive' },
  { id: 'bordeaux', name: 'Bordo', v: '--pig-bordeaux' },
  { id: 'mustard', name: 'Hardal', v: '--pig-mustard' },
  { id: 'slate', name: 'Arduvaz', v: '--pig-slate' },
] as const;
export const colorVar = (id: string | null | undefined) =>
  SCENE_COLORS.find((c) => c.id === id)?.v ?? null;

export const upperTr = (s: string) => s.toLocaleUpperCase('tr-TR');

/** "ELİF (D.S.)" → "ELİF" ; "ELİF ^" → "ELİF" */
export const baseName = (s: string) =>
  upperTr(s.replace(/\s*\^\s*$/u, '').replace(/\s*\((?:[^)]*)\)\s*$/u, '').trim());

export const countWords = (text: string): number => {
  const m = text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu);
  return m ? m.length : 0;
};

export const formatNumber = (n: number) => n.toLocaleString('tr-TR');

/** 1/8 sayfa birimini "2⅜" gibi yazar */
export function formatEighths(eighths: number): string {
  if (eighths <= 0) return '0';
  const whole = Math.floor(eighths / 8);
  const rest = eighths % 8;
  const frac = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'][rest];
  return `${whole > 0 ? whole : ''}${frac}` || '0';
}
