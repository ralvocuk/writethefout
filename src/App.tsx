import { useEffect } from 'react';
import { DARK_THEMES, useStore, windowTitle } from './store/useStore';
import { Navigator } from './components/Navigator';
import { Inspector } from './components/Inspector';
import { StatusBar, TopBar } from './components/Chrome';
import { FindBar, ScriptEditor } from './components/ScriptEditor';
import { NoteEditor } from './components/NoteEditor';
import { Board } from './components/Board';
import { Outline } from './components/Outline';
import { Characters } from './components/Characters';
import { Timeline } from './components/Timeline';
import { Stats } from './components/Stats';
import { Preview } from './components/Preview';
import { Welcome } from './components/Welcome';
import { Palette } from './components/Palette';
import {
  AboutDialog,
  BackupsDialog,
  ConfirmDialog,
  ExportDialog,
  RecentDialog,
  ShortcutsDialog,
  TitlePageDialog,
  Toast,
  runBackup,
} from './components/Dialogs';
import { commands, keyToCommand, runCommand } from './commands';
import { useLang } from './i18n';
import { GoalsDialog, useSprintTimer } from './components/Goals';
import { DictionaryDialog } from './components/Spelling';
import { SidesDialog } from './components/Sides';
import { UpdateDialog } from './components/Update';
import { scheduleStartupCheck } from './updater';
import { onCloseRequested, onMenu, setMenuLabels, setWindowTheme, setWindowTitle } from './data/files';
import { t } from './i18n';
import { isTauri } from './data/repository';

const BACKUP_EVERY = 5 * 60 * 1000;

/** Her zaman (açılış ekranında da) erişilebilen pencereler */
function GlobalLayers() {
  return (
    <>
      <Palette />
      <RecentDialog />
      <BackupsDialog />
      <ShortcutsDialog />
      <AboutDialog />
      <GoalsDialog />
      <DictionaryDialog />
      <UpdateDialog />
      <ConfirmDialog />
      <Toast />
    </>
  );
}

export default function App() {
  const status = useStore((s) => s.status);
  const theme = useStore((s) => s.theme);
  const tab = useStore((s) => s.tab);
  const focus = useStore((s) => s.focus);
  const inspector = useStore((s) => s.inspector);
  const active = useStore((s) => s.active);
  const title = useStore((s) => windowTitle(s));
  // arayüz dili değişince tüm ağaç yeniden çizilir (bileşenler memo değil)
  const uiLang = useLang((s) => s.lang);

  useEffect(() => {
    useStore.getState().init();
    scheduleStartupCheck();
  }, []);
  useSprintTimer();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    setWindowTheme(DARK_THEMES.includes(theme)).catch(() => {});
  }, [theme]);

  useEffect(() => {
    setWindowTitle(title).catch(() => {});
  }, [title, uiLang]);

  // yerel menü çubuğu da arayüz dilinde
  useEffect(() => {
    const labels: Record<string, string> = {
      'm-file': t('Dosya'),
      'm-edit': t('Düzen'),
      'm-view': t('Görünüm'),
      'm-script': t('Senaryo'),
      'm-revision': t('Revizyon'),
      'm-help': t('Yardım'),
      'm-uilang': t('Arayüz dili'),
      'm-scriptlang': t('Senaryo dili'),
      cut: t('Kes'),
      copy: t('Kopyala'),
      paste: t('Yapıştır'),
      'select-all': t('Tümünü seç'),
    };
    for (const c of commands()) if (!c.id.startsWith('ui-lang-') && !c.id.startsWith('script-lang-')) labels[c.id] = c.label;
    setMenuLabels(labels).catch(() => {});
  }, [uiLang]);

  // Kapatırken kaydedilmemiş değişiklikleri sor
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onCloseRequested(() => useStore.getState().guardUnsaved(t('Pencereyi kapatmadan önce kaydedilsin mi?'))).then((u) => (unlisten = u));
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!isTauri() && useStore.getState().doc.dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unlisten?.();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);

  // Yerel menü çubuğu
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onMenu((id) => runCommand(id)).then((u) => (unlisten = u));
    return () => unlisten?.();
  }, []);

  // Yedek kasası: değişiklik varsa 5 dakikada bir
  useEffect(() => {
    if (status !== 'ready') return;
    const t = setInterval(() => runBackup().catch(() => {}), BACKUP_EVERY);
    return () => clearInterval(t);
  }, [status]);

  // Klavye kısayolları (komut kaydından)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      if (e.key === 'Escape' && s.focus && !s.dialog && !s.confirm) {
        s.toggle('focus', false);
        return;
      }
      if (s.confirm) return;
      const id = keyToCommand(e);
      if (!id) return;
      e.preventDefault();
      e.stopPropagation();
      runCommand(id);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  if (status === 'loading') return <div className="welcome" />;
  if (status === 'start') {
    return (
      <>
        <Welcome />
        <GlobalLayers />
      </>
    );
  }

  const center =
    tab === 'write' ? (
      active.kind === 'note' ? (
        <NoteEditor id={active.id} />
      ) : (
        <>
          <FindBar />
          <ScriptEditor />
        </>
      )
    ) : tab === 'board' ? (
      <Board />
    ) : tab === 'outline' ? (
      <Outline />
    ) : tab === 'characters' ? (
      <Characters />
    ) : tab === 'timeline' ? (
      <Timeline />
    ) : tab === 'preview' ? (
      <Preview />
    ) : (
      <Stats />
    );

  const wide = tab !== 'write';
  return (
    <div className={`app ${focus ? 'focus' : ''} ${inspector && !wide ? '' : 'no-inspector'} tab-${tab}`}>
      <TopBar />
      <Navigator />
      <main className="center scroll">{center}</main>
      {inspector && !wide ? <Inspector /> : <aside />}
      <StatusBar />
      <ExportDialog />
      <TitlePageDialog />
      <SidesDialog />
      <GlobalLayers />
    </div>
  );
}
