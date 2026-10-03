import { create } from 'zustand';
import { getRepository, today, uid, type AppRepository, type RecentFile, type Snapshot } from '../data/repository';
import { fileExists, fileMtime, pickOpenPath, pickSavePath, readText, writeText } from '../data/files';
import { emptyScript, sampleProject } from '../data/sample';
import { emptySceneMeta, type CharacterProfile, type SceneMeta } from '../data/types';
import { countWords } from '../script/elements';
import { buildModel, moveScene, moveSceneToSection, type ScriptModel } from '../script/model';
import { finalize, type JDoc } from '../script/json';
import {
  DEFAULT_SETTINGS,
  baseName,
  emptyTitle,
  parseDocument,
  serializeDocument,
  type DocNote,
  type DocSettings,
  type ScriptDocument,
} from '../script/document';
import type { TitleInfo } from '../export/fountain';
import { locale, t, uiLang } from '../i18n';
import { setCaseLang } from '../script/elements';
import { newSid } from '../editor/screenplay';

export type Tab = 'write' | 'board' | 'outline' | 'characters' | 'timeline' | 'stats' | 'preview';
export type Theme = 'dark' | 'paper' | 'night' | 'typewriter';
export const DARK_THEMES: Theme[] = ['dark', 'night'];
export type Active = { kind: 'script' } | { kind: 'note'; id: string };
export type Dialog = 'palette' | 'export' | 'import' | 'backups' | 'title' | 'shortcuts' | 'recent' | 'about' | 'goals' | 'sides' | 'dictionary' | 'update' | null;

export interface ActiveSprint {
  id: string;
  startedAt: number;
  minutes: number;
  target: number | null;
  words: number;
}

/** Editörle köprü (ScriptEditor atar) */
export const editorBridge = {
  flush: () => {},
  scrollToSid: (_sid: string) => {},
  scrollToBlock: (_idx: number) => {},
};

export interface ConfirmButton {
  id: string;
  label: string;
  primary?: boolean;
  danger?: boolean;
}
interface ConfirmState {
  title: string;
  message: string;
  buttons: ConfirmButton[];
  resolve: (id: string) => void;
}

interface DocState {
  /** dosya yolu ya da kaydedilmemiş belge için "untitled:<id>" */
  key: string;
  path: string | null;
  mtime: number | null;
  dirty: boolean;
}

interface State {
  status: 'loading' | 'start' | 'ready';
  repo: AppRepository | null;
  doc: DocState;
  title: TitleInfo;
  settings: DocSettings;
  /** editör belgesi (ProseMirror JSON) */
  script: string;
  wordCount: number;
  scenes: Record<string, SceneMeta>;
  characters: Record<string, CharacterProfile>;
  notes: DocNote[];
  model: ScriptModel | null;

  active: Active;
  tab: Tab;
  theme: Theme;
  zoom: number;
  autosave: boolean;
  focus: boolean;
  inspector: boolean;
  findOpen: boolean;
  dialog: Dialog;
  confirm: ConfirmState | null;
  toast: { text: string; kind: 'info' | 'error'; at: number } | null;

  saving: boolean;
  lastSaved: number | null;
  wordsToday: number;
  dailyGoal: number;
  sprint: ActiveSprint | null;
  spellOn: boolean;
  /** TDK yazım önerileri (Türkçe senaryolarda) */
  tdkOn: boolean;
  snapshots: Snapshot[];
  recent: RecentFile[];
  recovery: { key: string; path: string | null; content: string; at: number; slot: string }[];
  stamp: number;
  /** Editörü dışarıdan gelen içerikle yeniden kurmak için */
  revision: number;
  cursorSid: string | null;
  page: { current: number; total: number };
  filter: { character: string | null; color: string | null; location: string | null };

  init(): Promise<void>;
  /* belge */
  newDocument(sample?: boolean): Promise<boolean>;
  openPath(path: string): Promise<boolean>;
  openDialog(): Promise<void>;
  save(): Promise<boolean>;
  saveAs(): Promise<boolean>;
  guardUnsaved(action: string): Promise<boolean>;
  loadImported(title: Partial<TitleInfo>, doc: JDoc, synopses?: (string | undefined)[], name?: string): Promise<boolean>;
  /** Tam bir belge metnini (Fountain + meta) kaydedilmemiş yeni senaryo olarak aç */
  openContent(text: string, name?: string): Promise<boolean>;
  restoreRecovery(slot: string): void;
  discardRecovery(slot: string): void;
  serialize(): string;
  /* içerik */
  saveScript(doc: string, plainText: string): void;
  replaceScript(doc: object): void;
  updateTitle(patch: Partial<TitleInfo>): void;
  updateSettings(patch: Partial<DocSettings>): void;
  updateScene(sid: string, patch: Partial<SceneMeta>): void;
  updateCharacter(name: string, patch: Partial<CharacterProfile>): void;
  saveNote(id: string, doc: string): void;
  addNote(): void;
  updateNote(id: string, patch: Partial<DocNote>): void;
  deleteNote(id: string): void;
  moveScene(sid: string, beforeSid: string | null): void;
  moveSceneToSection(sid: string, sectionIdx: number | null): void;
  lockNumbers(lock: boolean): void;
  commitRevisions(): void;
  moveRevisionsTo(gen: number): void;
  takeSnapshot(label?: string): Promise<void>;
  loadSnapshots(): Promise<void>;
  restoreSnapshot(s: Snapshot): Promise<void>;
  /* arayüz */
  setTab(t: Tab): void;
  openScript(sid?: string): void;
  openNote(id: string): void;
  setTheme(t: Theme): void;
  setZoom(z: number): void;
  setAutosave(v: boolean): void;
  toggle(key: 'focus' | 'inspector' | 'findOpen' | 'spellOn' | 'tdkOn', v?: boolean): void;
  setDailyGoal(n: number): void;
  startSprint(minutes: number, target: number | null): void;
  stopSprint(completed: boolean): Promise<void>;
  openDialogBox(d: Dialog): void;
  ask(title: string, message: string, buttons: ConfirmButton[]): Promise<string>;
  notify(text: string, kind?: 'info' | 'error'): void;
  setCursor(sid: string | null, page?: { current: number; total: number }): void;
  setFilter(f: Partial<State['filter']>): void;
}

/* ---------- tercihler (pencere başına değil, kullanıcıya ait) ---------- */
const pref = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
};
const setPref = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* yok say */
  }
};

/** Bu pencerenin kurtarma yuvası */
const slot = (() => {
  try {
    const s = sessionStorage.getItem('wtf.slot');
    if (s) return s;
    const n = Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem('wtf.slot', n);
    return n;
  } catch {
    return 'main';
  }
})();
const RECOVERY_PREFIX = 'wtf.recovery.';

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const later = (key: string, ms: number, fn: () => void) => {
  clearTimeout(timers.get(key));
  timers.set(key, setTimeout(fn, ms));
};

interface JsonDoc {
  type: 'doc';
  content: { type: string; attrs?: Record<string, unknown>; content?: { type: string; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] }[] }[];
}

const plainOf = (model: ScriptModel) => model.blocks.map((b) => b.runs.map((r) => r.text).join('')).join('\n');

export const useStore = create<State>((set, get) => {
  /** Belge değişti: kirli işaretle, modeli güncelle, kurtarma ve otomatik kayıt planla */
  const touch = (opts: { remodel?: boolean } = {}) => {
    set({ doc: { ...get().doc, dirty: true } });
    if (opts.remodel !== false) later('model', 150, () => set({ model: buildModel(get().script, get().settings.paper) }));
    later('recovery', 1500, () => {
      const st = get();
      if (st.status !== 'ready' || !st.doc.dirty) return;
      setPref(RECOVERY_PREFIX + slot, { key: st.doc.key, path: st.doc.path, content: st.serialize(), at: Date.now() });
    });
    if (get().autosave && get().doc.path) later('autosave', 4000, () => void autoSave());
  };

  const clearRecovery = () => {
    try {
      localStorage.removeItem(RECOVERY_PREFIX + slot);
    } catch {
      /* yok say */
    }
  };

  const autoSave = async () => {
    const st = get();
    if (!st.doc.path || !st.doc.dirty || st.saving) return;
    const disk = await fileMtime(st.doc.path).catch(() => null);
    if (st.doc.mtime && disk && disk !== st.doc.mtime) {
      st.notify(t('Dosya başka bir programda değişti; otomatik kayıt durduruldu. Kaydet ile karar verebilirsin.'), 'error');
      return;
    }
    await writeOut(st.doc.path);
  };

  const writeOut = async (path: string): Promise<boolean> => {
    editorBridge.flush();
    set({ saving: true });
    try {
      const content = get().serialize();
      const mtime = await writeText(path, content);
      const title = get().title.title || baseName(path);
      set({ doc: { key: path, path, mtime, dirty: false }, saving: false, lastSaved: Date.now() });
      clearRecovery();
      await get().repo?.touchRecent(path, title);
      set({ recent: (await get().repo?.recent()) ?? [] });
      return true;
    } catch (e) {
      set({ saving: false });
      get().notify(e instanceof Error ? e.message : String(e), 'error');
      return false;
    }
  };

  /** Ayrıştırılmış bir belgeyi pencereye yükle */
  const load = (d: ScriptDocument, doc: DocState) => {
    setCaseLang(d.settings.lang);
    const script = JSON.stringify(d.doc);
    const model = buildModel(script, d.settings.paper);
    set({
      status: 'ready',
      doc,
      title: d.title,
      settings: d.settings,
      script,
      wordCount: countWords(plainOf(model)),
      scenes: d.scenes,
      characters: d.characters,
      notes: d.notes,
      model,
      active: { kind: 'script' },
      tab: 'write',
      revision: get().revision + 1,
      snapshots: [],
      cursorSid: null,
      findOpen: false,
      filter: { character: null, color: null, location: null },
    });
    get().loadSnapshots();
  };

  const currentJson = (): JsonDoc => {
    editorBridge.flush();
    return JSON.parse(get().script || '{"type":"doc","content":[]}');
  };

  return {
    status: 'loading',
    repo: null,
    doc: { key: 'untitled:0', path: null, mtime: null, dirty: false },
    title: emptyTitle(),
    settings: DEFAULT_SETTINGS,
    script: '',
    wordCount: 0,
    scenes: {},
    characters: {},
    notes: [],
    model: null,
    active: { kind: 'script' },
    tab: 'write',
    // v0.4.1: varsayılan tema karanlık (eski 'wtf.theme' tercihi bilerek okunmuyor)
    theme: pref<Theme>('wtf.theme2', 'dark'),
    zoom: pref<number>('wtf.zoom', 1),
    autosave: pref<boolean>('wtf.autosave', true),
    focus: false,
    inspector: true,
    findOpen: false,
    dialog: null,
    confirm: null,
    toast: null,
    saving: false,
    lastSaved: null,
    wordsToday: 0,
    dailyGoal: pref<number>('wtf.goal', 1000),
    sprint: null,
    spellOn: pref<boolean>('wtf.spell', true),
    tdkOn: pref<boolean>('wtf.tdk', true),
    snapshots: [],
    recent: [],
    recovery: [],
    stamp: 0,
    revision: 0,
    cursorSid: null,
    page: { current: 1, total: 1 },
    filter: { character: null, color: null, location: null },

    async init() {
      const repo = await getRepository();
      set({ repo, recent: await repo.recent(), wordsToday: await repo.wordsToday(today()) });
      // kurtarılabilir çalışmalar (yalnızca başka bir pencerenin canlı yuvası değilse anlamlı; hepsini gösteririz)
      const rec: State['recovery'] = [];
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)!;
          if (!k.startsWith(RECOVERY_PREFIX)) continue;
          const v = JSON.parse(localStorage.getItem(k) || 'null');
          if (v?.content) rec.push({ ...v, slot: k.slice(RECOVERY_PREFIX.length) });
        }
      } catch {
        /* yok say */
      }
      set({ recovery: rec.sort((a, b) => b.at - a.at) });

      const { startupFile } = await import('../data/files');
      const file = await startupFile().catch(() => null);
      if (file && (await get().openPath(file))) return;
      if (new URLSearchParams(window.location.search).get('new')) {
        await get().newDocument(false);
        return;
      }
      set({ status: 'start' });
    },

    async newDocument(sample = false) {
      if (get().status === 'ready' && !(await get().guardUnsaved(t('Yeni bir senaryo açmadan önce kaydedilsin mi?')))) return false;
      const s = sample ? sampleProject() : null;
      const d: ScriptDocument = {
        title: { ...emptyTitle(), title: s?.title ?? '' },
        // yeni senaryo arayüz dilinde başlar (örnek senaryo Türkçe)
        settings: { ...DEFAULT_SETTINGS, lang: sample ? 'tr' : uiLang() },
        doc: JSON.parse(s?.script.doc ?? emptyScript(newSid())),
        scenes: Object.fromEntries((s?.scenes ?? []).map((x) => [x.sid, x])),
        characters: Object.fromEntries((s?.characters ?? []).map((c) => [c.name, c])),
        notes: (s?.notes ?? []).map((n) => ({ id: n.id, title: n.title, doc: n.doc })),
      };
      load(d, { key: `untitled:${uid()}`, path: null, mtime: null, dirty: !!sample });
      clearRecovery();
      return true;
    },

    async openPath(path) {
      if (get().status === 'ready' && get().doc.path === path) return true;
      if (get().status === 'ready' && !(await get().guardUnsaved(t('Başka bir senaryo açmadan önce kaydedilsin mi?')))) return false;
      try {
        if (!(await fileExists(path))) throw new Error(t('Dosya bulunamadı; taşınmış ya da silinmiş olabilir.'));
        const { text, mtime } = await readText(path);
        const d = parseDocument(text, newSid);
        load(d, { key: path, path, mtime, dirty: false });
        clearRecovery();
        await get().repo?.touchRecent(path, d.title.title || baseName(path));
        set({ recent: (await get().repo?.recent()) ?? [] });
        return true;
      } catch (e) {
        get().notify(`${baseName(path)}: ${e instanceof Error ? e.message : String(e)}`, 'error');
        await get().repo?.forgetRecent(path);
        set({ recent: (await get().repo?.recent()) ?? [] });
        return false;
      }
    },

    async openDialog() {
      const path = await pickOpenPath();
      if (path) await get().openPath(path);
    },

    async save() {
      const st = get();
      if (st.status !== 'ready') return false;
      if (!st.doc.path) return get().saveAs();
      const disk = await fileMtime(st.doc.path).catch(() => null);
      if (st.doc.mtime && disk && disk !== st.doc.mtime) {
        const choice = await get().ask(
          t('Dosya dışarıda değişti'),
          t('{name} sen açtıktan sonra başka bir program tarafından değiştirilmiş. Ne yapılsın?', { name: baseName(st.doc.path) }),
          [
            { id: 'cancel', label: t('Vazgeç') },
            { id: 'reload', label: t('Diskteki sürümü aç') },
            { id: 'overwrite', label: t('Benimkiyle üzerine yaz'), primary: true, danger: true },
          ],
        );
        if (choice === 'cancel') return false;
        if (choice === 'reload') {
          await get().takeSnapshot(t('Diskten yeniden yüklemeden önce'));
          const { text, mtime } = await readText(st.doc.path);
          load(parseDocument(text, newSid), { key: st.doc.path, path: st.doc.path, mtime, dirty: false });
          clearRecovery();
          get().notify(t('Diskteki sürüm açıldı; seninki Anlık görüntüler’de duruyor'));
          return false;
        }
      }
      const ok = await writeOut(st.doc.path);
      if (ok) get().notify(t('Kaydedildi'));
      return ok;
    },

    async saveAs() {
      const st = get();
      const suggested = st.title.title || (st.doc.path ? baseName(st.doc.path) : t('Adsız senaryo'));
      const path = await pickSavePath(suggested);
      if (!path) return false;
      const ok = await writeOut(path);
      if (ok) {
        get().notify(t('{name} olarak kaydedildi', { name: `${baseName(path)}.fountain` }));
        get().loadSnapshots();
      }
      return ok;
    },

    async guardUnsaved(action) {
      editorBridge.flush();
      const st = get();
      if (st.status !== 'ready' || !st.doc.dirty) return true;
      const name = st.doc.path ? `${baseName(st.doc.path)}.fountain` : st.title.title || t('Adsız senaryo');
      const choice = await get().ask(t('Kaydedilmemiş değişiklikler'), `${t('“{name}” içindeki değişiklikler kaydedilmedi.', { name })} ${action}`, [
        { id: 'cancel', label: t('Vazgeç') },
        { id: 'discard', label: t('Kaydetme'), danger: true },
        { id: 'save', label: t('Kaydet'), primary: true },
      ]);
      if (choice === 'cancel') return false;
      if (choice === 'save') return get().save();
      clearRecovery();
      return true;
    },

    async loadImported(title, doc, synopses, name) {
      if (get().status === 'ready' && !(await get().guardUnsaved(t('İçe aktarmadan önce kaydedilsin mi?')))) return false;
      const full = finalize(doc, newSid);
      const scenes: Record<string, SceneMeta> = {};
      full.content
        .filter((l) => l.attrs.el === 'sceneHeading')
        .forEach((h, i) => {
          if (synopses?.[i]) scenes[h.attrs.sid!] = { ...emptySceneMeta(h.attrs.sid!), synopsis: synopses[i]! };
        });
      load(
        { title: { ...emptyTitle(), ...title, title: title.title || name || '' }, settings: { ...DEFAULT_SETTINGS }, doc: full, scenes, characters: {}, notes: [] },
        { key: `untitled:${uid()}`, path: null, mtime: null, dirty: true },
      );
      return true;
    },

    async openContent(text, name) {
      if (get().status === 'ready' && !(await get().guardUnsaved(t('Başka bir senaryo açmadan önce kaydedilsin mi?')))) return false;
      const d = parseDocument(text, newSid);
      if (!d.title.title && name) d.title.title = name;
      load(d, { key: `untitled:${uid()}`, path: null, mtime: null, dirty: true });
      return true;
    },

    restoreRecovery(s) {
      const r = get().recovery.find((x) => x.slot === s);
      if (!r) return;
      const d = parseDocument(r.content, newSid);
      load(d, { key: r.path ?? `untitled:${uid()}`, path: r.path, mtime: null, dirty: true });
      get().discardRecovery(s);
      get().notify(t('Kurtarılan çalışma açıldı — kaydetmeyi unutma'));
    },
    discardRecovery(s) {
      try {
        localStorage.removeItem(RECOVERY_PREFIX + s);
      } catch {
        /* yok say */
      }
      set({ recovery: get().recovery.filter((r) => r.slot !== s) });
    },

    serialize() {
      const st = get();
      return serializeDocument({
        title: st.title,
        settings: st.settings,
        doc: JSON.parse(st.script || '{"type":"doc","content":[]}'),
        scenes: st.scenes,
        characters: st.characters,
        notes: st.notes,
      });
    },

    saveScript(doc, plainText) {
      const st = get();
      if (st.script === doc) return;
      const wordCount = countWords(plainText);
      const delta = wordCount - st.wordCount;
      set({ script: doc, wordCount });
      touch();
      if (delta !== 0) {
        const before = get().wordsToday;
        const after = Math.max(0, before + delta);
        const sp = get().sprint;
        set({ wordsToday: after, ...(sp ? { sprint: { ...sp, words: sp.words + delta } } : {}) });
        st.repo?.addWords(today(), delta);
        const goal = get().dailyGoal;
        if (goal > 0 && before < goal && after >= goal) get().notify(t('Günün hedefi tamam: {n} kelime', { n: goal }));
      }
    },

    replaceScript(doc) {
      const script = JSON.stringify(doc);
      const model = buildModel(script, get().settings.paper);
      set({ script, model, wordCount: countWords(plainOf(model)), revision: get().revision + 1 });
      touch({ remodel: false });
    },

    updateTitle(patch) {
      set({ title: { ...get().title, ...patch } });
      touch({ remodel: false });
    },
    updateSettings(patch) {
      set({ settings: { ...get().settings, ...patch } });
      if (patch.lang) setCaseLang(patch.lang);
      if (patch.paper || patch.lang) set({ model: buildModel(get().script, get().settings.paper), revision: get().revision + 1 });
      touch({ remodel: false });
    },
    updateScene(sid, patch) {
      const cur = get().scenes[sid] ?? emptySceneMeta(sid);
      set({ scenes: { ...get().scenes, [sid]: { ...cur, ...patch } } });
      touch({ remodel: false });
    },
    updateCharacter(name, patch) {
      const cur = get().characters[name] ?? { name, description: '', color: null };
      set({ characters: { ...get().characters, [name]: { ...cur, ...patch } } });
      touch({ remodel: false });
    },
    saveNote(id, doc) {
      const cur = get().notes.find((n) => n.id === id);
      if (!cur || cur.doc === doc) return;
      set({ notes: get().notes.map((n) => (n.id === id ? { ...n, doc } : n)) });
      touch({ remodel: false });
    },
    addNote() {
      const n: DocNote = { id: uid(), title: t('Yeni not'), doc: null };
      set({ notes: [...get().notes, n], active: { kind: 'note', id: n.id }, tab: 'write' });
      touch({ remodel: false });
    },
    updateNote(id, patch) {
      set({ notes: get().notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
      touch({ remodel: false });
    },
    deleteNote(id) {
      set({ notes: get().notes.filter((n) => n.id !== id), active: { kind: 'script' } });
      touch({ remodel: false });
    },

    moveScene(sid, beforeSid) {
      get().replaceScript(moveScene(currentJson(), sid, beforeSid));
    },
    moveSceneToSection(sid, sectionIdx) {
      get().replaceScript(moveSceneToSection(currentJson(), sid, sectionIdx));
    },
    lockNumbers(lock) {
      const doc = currentJson();
      const model = buildModel(doc, get().settings.paper);
      const bySid = new Map(model.scenes.map((s) => [s.sid, s.number]));
      for (const l of doc.content) if (l.attrs?.el === 'sceneHeading') l.attrs.num = lock ? (bySid.get(l.attrs.sid as string) ?? null) : null;
      get().replaceScript(doc);
      get().notify(lock ? t('Sahne numaraları kilitlendi') : t('Sahne numaralarının kilidi açıldı'));
    },
    commitRevisions() {
      const doc = currentJson();
      for (const l of doc.content) {
        l.content = (l.content ?? [])
          // silinmeye aday metni gerçekten sil
          .filter((c) => !c.marks?.some((m) => m.type === 'del'))
          .map((c) => (c.marks ? { ...c, marks: c.marks.filter((m) => m.type !== 'rev') } : c))
          .map((c) => (c.marks && !c.marks.length ? { type: c.type, text: c.text } : c));
      }
      get().replaceScript(doc);
      get().notify(t('Revizyonlar onaylandı'));
    },
    moveRevisionsTo(gen) {
      const doc = currentJson();
      for (const l of doc.content)
        for (const c of l.content ?? [])
          for (const m of c.marks ?? []) if (m.type === 'rev' || m.type === 'del') m.attrs = { ...m.attrs, gen };
      get().replaceScript(doc);
    },

    async takeSnapshot(label) {
      editorBridge.flush();
      const st = get();
      if (st.status !== 'ready') return;
      const d = new Date();
      const snap: Snapshot = {
        id: uid(),
        docKey: st.doc.key,
        label: label ?? d.toLocaleString(locale(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
        content: st.serialize(),
        wordCount: st.wordCount,
        createdAt: d.getTime(),
      };
      await st.repo?.addSnapshot(snap);
      set({ snapshots: [snap, ...get().snapshots], stamp: label ? get().stamp : Date.now() });
    },
    async loadSnapshots() {
      set({ snapshots: (await get().repo?.listSnapshots(get().doc.key)) ?? [] });
    },
    async restoreSnapshot(s) {
      await get().takeSnapshot(t('Geri yüklemeden önce'));
      const d = parseDocument(s.content, newSid);
      const docState = get().doc;
      load(d, { ...docState, dirty: true });
    },

    setTab: (tab) => {
      editorBridge.flush();
      set({ tab });
    },
    openScript(sid) {
      set({ active: { kind: 'script' }, tab: 'write' });
      if (sid) setTimeout(() => editorBridge.scrollToSid(sid), 60);
    },
    openNote(id) {
      editorBridge.flush();
      set({ active: { kind: 'note', id }, tab: 'write' });
    },
    setTheme(theme) {
      setPref('wtf.theme2', theme);
      set({ theme });
    },
    setZoom(z) {
      const zoom = Math.min(1.6, Math.max(0.7, Math.round(z * 10) / 10));
      setPref('wtf.zoom', zoom);
      set({ zoom });
    },
    setAutosave(v) {
      setPref('wtf.autosave', v);
      set({ autosave: v });
      if (v && get().doc.dirty && get().doc.path) void autoSave();
    },
    toggle(key, v) {
      const next = v ?? !get()[key];
      if (key === 'spellOn') setPref('wtf.spell', next);
      if (key === 'tdkOn') setPref('wtf.tdk', next);
      set({ [key]: next } as Partial<State>);
    },
    setDailyGoal(n) {
      const goal = Math.max(0, Math.min(100000, Math.round(n) || 0));
      setPref('wtf.goal', goal);
      set({ dailyGoal: goal });
    },
    startSprint(minutes, target) {
      editorBridge.flush();
      set({ sprint: { id: uid(), startedAt: Date.now(), minutes, target, words: 0 } });
    },
    async stopSprint(completed) {
      editorBridge.flush();
      const sp = get().sprint;
      if (!sp) return;
      set({ sprint: null });
      const words = Math.max(0, sp.words);
      const elapsed = Math.max(1, Math.round((Date.now() - sp.startedAt) / 60000));
      await get().repo?.addSprint({
        id: sp.id,
        startedAt: sp.startedAt,
        minutes: completed ? sp.minutes : Math.min(sp.minutes, elapsed),
        words,
        target: sp.target,
        completed,
      });
      const hit = sp.target ? words >= sp.target : true;
      get().notify(
        completed
          ? sp.target
            ? hit
              ? t('Seans bitti: {n} kelime — hedef tuttu', { n: words })
              : t('Seans bitti: {n} / {target} kelime', { n: words, target: sp.target })
            : t('Seans bitti: {n} kelime', { n: words })
          : t('Seans durduruldu: {n} kelime', { n: words }),
      );
    },
    openDialogBox(d) {
      set({ dialog: d });
    },
    ask(title, message, buttons) {
      return new Promise((resolve) => {
        set({
          confirm: {
            title,
            message,
            buttons,
            resolve: (id) => {
              set({ confirm: null });
              resolve(id);
            },
          },
        });
      });
    },
    notify(text, kind = 'info') {
      set({ toast: { text, kind, at: Date.now() } });
      later('toast', kind === 'error' ? 6000 : 2400, () => set({ toast: null }));
    },
    setCursor(sid, page) {
      const st = get();
      if (st.cursorSid !== sid || (page && (page.current !== st.page.current || page.total !== st.page.total)))
        set({ cursorSid: sid, ...(page ? { page } : {}) });
    },
    setFilter(f) {
      set({ filter: { ...get().filter, ...f } });
    },
  };
});

/** Pencere başlığı: "dosya.fountain ● — writetheFout." */
export function windowTitle(st: Pick<State, 'doc' | 'title' | 'status'>): string {
  if (st.status !== 'ready') return 'writetheFout.';
  const name = st.doc.path ? `${baseName(st.doc.path)}.fountain` : st.title.title || t('Adsız senaryo');
  return `${st.doc.dirty ? '● ' : ''}${name} — writetheFout.`;
}
