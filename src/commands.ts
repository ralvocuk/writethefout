/**
 * Tek komut kaydı: yerel menü çubuğu, komut paleti ve klavye kısayolları aynı listeden beslenir.
 */
import { useStore, type Tab } from './store/useStore';
import { CORE, EXTRA, EL_LABEL, REVISIONS, type El } from './script/elements';
import { insertPageBreak, setElement, toggleDual, toggleMarkOnSelection } from './editor/screenplay';
import { activeEditor } from './components/ScriptEditor';
import { appendElement } from './components/Navigator';
import { runBackup, startImport } from './components/Dialogs';
import { closeWindow, openNewWindow } from './data/files';
import { gotoNextError } from './editor/spell';
import { checkForUpdates } from './updater';

export interface Command {
  id: string;
  group: string;
  label: string;
  /** gösterim için ("Ctrl+S") */
  keys?: string;
  run: () => void | Promise<unknown>;
  /** yalnız senaryo açıkken */
  needsDoc?: boolean;
}

const st = () => useStore.getState();
const ed = () => activeEditor.current;
const tab = (t: Tab) => () => {
  st().setTab(t);
  if (t === 'write') st().openScript();
};
const el = (e: El) => () => {
  const editor = ed();
  if (!editor) return;
  if (e === 'pageBreak') insertPageBreak(editor);
  else setElement(editor, e);
};

export function commands(): Command[] {
  const list: Command[] = [
    { id: 'new', group: 'Dosya', label: 'Yeni senaryo', keys: 'Ctrl+N', run: () => st().newDocument(false) },
    { id: 'new-window', group: 'Dosya', label: 'Yeni pencere', keys: 'Ctrl+Shift+N', run: () => openNewWindow() },
    { id: 'open', group: 'Dosya', label: 'Aç…', keys: 'Ctrl+O', run: () => st().openDialog() },
    { id: 'recent', group: 'Dosya', label: 'Son açılanlar…', run: () => st().openDialogBox('recent') },
    { id: 'save', group: 'Dosya', label: 'Kaydet', keys: 'Ctrl+S', run: () => st().save(), needsDoc: true },
    { id: 'save-as', group: 'Dosya', label: 'Farklı kaydet…', keys: 'Ctrl+Shift+S', run: () => st().saveAs(), needsDoc: true },
    { id: 'import', group: 'Dosya', label: 'İçe aktar (Final Draft, Highland, Fade In, Celtx, Fountain)…', run: () => startImport() },
    { id: 'export', group: 'Dosya', label: 'Dışa aktar (PDF, Fountain, Final Draft)…', keys: 'Ctrl+E', run: () => st().openDialogBox('export'), needsDoc: true },
    { id: 'sides', group: 'Dosya', label: 'Oyuncu sayfaları ve replik dökümü (PDF)…', run: () => st().openDialogBox('sides'), needsDoc: true },
    { id: 'print', group: 'Dosya', label: 'Baskı önizleme ve yazdır', keys: 'Ctrl+P', run: tab('preview'), needsDoc: true },
    { id: 'snapshot', group: 'Dosya', label: 'Anlık görüntü al', keys: 'Ctrl+5', run: () => st().takeSnapshot(), needsDoc: true },
    { id: 'backups', group: 'Dosya', label: 'Yedek kasası…', run: () => st().openDialogBox('backups') },
    { id: 'backup-now', group: 'Dosya', label: 'Şimdi yedekle', run: () => runBackup(true), needsDoc: true },
    {
      id: 'autosave',
      group: 'Dosya',
      label: st().autosave ? 'Otomatik kaydetmeyi kapat' : 'Otomatik kaydetmeyi aç',
      run: () => st().setAutosave(!st().autosave),
    },
    { id: 'close', group: 'Dosya', label: 'Pencereyi kapat', keys: 'Ctrl+W', run: () => closeWindow() },

    { id: 'undo', group: 'Düzen', label: 'Geri al', keys: 'Ctrl+Z', run: () => ed()?.commands.undo(), needsDoc: true },
    { id: 'redo', group: 'Düzen', label: 'Yinele', keys: 'Ctrl+Y', run: () => ed()?.commands.redo(), needsDoc: true },
    { id: 'find', group: 'Düzen', label: 'Bul ve değiştir', keys: 'Ctrl+F', run: () => openFind(), needsDoc: true },
    { id: 'palette', group: 'Düzen', label: 'Komut paleti', keys: 'Ctrl+K', run: () => st().openDialogBox('palette') },
    {
      id: 'spell-toggle',
      group: 'Düzen',
      label: st().spellOn ? 'Yazım denetimini kapat' : 'Yazım denetimini aç',
      keys: 'F7',
      run: () => {
        st().toggle('spellOn');
        st().notify(st().spellOn ? 'Yazım denetimi açık' : 'Yazım denetimi kapalı');
      },
    },
    {
      id: 'spell-next',
      group: 'Düzen',
      label: 'Sonraki yazım hatası',
      keys: 'F8',
      run: () => {
        const e = ed();
        if (!st().spellOn) st().toggle('spellOn', true);
        if (e && !gotoNextError(e)) st().notify('Yazım hatası bulunamadı');
      },
      needsDoc: true,
    },
    { id: 'dictionary', group: 'Düzen', label: 'Kişisel sözlük ve yazım denetimi…', run: () => st().openDialogBox('dictionary') },

    { id: 'tab-write', group: 'Görünüm', label: 'Yaz', run: tab('write'), needsDoc: true },
    { id: 'tab-board', group: 'Görünüm', label: 'Mantar Pano', run: tab('board'), needsDoc: true },
    { id: 'tab-outline', group: 'Görünüm', label: 'Anahat', run: tab('outline'), needsDoc: true },
    { id: 'tab-characters', group: 'Görünüm', label: 'Karakterler', run: tab('characters'), needsDoc: true },
    { id: 'tab-timeline', group: 'Görünüm', label: 'Zaman Çizelgesi', run: tab('timeline'), needsDoc: true },
    { id: 'tab-stats', group: 'Görünüm', label: 'İstatistik', run: tab('stats'), needsDoc: true },
    { id: 'focus', group: 'Görünüm', label: 'Odak modu', keys: 'F11', run: () => st().toggle('focus'), needsDoc: true },
    { id: 'inspector', group: 'Görünüm', label: 'Denetçi', keys: 'Ctrl+Alt+I', run: () => st().toggle('inspector'), needsDoc: true },
    { id: 'zoom-in', group: 'Görünüm', label: 'Yakınlaştır', keys: 'Ctrl++', run: () => st().setZoom(st().zoom + 0.1) },
    { id: 'zoom-out', group: 'Görünüm', label: 'Uzaklaştır', keys: 'Ctrl+-', run: () => st().setZoom(st().zoom - 0.1) },
    { id: 'zoom-reset', group: 'Görünüm', label: 'Gerçek boyut', keys: 'Ctrl+0', run: () => st().setZoom(1) },
    { id: 'theme-dark', group: 'Görünüm', label: 'Karanlık tema aç / kapat', keys: 'Ctrl+Shift+L', run: () => st().setTheme(st().theme === 'dark' ? 'paper' : 'dark') },
    { id: 'theme-paper', group: 'Görünüm', label: 'Tema: Kâğıt', run: () => st().setTheme('paper') },
    { id: 'theme-night', group: 'Görünüm', label: 'Tema: Gece', run: () => st().setTheme('night') },
    { id: 'theme-typewriter', group: 'Görünüm', label: 'Tema: Daktilo', run: () => st().setTheme('typewriter') },

    { id: 'title-page', group: 'Senaryo', label: 'Başlık sayfası…', run: () => st().openDialogBox('title'), needsDoc: true },
    { id: 'add-scene', group: 'Senaryo', label: 'Sona sahne ekle', run: () => appendElement('sceneHeading'), needsDoc: true },
    { id: 'add-section', group: 'Senaryo', label: 'Sona bölüm ekle', run: () => appendElement('section'), needsDoc: true },
    { id: 'dual', group: 'Senaryo', label: 'Çift diyalog (karakter satırında)', keys: 'Ctrl+D', run: () => ed() && toggleDual(ed()!), needsDoc: true },
    { id: 'note', group: 'Senaryo', label: 'Not ekle / kaldır [[ ]]', keys: 'Ctrl+Shift+M', run: () => ed() && toggleMarkOnSelection(ed()!, 'note'), needsDoc: true },
    { id: 'omit', group: 'Senaryo', label: 'Metni kapat / aç /* */', keys: 'Ctrl+/', run: () => ed() && toggleMarkOnSelection(ed()!, 'omit'), needsDoc: true },
    { id: 'tag', group: 'Senaryo', label: 'Seçimi etiketle', keys: 'Ctrl+T', run: () => window.dispatchEvent(new Event('wtf-tag')), needsDoc: true },
    {
      id: 'lock',
      group: 'Senaryo',
      label: 'Sahne numaralarını kilitle / aç',
      run: () => {
        const locked = st().model?.blocks.some((b) => b.el === 'sceneHeading' && b.num);
        st().lockNumbers(!locked);
      },
      needsDoc: true,
    },
    { id: 'goals', group: 'Senaryo', label: 'Yazma hedefleri…', run: () => st().openDialogBox('goals') },
    {
      id: 'sprint',
      group: 'Senaryo',
      label: st().sprint ? 'Süreli seansı durdur' : 'Süreli seans başlat (25 dk)',
      run: () => (st().sprint ? st().stopSprint(false) : st().startSprint(25, null)),
      needsDoc: true,
    },
    ...[...CORE, ...EXTRA].map<Command>((e, i) => ({
      id: `el-${e}`,
      group: 'Eleman',
      label: EL_LABEL[e],
      keys: e === 'pageBreak' ? 'Ctrl+Enter' : `Ctrl+${i + 1}`,
      run: el(e),
      needsDoc: true,
    })),

    { id: 'rev-toggle', group: 'Revizyon', label: 'Revizyon modunu aç / kapat', keys: 'Ctrl+Shift+R', run: () => st().updateSettings({ revisionOn: !st().settings.revisionOn }), needsDoc: true },
    {
      id: 'rev-next',
      group: 'Revizyon',
      label: 'Sonraki revizyon kuşağı',
      run: () => st().updateSettings({ revisionGen: Math.min(8, st().settings.revisionGen + 1), revisionOn: true }),
      needsDoc: true,
    },
    ...REVISIONS.map<Command>((r, i) => ({
      id: `rev-${i + 1}`,
      group: 'Revizyon',
      label: `Kuşak ${i + 1}: ${r.name}`,
      run: () => st().updateSettings({ revisionGen: i + 1, revisionOn: true }),
      needsDoc: true,
    })),
    { id: 'rev-all-current', group: 'Revizyon', label: 'Tüm işaretleri seçili kuşağa taşı', run: () => st().moveRevisionsTo(st().settings.revisionGen), needsDoc: true },
    {
      id: 'rev-commit',
      group: 'Revizyon',
      label: 'Revizyonları onayla',
      run: async () => {
        const c = await st().ask('Revizyonları onayla', 'Tüm revizyon işaretleri kaldırılacak ve silinmeye aday metinler silinecek. Öncesinin anlık görüntüsü alınır.', [
          { id: 'no', label: 'Vazgeç' },
          { id: 'yes', label: 'Onayla', primary: true },
        ]);
        if (c !== 'yes') return;
        await st().takeSnapshot('Revizyon onayından önce');
        st().commitRevisions();
      },
      needsDoc: true,
    },

    { id: 'shortcuts', group: 'Yardım', label: 'Klavye kısayolları', keys: 'F1', run: () => st().openDialogBox('shortcuts') },
    { id: 'update-check', group: 'Yardım', label: 'Güncellemeleri denetle…', run: () => checkForUpdates(true) },
    { id: 'about', group: 'Yardım', label: 'writetheFout. hakkında', run: () => st().openDialogBox('about') },
  ];
  return list;
}

export function openFind() {
  const s = st();
  if (s.tab !== 'write' || s.active.kind !== 'script') s.openScript();
  s.toggle('findOpen', true);
  window.dispatchEvent(new Event('wtf-find'));
}

export function runCommand(id: string) {
  const c = commands().find((x) => x.id === id);
  if (!c) return;
  if (c.needsDoc && st().status !== 'ready') return;
  void c.run();
}

/** Klavye: komut kimliği. Editör içi elemanlar (Ctrl+1–9, Ctrl+Enter, Ctrl+D…) editörde işlenir. */
export function keyToCommand(e: KeyboardEvent): string | null {
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (e.key === 'F1') return 'shortcuts';
  if (e.key === 'F11') return 'focus';
  if (e.key === 'F7') return 'spell-toggle';
  if (e.key === 'F8') return 'spell-next';
  if (!mod) return null;
  if (e.altKey && k === 'i') return 'inspector';
  if (e.shiftKey) {
    if (k === 's') return 'save-as';
    if (k === 'n') return 'new-window';
    if (k === 'r') return 'rev-toggle';
    if (k === 'f') return 'focus';
    return null;
  }
  switch (k) {
    case 's':
      return 'save';
    case 'o':
      return 'open';
    case 'n':
      return 'new';
    case 'e':
      return 'export';
    case 'p':
      return 'print';
    case 'k':
      return 'palette';
    case 'f':
    case 'h':
      return 'find';
    case 'w':
      return 'close';
    case '5':
      return 'snapshot';
    case '=':
    case '+':
      return 'zoom-in';
    case '-':
      return 'zoom-out';
    case '0':
      return 'zoom-reset';
    case 't':
      return 'tag';
  }
  return null;
}
