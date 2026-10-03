import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { numberScenes, paginate, type Lang, type Paper } from '../export/layout';
import { toFountain } from '../export/fountain';
import { toFdx } from '../export/fdx';
import { IMPORT_EXTENSIONS, importFile } from '../export/importers';
import {
  backupFolder,
  backupList,
  backupRead,
  loadFonts,
  openPath,
  pickFile,
  revealPath,
  safeName,
  saveFile,
  type BackupEntry,
} from '../export/platform';
import { REVISIONS } from '../script/elements';
import { baseName } from '../script/document';
import { openNewWindow } from '../data/files';
import { commands } from '../commands';

export function Modal({
  title,
  aside,
  onClose,
  children,
  foot,
  wide,
}: {
  title: string;
  aside?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  foot?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className={`dialog ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <header className="dialog-head">
          <h2>{title}</h2>
          {aside ? <span className="label num">{aside}</span> : null}
        </header>
        {children}
        {foot ? <footer className="dialog-foot">{foot}</footer> : null}
      </div>
    </div>
  );
}

const close = () => useStore.getState().openDialogBox(null);

/* ---------- Onay kutusu ---------- */

export function ConfirmDialog() {
  const c = useStore((s) => s.confirm);
  if (!c) return null;
  const cancel = c.buttons.find((b) => b.id === 'cancel' || b.id === 'no')?.id ?? c.buttons[0].id;
  return (
    <Modal
      title={c.title}
      onClose={() => c.resolve(cancel)}
      foot={
        <>
          <span className="grow" />
          {c.buttons.map((b) => (
            <button
              key={b.id}
              className={`btn ${b.primary ? 'primary' : ''} ${b.danger && !b.primary ? 'danger' : ''}`}
              autoFocus={b.primary}
              onClick={() => c.resolve(b.id)}
            >
              {b.label}
            </button>
          ))}
        </>
      }
    >
      <div className="dialog-body">
        <p className="confirm-text">{c.message}</p>
      </div>
    </Modal>
  );
}

/* ---------- Bildirim ---------- */

export function Toast() {
  const t = useStore((s) => s.toast);
  if (!t) return null;
  return (
    <div className={`toast ${t.kind}`} role="status" key={t.at}>
      {t.text}
    </div>
  );
}

/* ---------- Dışa aktar ---------- */

type Format = 'pdf' | 'fountain' | 'fdx';
const FORMATS: { id: Format; name: string; ext: string; desc: string }[] = [
  { id: 'pdf', name: 'PDF', ext: 'pdf', desc: 'Göndermek ve yazdırmak için. Endüstri biçimi, Courier 12.' },
  { id: 'fountain', name: 'Fountain', ext: 'fountain', desc: 'Beat, Highland, Slugline için büyük harfli, temiz bir kopya.' },
  { id: 'fdx', name: 'Final Draft', ext: 'fdx', desc: 'Final Draft ve çoğu profesyonel araç açar. Revizyonlar korunur.' },
];

interface Prefs {
  format: Format;
  sceneNumbers: boolean;
  titlePage: boolean;
  autoContd: boolean;
  revisionMarks: boolean;
  revisedOnly: boolean;
}
const PREFS_KEY = 'wtf.export.v2';
const DEFAULTS: Prefs = { format: 'pdf', sceneNumbers: true, titlePage: true, autoContd: true, revisionMarks: true, revisedOnly: false };
const readPrefs = (): Prefs => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'), revisedOnly: false };
  } catch {
    return DEFAULTS;
  }
};

export function ExportDialog() {
  const open = useStore((s) => s.dialog === 'export');
  const title = useStore((s) => s.title);
  const settings = useStore((s) => s.settings);
  const model = useStore((s) => s.model);
  const script = useStore((s) => s.script);
  const updateSettings = useStore((s) => s.updateSettings);
  const doc = useStore((s) => s.doc);
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ path: string; pages?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDone(null);
      setError(null);
    }
  }, [open]);
  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* yok say */
    }
  }, [prefs]);

  const hasRevisions = model?.blocks.some((b) => b.runs.some((r) => r.rev) || b.delGen) ?? false;
  const pages = useMemo(() => {
    if (!open || !model) return [];
    return paginate(numberScenes(model.blocks), {
      paper: settings.paper,
      lang: settings.lang,
      sceneNumbers: prefs.sceneNumbers,
      headingSpace: 2,
      autoContd: prefs.autoContd,
    });
  }, [open, model, settings.paper, settings.lang, prefs.sceneNumbers, prefs.autoContd]);
  const revisedPages = pages.filter((p) => p.lines.some((l) => l?.rev || l?.pair?.rev)).map((p) => p.number);

  if (!open || !model) return null;
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  const fmt = FORMATS.find((f) => f.id === prefs.format)!;
  const titleInfo = prefs.titlePage && !prefs.revisedOnly ? title : null;
  const name = safeName(title.title || (doc.path ? baseName(doc.path) : 'senaryo'));

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const blocks = numberScenes(model.blocks);
      let data: Uint8Array | string;
      let count: number | undefined;
      if (prefs.format === 'pdf') {
        const gen = settings.revisionGen;
        const revision =
          prefs.revisionMarks && hasRevisions
            ? {
                label: settings.lang === 'tr' ? `${REVISIONS[gen - 1].name} revizyon` : `${REVISIONS[gen - 1].en} Revision`,
                date: new Date().toLocaleDateString(settings.lang === 'tr' ? 'tr-TR' : 'en-US'),
              }
            : null;
        const r = await (await import('../export/pdf')).renderPdf(
          prefs.revisionMarks ? blocks : blocks.map((b) => ({ ...b, runs: b.runs.map((x) => ({ ...x, rev: undefined })) })),
          {
            paper: settings.paper,
            lang: settings.lang,
            sceneNumbers: prefs.sceneNumbers,
            headingSpace: 2,
            autoContd: prefs.autoContd,
            revision,
            onlyPages: prefs.revisedOnly ? revisedPages : undefined,
          },
          titleInfo,
          await loadFonts(),
        );
        data = r.bytes;
        count = r.pages;
      } else if (prefs.format === 'fountain') {
        data = toFountain(JSON.parse(script), titleInfo, settings.lang);
      } else {
        data = toFdx(blocks, titleInfo, settings.lang, prefs.sceneNumbers);
      }
      const suffix = prefs.revisedOnly ? ' - revize sayfalar' : '';
      const res = await saveFile(`${name}${suffix}.${fmt.ext}`, data, { name: fmt.name, extensions: [fmt.ext] });
      if (res.path) setDone({ path: res.path, pages: count });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Dışa aktar"
      aside={`${model.scenes.length} sahne · ${pages.length} sayfa${titleInfo ? ' + başlık' : ''}`}
      onClose={close}
      foot={
        <>
          {error ? <span className="error">{error}</span> : null}
          {done ? (
            <span className="done">
              Kaydedildi{done.pages ? ` · ${done.pages} sayfa` : ''}.{' '}
              <button className="text-btn" onClick={() => openPath(done.path)}>
                Aç
              </button>{' '}
              <button className="text-btn" onClick={() => revealPath(done.path)}>
                Klasörde göster
              </button>
            </span>
          ) : null}
          <span className="grow" />
          <button className="btn" onClick={close}>
            Kapat
          </button>
          <button className="btn primary" disabled={busy || (prefs.revisedOnly && !revisedPages.length)} onClick={run} autoFocus>
            {busy ? 'Hazırlanıyor…' : `${fmt.name} olarak kaydet`}
          </button>
        </>
      }
    >
      <div className="formats" role="radiogroup" aria-label="Biçim">
        {FORMATS.map((f) => (
          <button key={f.id} role="radio" aria-checked={prefs.format === f.id} className="format" onClick={() => set('format', f.id)}>
            <span className="format-name">{f.name}</span>
            <span className="format-ext">.{f.ext}</span>
            <span className="format-desc">{f.desc}</span>
          </button>
        ))}
      </div>
      <div className="dialog-body">
        {prefs.format === 'pdf' ? (
          <div className="opt-row">
            <span className="muted">Kâğıt</span>
            <div className="segmented small">
              {(['a4', 'letter'] as Paper[]).map((p) => (
                <button key={p} aria-pressed={settings.paper === p} onClick={() => updateSettings({ paper: p })}>
                  {p === 'a4' ? 'A4' : 'US Letter'}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="opt-row">
          <span className="muted">Dil</span>
          <div className="segmented small">
            {(['tr', 'en'] as Lang[]).map((l) => (
              <button key={l} aria-pressed={settings.lang === l} onClick={() => updateSettings({ lang: l })}>
                {l === 'tr' ? 'Türkçe' : 'English'}
              </button>
            ))}
          </div>
        </div>
        <p className="hint opt-note">
          {settings.lang === 'tr'
            ? 'Büyük harfler Türkçe kuralıyla (i → İ); sayfa geçişinde (DEVAM EDİYOR) ve (DEVAM).'
            : "Standard uppercase (i → I); page breaks use (MORE) and (CONT'D)."}
        </p>
        {prefs.format !== 'fountain' ? (
          <label className="opt-row check">
            <input type="checkbox" checked={prefs.sceneNumbers} onChange={(e) => set('sceneNumbers', e.target.checked)} />
            <span>Sahne numaraları</span>
          </label>
        ) : null}
        {prefs.format === 'pdf' ? (
          <>
            <label className="opt-row check">
              <input type="checkbox" checked={prefs.autoContd} onChange={(e) => set('autoContd', e.target.checked)} />
              <span>Aynı karakter araya aksiyon girince sürdürürse {settings.lang === 'tr' ? '(DEVAM)' : "(CONT'D)"} ekle</span>
            </label>
            {hasRevisions ? (
              <>
                <label className="opt-row check">
                  <input type="checkbox" checked={prefs.revisionMarks} onChange={(e) => set('revisionMarks', e.target.checked)} />
                  <span>Revizyon yıldızları (*) ve üst bilgide revizyon adı</span>
                </label>
                <label className="opt-row check">
                  <input type="checkbox" checked={prefs.revisedOnly} onChange={(e) => set('revisedOnly', e.target.checked)} />
                  <span>
                    Yalnızca değişen sayfalar{' '}
                    <span className="muted num">({revisedPages.length ? `s. ${revisedPages.join(', ')}` : 'yok'})</span>
                  </span>
                </label>
              </>
            ) : null}
          </>
        ) : null}
        {!prefs.revisedOnly ? (
          <label className="opt-row check">
            <input type="checkbox" checked={prefs.titlePage} onChange={(e) => set('titlePage', e.target.checked)} />
            <span>
              Başlık sayfası{' '}
              <button className="text-btn" onClick={() => useStore.getState().openDialogBox('title')}>
                düzenle
              </button>
            </span>
          </label>
        ) : null}
      </div>
    </Modal>
  );
}

/* ---------- Başlık sayfası ---------- */

export function TitlePageDialog() {
  const open = useStore((s) => s.dialog === 'title');
  const t = useStore((s) => s.title);
  const update = useStore((s) => s.updateTitle);
  if (!open) return null;
  const field = (k: keyof typeof t, label: string, placeholder: string, multi = false) => (
    <label className="field">
      <span className="muted">{label}</span>
      {multi ? (
        <textarea rows={2} value={t[k] ?? ''} placeholder={placeholder} onChange={(e) => update({ [k]: e.target.value })} />
      ) : (
        <input value={t[k] ?? ''} placeholder={placeholder} onChange={(e) => update({ [k]: e.target.value })} />
      )}
    </label>
  );
  return (
    <Modal
      title="Başlık sayfası"
      onClose={close}
      foot={
        <>
          <span className="hint">PDF, Final Draft ve Fountain çıktılarında kullanılır.</span>
          <span className="grow" />
          <button className="btn primary" onClick={close} autoFocus>
            Tamam
          </button>
        </>
      }
    >
      <div className="dialog-body title-fields flat">
        {field('title', 'Başlık', 'Senaryonun adı')}
        {field('credit', 'Unvan', 'Yazan')}
        {field('author', 'Yazar', 'Adın')}
        {field('source', 'Dayanak', 'ör. Aynı adlı romandan uyarlanmıştır', true)}
        {field('draftDate', 'Taslak tarihi', 'ör. 3 Ekim 2026 — 2. taslak')}
        {field('contact', 'İletişim', 'E-posta, telefon, ajans', true)}
        {field('copyright', 'Telif', 'ör. © 2026 Ralvo')}
        {field('notes', 'Not', 'ör. WGA kayıt no', true)}
      </div>
    </Modal>
  );
}

/* ---------- İçe aktar ---------- */

export async function startImport() {
  const f = await pickFile(IMPORT_EXTENSIONS);
  if (!f) return;
  const st = useStore.getState();
  try {
    const imp = importFile(f.name, f.bytes);
    const synopses = 'synopses' in imp ? (imp as { synopses?: (string | undefined)[] }).synopses : undefined;
    const ok = await st.loadImported(imp.title, imp.doc, synopses, f.name.replace(/\.[^.]+$/, ''));
    if (ok) {
      const scenes = imp.doc.content.filter((l) => l.attrs.el === 'sceneHeading').length;
      st.notify(`${imp.format} dosyasından ${scenes} sahne alındı — yeni, kaydedilmemiş bir senaryo olarak açıldı`);
    }
  } catch (e) {
    st.notify(`${f.name}: ${e instanceof Error ? e.message : String(e)}`, 'error');
  }
}

/* ---------- Yedekler ---------- */

export function BackupsDialog() {
  const open = useStore((s) => s.dialog === 'backups');
  const [list, setList] = useState<BackupEntry[]>([]);
  useEffect(() => {
    if (open) backupList().then(setList).catch(() => setList([]));
  }, [open]);
  if (!open) return null;
  const restore = async (b: BackupEntry) => {
    const st = useStore.getState();
    const text = await backupRead(b.name);
    if (await st.openContent(text, baseName(b.name))) {
      close();
      st.notify('Yedek, kaydedilmemiş yeni bir senaryo olarak açıldı');
    }
  };
  return (
    <Modal
      title="Yedek kasası"
      aside={`${list.length} yedek`}
      onClose={close}
      foot={
        <>
          <button className="text-btn" onClick={() => backupFolder()}>
            Klasörü aç
          </button>
          <span className="grow" />
          <button className="btn" onClick={() => runBackup(true).then(() => backupList().then(setList))}>
            Şimdi yedekle
          </button>
          <button className="btn primary" onClick={close}>
            Kapat
          </button>
        </>
      }
    >
      <div className="dialog-body scroll" style={{ maxHeight: 420 }}>
        <p className="hint" style={{ marginTop: 0 }}>
          Açık senaryo değiştiyse 5 dakikada bir yedeklenir; en yeni 80 yedek tutulur. Yedek açılınca kaydedilmemiş yeni bir senaryo
          olur, asıl dosyana dokunulmaz.
        </p>
        {list.length === 0 ? <p className="muted">Henüz yedek yok.</p> : null}
        {list.map((b) => (
          <div className="snap" key={b.name}>
            <span>
              <span className="when">{b.name.replace(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2} /, '').replace(/\.fountain$/, '')}</span>
              <span className="meta num">
                {new Date(b.modified).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {Math.max(1, Math.round(b.size / 1024))} KB
              </span>
            </span>
            <button className="text-btn" onClick={() => restore(b)}>
              Aç
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

let lastBackedUp: string | null = null;
/** Değişiklik varsa yedek yazar */
export async function runBackup(force = false) {
  const st = useStore.getState();
  if (st.status !== 'ready') return;
  const content = st.serialize();
  if (!force && content === lastBackedUp) return;
  const { backupSave } = await import('../export/platform');
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const label = st.doc.path ? baseName(st.doc.path) : st.title.title || 'Adsız senaryo';
  await backupSave(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())} ${safeName(label)}.fountain`, content);
  lastBackedUp = content;
  if (force) st.notify('Yedeklendi');
}

/* ---------- Son açılanlar ---------- */

export function RecentList({ compact }: { compact?: boolean }) {
  const recent = useStore((s) => s.recent);
  const openPathFn = useStore((s) => s.openPath);
  const current = useStore((s) => s.doc.path);
  if (!recent.length) return <p className="muted">Henüz açılmış bir senaryo yok.</p>;
  return (
    <ul className={`recent ${compact ? 'compact' : ''}`}>
      {recent.map((r) => (
        <li key={r.path} className={r.path === current ? 'current' : ''}>
          <button
            className="recent-main"
            onClick={async () => {
              if (await openPathFn(r.path)) close();
            }}
            title={r.path}
          >
            <span className="recent-title">{r.title || baseName(r.path)}</span>
            <span className="recent-path">{r.path}</span>
          </button>
          <span className="recent-when num">{new Date(r.openedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
          <button className="text-btn" title="Yeni pencerede aç" onClick={() => openNewWindow(r.path)}>
            Yeni pencere
          </button>
        </li>
      ))}
    </ul>
  );
}

export function RecentDialog() {
  const open = useStore((s) => s.dialog === 'recent');
  if (!open) return null;
  return (
    <Modal
      title="Son açılanlar"
      onClose={close}
      wide
      foot={
        <>
          <span className="grow" />
          <button className="btn" onClick={() => useStore.getState().openDialog().then(close)}>
            Başka bir dosya aç…
          </button>
          <button className="btn primary" onClick={close}>
            Kapat
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <RecentList />
      </div>
    </Modal>
  );
}

/* ---------- Kısayollar ve hakkında ---------- */

export function ShortcutsDialog() {
  const open = useStore((s) => s.dialog === 'shortcuts');
  if (!open) return null;
  const groups = new Map<string, { label: string; keys: string }[]>();
  for (const c of commands()) {
    if (!c.keys) continue;
    const g = groups.get(c.group) ?? [];
    g.push({ label: c.label, keys: c.keys });
    groups.set(c.group, g);
  }
  groups.set('Yazarken', [
    { label: 'Sonraki elemana geç (aksiyon → karakter → …)', keys: 'Tab' },
    { label: 'Önceki eleman', keys: 'Shift+Tab' },
    { label: 'Yeni satır (akışa göre eleman seçer)', keys: 'Enter' },
    { label: 'Aynı eleman içinde alt satır', keys: 'Shift+Enter' },
    { label: 'Otomatik tamamlamayı kabul et', keys: 'Enter / →' },
    { label: 'Kalın, italik, altı çizili', keys: 'Ctrl+B / I / U' },
  ]);
  return (
    <Modal title="Klavye kısayolları" onClose={close} wide foot={<><span className="grow" /><button className="btn primary" onClick={close} autoFocus>Kapat</button></>}>
      <div className="dialog-body shortcut-grid scroll">
        {[...groups.entries()].map(([g, items]) => (
          <section key={g}>
            <h3 className="label">{g}</h3>
            {items.map((i) => (
              <div className="shortcut-row" key={i.label}>
                <span>{i.label}</span>
                <span className="kbd">{i.keys}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}

export function AboutDialog() {
  const open = useStore((s) => s.dialog === 'about');
  if (!open) return null;
  return (
    <Modal title="writetheFout." onClose={close} foot={<><span className="grow" /><button className="btn primary" onClick={close} autoFocus>Kapat</button></>}>
      <div className="dialog-body">
        <p className="confirm-text">Sürüm {__APP_VERSION__} — senaryo yazım stüdyosu.</p>
        <p className="hint">
          Senaryolar standart Fountain dosyası olarak kaydedilir; Beat, Highland ve diğer Fountain uyumlu programlarda açılır. Sahne
          renkleri, etiketler ve revizyonlar dosyanın sonundaki yorum bloğunda saklanır.
        </p>
        <p className="hint">Courier Prime yazı tipi SIL Open Font License ile dağıtılır. Türkçe yazım sözlüğü (Harun Reşit Zafer, Titus Wormer) MIT lisanslıdır.</p>
      </div>
    </Modal>
  );
}
