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
import { UI_LANGS, setUiLang, t } from './i18n';
import { SCRIPT_LANGS } from './export/layout';

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
    { id: 'new', group: t('Dosya'), label: t('Yeni senaryo'), keys: 'Ctrl+N', run: () => st().newDocument(false) },
    { id: 'new-window', group: t('Dosya'), label: t('Yeni pencere'), keys: 'Ctrl+Shift+N', run: () => openNewWindow() },
    { id: 'open', group: t('Dosya'), label: t('Aç…'), keys: 'Ctrl+O', run: () => st().openDialog() },
    { id: 'recent', group: t('Dosya'), label: t('Son açılanlar…'), run: () => st().openDialogBox('recent') },
    { id: 'save', group: t('Dosya'), label: t('Kaydet'), keys: 'Ctrl+S', run: () => st().save(), needsDoc: true },
    { id: 'save-as', group: t('Dosya'), label: t('Farklı kaydet…'), keys: 'Ctrl+Shift+S', run: () => st().saveAs(), needsDoc: true },
    { id: 'import', group: t('Dosya'), label: t('İçe aktar (Final Draft, Highland, Fade In, Celtx, Fountain)…'), run: () => startImport() },
    { id: 'export', group: t('Dosya'), label: t('Dışa aktar (PDF, Fountain, Final Draft)…'), keys: 'Ctrl+E', run: () => st().openDialogBox('export'), needsDoc: true },
    { id: 'sides', group: t('Dosya'), label: t('Oyuncu sayfaları ve replik dökümü (PDF)…'), run: () => st().openDialogBox('sides'), needsDoc: true },
    { id: 'print', group: t('Dosya'), label: t('Baskı önizleme ve yazdır'), keys: 'Ctrl+P', run: tab('preview'), needsDoc: true },
    { id: 'snapshot', group: t('Dosya'), label: t('Anlık görüntü al'), keys: 'Ctrl+5', run: () => st().takeSnapshot(), needsDoc: true },
    { id: 'backups', group: t('Dosya'), label: t('Yedekler…'), run: () => st().openDialogBox('backups') },
    { id: 'backup-now', group: t('Dosya'), label: t('Şimdi yedekle'), run: () => runBackup(true), needsDoc: true },
    {
      id: 'autosave',
      group: t('Dosya'),
      label: st().autosave ? t('Otomatik kaydetmeyi kapat') : t('Otomatik kaydetmeyi aç'),
      run: () => st().setAutosave(!st().autosave),
    },
    { id: 'close', group: t('Dosya'), label: t('Pencereyi kapat'), keys: 'Ctrl+W', run: () => closeWindow() },

    { id: 'undo', group: t('Düzen'), label: t('Geri al'), keys: 'Ctrl+Z', run: () => ed()?.commands.undo(), needsDoc: true },
    { id: 'redo', group: t('Düzen'), label: t('Yinele'), keys: 'Ctrl+Y', run: () => ed()?.commands.redo(), needsDoc: true },
    { id: 'find', group: t('Düzen'), label: t('Bul ve değiştir'), keys: 'Ctrl+F', run: () => openFind(), needsDoc: true },
    { id: 'palette', group: t('Düzen'), label: t('Komut paleti'), keys: 'Ctrl+K', run: () => st().openDialogBox('palette') },
    {
      id: 'spell-toggle',
      group: t('Düzen'),
      label: st().spellOn ? t('Yazım denetimini kapat') : t('Yazım denetimini aç'),
      keys: 'F7',
      run: () => {
        st().toggle('spellOn');
        st().notify(st().spellOn ? t('Yazım denetimi açık') : t('Yazım denetimi kapalı'));
      },
    },
    {
      id: 'spell-next',
      group: t('Düzen'),
      label: t('Sonraki yazım hatası'),
      keys: 'F8',
      run: () => {
        const e = ed();
        if (!st().spellOn) st().toggle('spellOn', true);
        if (e && !gotoNextError(e)) st().notify(t('Yazım hatası bulunamadı'));
      },
      needsDoc: true,
    },
    {
      id: 'tdk-toggle',
      group: t('Düzen'),
      label: st().tdkOn ? t('TDK yazım önerilerini kapat') : t('TDK yazım önerilerini aç'),
      run: () => {
        st().toggle('tdkOn');
        st().notify(st().tdkOn ? t('TDK yazım önerileri açık') : t('TDK yazım önerileri kapalı'));
      },
    },
    { id: 'dictionary', group: t('Düzen'), label: t('Kişisel sözlük ve yazım denetimi…'), run: () => st().openDialogBox('dictionary') },

    { id: 'tab-write', group: t('Görünüm'), label: t('Yaz'), run: tab('write'), needsDoc: true },
    { id: 'tab-board', group: t('Görünüm'), label: t('Pano'), run: tab('board'), needsDoc: true },
    { id: 'tab-outline', group: t('Görünüm'), label: t('Anahat'), run: tab('outline'), needsDoc: true },
    { id: 'tab-characters', group: t('Görünüm'), label: t('Karakterler'), run: tab('characters'), needsDoc: true },
    { id: 'tab-timeline', group: t('Görünüm'), label: t('Zaman çizelgesi'), run: tab('timeline'), needsDoc: true },
    { id: 'tab-stats', group: t('Görünüm'), label: t('İstatistikler'), run: tab('stats'), needsDoc: true },
    { id: 'focus', group: t('Görünüm'), label: t('Odak modu'), keys: 'F11', run: () => st().toggle('focus'), needsDoc: true },
    { id: 'inspector', group: t('Görünüm'), label: t('Ayrıntılar paneli'), keys: 'Ctrl+Alt+I', run: () => st().toggle('inspector'), needsDoc: true },
    { id: 'zoom-in', group: t('Görünüm'), label: t('Yakınlaştır'), keys: 'Ctrl++', run: () => st().setZoom(st().zoom + 0.1) },
    { id: 'zoom-out', group: t('Görünüm'), label: t('Uzaklaştır'), keys: 'Ctrl+-', run: () => st().setZoom(st().zoom - 0.1) },
    { id: 'zoom-reset', group: t('Görünüm'), label: t('Gerçek boyut'), keys: 'Ctrl+0', run: () => st().setZoom(1) },
    { id: 'theme-dark', group: t('Görünüm'), label: t('Karanlık tema aç / kapat'), keys: 'Ctrl+Shift+L', run: () => st().setTheme(st().theme === 'dark' ? 'paper' : 'dark') },
    { id: 'theme-paper', group: t('Görünüm'), label: t('Tema: Kâğıt'), run: () => st().setTheme('paper') },
    { id: 'theme-night', group: t('Görünüm'), label: t('Tema: Gece'), run: () => st().setTheme('night') },
    { id: 'theme-typewriter', group: t('Görünüm'), label: t('Tema: Daktilo'), run: () => st().setTheme('typewriter') },
    ...UI_LANGS.map<Command>((l) => ({
      id: `ui-lang-${l.id}`,
      group: t('Görünüm'),
      label: `${t('Arayüz dili')}: ${l.name}`,
      run: () => setUiLang(l.id),
    })),
    ...SCRIPT_LANGS.map<Command>((l) => ({
      id: `script-lang-${l.id}`,
      group: t('Senaryo'),
      label: `${t('Senaryo dili')}: ${l.name}`,
      run: () => st().updateSettings({ lang: l.id }),
      needsDoc: true,
    })),

    { id: 'title-page', group: t('Senaryo'), label: t('Başlık sayfası…'), run: () => st().openDialogBox('title'), needsDoc: true },
    { id: 'add-scene', group: t('Senaryo'), label: t('Sona sahne ekle'), run: () => appendElement('sceneHeading'), needsDoc: true },
    { id: 'add-section', group: t('Senaryo'), label: t('Sona bölüm ekle'), run: () => appendElement('section'), needsDoc: true },
    { id: 'dual', group: t('Senaryo'), label: t('Çift diyalog (karakter satırında)'), keys: 'Ctrl+D', run: () => ed() && toggleDual(ed()!), needsDoc: true },
    { id: 'note', group: t('Senaryo'), label: t('Not ekle / kaldır [[ ]]'), keys: 'Ctrl+Shift+M', run: () => ed() && toggleMarkOnSelection(ed()!, 'note'), needsDoc: true },
    { id: 'omit', group: t('Senaryo'), label: t('Metni gizle / göster /* */'), keys: 'Ctrl+/', run: () => ed() && toggleMarkOnSelection(ed()!, 'omit'), needsDoc: true },
    { id: 'tag', group: t('Senaryo'), label: t('Seçimi etiketle'), keys: 'Ctrl+T', run: () => window.dispatchEvent(new Event('wtf-tag')), needsDoc: true },
    {
      id: 'lock',
      group: t('Senaryo'),
      label: t('Sahne numaralarını kilitle / aç'),
      run: () => {
        const locked = st().model?.blocks.some((b) => b.el === 'sceneHeading' && b.num);
        st().lockNumbers(!locked);
      },
      needsDoc: true,
    },
    { id: 'goals', group: t('Senaryo'), label: t('Yazma hedefleri…'), run: () => st().openDialogBox('goals') },
    {
      id: 'sprint',
      group: t('Senaryo'),
      label: st().sprint ? t('Süreli seansı durdur') : t('Süreli seans başlat (25 dk)'),
      run: () => (st().sprint ? st().stopSprint(false) : st().startSprint(25, null)),
      needsDoc: true,
    },
    ...[...CORE, ...EXTRA].map<Command>((e, i) => ({
      id: `el-${e}`,
      group: t('Eleman'),
      label: EL_LABEL[e],
      keys: e === 'pageBreak' ? 'Ctrl+Enter' : `Ctrl+${i + 1}`,
      run: el(e),
      needsDoc: true,
    })),

    { id: 'rev-toggle', group: t('Revizyon'), label: t('Revizyon modunu aç / kapat'), keys: 'Ctrl+Shift+R', run: () => st().updateSettings({ revisionOn: !st().settings.revisionOn }), needsDoc: true },
    {
      id: 'rev-next',
      group: t('Revizyon'),
      label: t('Sonraki revizyon turu'),
      run: () => st().updateSettings({ revisionGen: Math.min(8, st().settings.revisionGen + 1), revisionOn: true }),
      needsDoc: true,
    },
    ...REVISIONS.map<Command>((r, i) => ({
      id: `rev-${i + 1}`,
      group: t('Revizyon'),
      label: t('{n}. tur: {color}', { n: i + 1, color: t(r.name) }),
      run: () => st().updateSettings({ revisionGen: i + 1, revisionOn: true }),
      needsDoc: true,
    })),
    { id: 'rev-all-current', group: t('Revizyon'), label: t('Tüm işaretleri seçili tura taşı'), run: () => st().moveRevisionsTo(st().settings.revisionGen), needsDoc: true },
    {
      id: 'rev-commit',
      group: t('Revizyon'),
      label: t('Revizyonları onayla'),
      run: async () => {
        const c = await st().ask(t('Revizyonları onayla'), t('Tüm revizyon işaretleri kaldırılacak ve silinmeye aday metinler silinecek. Öncesinin anlık görüntüsü alınır.'), [
          { id: 'no', label: t('Vazgeç') },
          { id: 'yes', label: t('Onayla'), primary: true },
        ]);
        if (c !== 'yes') return;
        await st().takeSnapshot(t('Revizyon onayından önce'));
        st().commitRevisions();
      },
      needsDoc: true,
    },

    { id: 'shortcuts', group: t('Yardım'), label: t('Klavye kısayolları'), keys: 'F1', run: () => st().openDialogBox('shortcuts') },
    { id: 'update-check', group: t('Yardım'), label: t('Güncellemeleri denetle…'), run: () => checkForUpdates(true) },
    { id: 'about', group: t('Yardım'), label: t('writetheFout. hakkında'), run: () => st().openDialogBox('about') },
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
