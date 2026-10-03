import { ArrowsOut, SidebarSimple, MagnifyingGlass, Export, ListMagnifyingGlass } from '@phosphor-icons/react';
import { SprintStatus } from './Goals';
import { UpdateBadge } from './Update';
import { useStore, type Tab, type Theme } from '../store/useStore';
import { baseName } from '../script/document';
import { openFind } from '../commands';
import { EL_LABEL, REVISIONS } from '../script/elements';
import { EMPTY_ENTER, NEXT_ON_ENTER, TAB_NEXT } from '../editor/screenplay';
import { useCaret } from './ScriptEditor';
import { locale, t } from '../i18n';

const TABS: { id: Tab; label: string }[] = [
  { id: 'write', label: 'Yaz' },
  { id: 'board', label: 'Pano' },
  { id: 'outline', label: 'Anahat' },
  { id: 'characters', label: 'Karakterler' },
  { id: 'timeline', label: 'Zaman çizelgesi' },
  { id: 'stats', label: 'İstatistikler' },
  { id: 'preview', label: 'Önizleme' },
];

export function Wordmark({ big }: { big?: boolean }) {
  return (
    <span className={`wordmark ${big ? 'big' : ''}`} aria-label="writetheFout.">
      write<span className="wm-the">the</span>
      <span className="wm-f">F</span>out<i>.</i>
    </span>
  );
}

export function TopBar() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const focus = useStore((s) => s.focus);
  const inspector = useStore((s) => s.inspector);
  const toggle = useStore((s) => s.toggle);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const openDialogBox = useStore((s) => s.openDialogBox);
  const doc = useStore((s) => s.doc);
  const title = useStore((s) => s.title);
  const save = useStore((s) => s.save);
  const name = doc.path ? `${baseName(doc.path)}.fountain` : title.title || t('Adsız senaryo');

  return (
    <header className="topbar">
      <div className="brand">
        <Wordmark />
        <button className="doc-name" title={doc.path ?? t('Henüz kaydedilmedi — Ctrl+S')} onClick={() => (doc.dirty || !doc.path ? save() : openDialogBox('recent'))}>
          {doc.dirty ? <i className="dirty-dot" aria-label={t('kaydedilmemiş')} /> : null}
          <span>{name}</span>
        </button>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.id} role="tab" className="tab" aria-selected={x.id === tab} onClick={() => setTab(x.id)}>
            {t(x.label)}
          </button>
        ))}
      </div>
      <div className="tools">
        <UpdateBadge />
        <button
          className={`rev-toggle ${settings.revisionOn ? 'on' : ''}`}
          style={{ ['--c' as string]: `var(--rev-${settings.revisionGen})` }}
          onClick={() => updateSettings({ revisionOn: !settings.revisionOn })}
          title={t('Revizyon modu (Ctrl+Shift+R)')}
        >
          <i />
          {settings.revisionOn ? t('Revizyon: {color}', { color: t(REVISIONS[settings.revisionGen - 1].name) }) : t('Revizyon')}
        </button>
        <button className="icon-btn" onClick={() => openFind()} title={t('Bul ve değiştir (Ctrl+F)')}>
          <ListMagnifyingGlass size={16} weight="light" />
        </button>
        <button className="icon-btn" onClick={() => openDialogBox('export')} title={t('Dışa aktar (Ctrl+E)')}>
          <Export size={16} weight="light" />
        </button>
        <button className="icon-btn" onClick={() => openDialogBox('palette')} title={t('Komut paleti (Ctrl+K)')}>
          <MagnifyingGlass size={16} weight="light" />
        </button>
        <button className="icon-btn" aria-pressed={focus} onClick={() => toggle('focus')} title={t('Odak modu (F11)')}>
          <ArrowsOut size={16} weight="light" />
        </button>
        <button className="icon-btn" aria-pressed={inspector} onClick={() => toggle('inspector')} title={t('Ayrıntılar paneli (Ctrl+Alt+I)')}>
          <SidebarSimple size={16} weight="light" style={{ transform: 'scaleX(-1)' }} />
        </button>
      </div>
    </header>
  );
}

/** Kurşun kalem çentikleri: beşerli demetler (her çentik ≈100 kelime). */
export function Tally({ words, goal }: { words: number; goal: number }) {
  // en çok 20 çentik: büyük hedeflerde her çentik daha çok kelime sayar
  const marks = Math.max(1, Math.min(20, Math.round(goal / 100)));
  const unit = goal / marks;
  const done = Math.min(marks, Math.floor(words / unit));
  const groups = Math.ceil(marks / 5);
  const gw = 26;
  const els: React.ReactNode[] = [];
  for (let g = 0; g < groups; g++) {
    const x0 = g * gw + 1;
    for (let i = 0; i < 4; i++) {
      const idx = g * 5 + i;
      if (idx >= marks) break;
      const on = idx < done;
      els.push(
        <line key={`${g}-${i}`} x1={x0 + i * 4.5 + 2} x2={x0 + i * 4.5 + 2 + (i % 2 ? 0.6 : -0.4)} y1={2} y2={14}
          stroke={on ? 'var(--ink)' : 'var(--rule-strong)'} strokeWidth={on ? 1.4 : 1} strokeLinecap="round" />,
      );
    }
    const slash = g * 5 + 4;
    if (slash < marks) {
      const on = slash < done;
      els.push(
        <line key={`${g}-s`} x1={x0 - 1} x2={x0 + 17} y1={12} y2={4}
          stroke={on ? 'var(--accent)' : 'var(--rule-strong)'} strokeWidth={on ? 1.4 : 1} strokeLinecap="round" />,
      );
    }
  }
  return (
    <div className="tally" title={t('Bugün {words} / {goal} kelime', { words, goal })}>
      <svg width={groups * gw} height={16} aria-hidden>
        {els}
      </svg>
      <span className="num">
        {t('Bugün {words} / {goal}', { words, goal })}
      </span>
    </div>
  );
}

export const THEMES: { id: Theme; label: string; swatch: string }[] = [
  { id: 'dark', label: 'Karanlık', swatch: 'var(--swatch-dark)' },
  { id: 'paper', label: 'Kâğıt', swatch: 'var(--swatch-paper)' },
  { id: 'night', label: 'Gece', swatch: 'var(--swatch-night)' },
  { id: 'typewriter', label: 'Daktilo', swatch: 'var(--swatch-type)' },
];

export function ThemeSwitch() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  return (
    <div className="theme-switch" role="radiogroup" aria-label={t('Tema')}>
      {THEMES.map((x) => (
        <button key={x.id} role="radio" aria-checked={theme === x.id} aria-pressed={theme === x.id} title={t('Tema: {name}', { name: t(x.label) })} onClick={() => setTheme(x.id)}>
          <i style={{ background: x.swatch }} />
        </button>
      ))}
    </div>
  );
}

export function StatusBar() {
  const model = useStore((s) => s.model);
  const doc = useStore((s) => s.doc);
  const autosave = useStore((s) => s.autosave);
  const zoom = useStore((s) => s.zoom);
  const page = useStore((s) => s.page);
  const cursorSid = useStore((s) => s.cursorSid);
  const wordsToday = useStore((s) => s.wordsToday);
  const dailyGoal = useStore((s) => s.dailyGoal);
  const sprint = useStore((s) => s.sprint);
  const saving = useStore((s) => s.saving);
  const lastSaved = useStore((s) => s.lastSaved);
  const tab = useStore((s) => s.tab);
  const active = useStore((s) => s.active);
  const el = useCaret((s) => s.el);
  const scene = model?.scenes.find((s) => s.sid === cursorSid);
  const onScript = tab === 'write' && active.kind === 'script';

  return (
    <footer className="statusbar">
      {onScript ? (
        <span className="num">
          {t('Sayfa {a} / {b}', { a: page.current, b: model?.pages ?? page.total })}
          {scene ? ` · ${t('Sahne {n}', { n: scene.number })}` : ''}
        </span>
      ) : (
        <span className="num">{t('{n} sayfa', { n: model?.pages ?? 0 })}</span>
      )}
      {onScript && el ? (
        <span className="el-hints">
          <b>{EL_LABEL[el]}</b> · Enter → {EL_LABEL[NEXT_ON_ENTER[el]]} · {t('boşken')} → {EL_LABEL[EMPTY_ENTER[el]]} · Tab →{' '}
          {EL_LABEL[TAB_NEXT[el]]}
        </span>
      ) : null}
      <span className="grow" />
      {sprint ? <SprintStatus /> : null}
      <button className="tally-btn" onClick={() => useStore.getState().openDialogBox('goals')} title={t('Yazma hedefleri ve süreli seans')}>
        <Tally words={wordsToday} goal={dailyGoal || 1000} />
      </button>
      {zoom !== 1 ? (
        <button className="text-btn num" title={t('Gerçek boyut (Ctrl+0)')} onClick={() => useStore.getState().setZoom(1)}>
          {t('%{n}', { n: Math.round(zoom * 100) })}
        </button>
      ) : null}
      <span
        className={`save-state ${saving ? 'saving' : doc.dirty ? 'dirty' : ''}`}
        title={doc.path ? `${doc.path}${autosave ? ` · ${t('otomatik kayıt açık')}` : ''}` : t('Henüz bir dosyaya kaydedilmedi')}
      >
        {saving
          ? t('Kaydediliyor…')
          : !doc.path
            ? t('Kaydedilmedi')
            : doc.dirty
              ? autosave
                ? t('Değişiklikler kaydedilecek')
                : t('Kaydedilmemiş değişiklikler')
              : lastSaved
                ? t('Kaydedildi {time}', { time: new Date(lastSaved).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) })
                : t('Kayıtlı')}
      </span>
      <ThemeSwitch />
    </footer>
  );
}
