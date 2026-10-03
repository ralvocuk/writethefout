import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { commands, type Command } from '../commands';
import { locale, t } from '../i18n';

/** Arama için aksan ve büyük/küçük harf duyarsız biçim (ı → i, ß → ss dahil) */
const fold = (s: string) =>
  s
    .toLocaleLowerCase(locale())
    .replace(/ı/g, 'i')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');

interface Item {
  id: string;
  kind: string;
  label: string;
  hint?: string;
  run: () => void;
}

/** Komut paleti: sahneye git, notu aç ya da herhangi bir komutu çalıştır */
export function Palette() {
  const open = useStore((s) => s.dialog === 'palette');
  const model = useStore((s) => s.model);
  const notes = useStore((s) => s.notes);
  const ready = useStore((s) => s.status === 'ready');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const close = () => useStore.getState().openDialogBox(null);

  const items = useMemo<Item[]>(() => {
    const s = useStore.getState();
    const goTo: Item[] = (model?.scenes ?? []).map((sc) => ({
      id: `go-${sc.sid}`,
      kind: t('Sahne {n}', { n: sc.number }),
      label: sc.heading || t('Başlıksız sahne'),
      run: () => s.openScript(sc.sid),
    }));
    const noteItems: Item[] = notes.map((n) => ({ id: `note-${n.id}`, kind: t('Not'), label: n.title, run: () => s.openNote(n.id) }));
    const cmds: Item[] = commands()
      .filter((c: Command) => ready || !c.needsDoc)
      .filter((c) => c.id !== 'palette')
      .map((c) => ({ id: c.id, kind: c.group, label: c.label, hint: c.keys, run: () => void c.run() }));
    return [...goTo, ...noteItems, ...cmds];
  }, [model, notes, ready, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const f = fold(q.trim());
    if (!f) return items;
    return items.filter((c) => fold(`${c.kind} ${c.label}`).includes(f));
  }, [q, items]);

  useEffect(() => setSel(0), [q, open]);
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  if (!open) return null;
  const run = (c?: Item) => {
    if (!c) return;
    close();
    setTimeout(c.run, 0);
  };
  return (
    <div className="palette-backdrop" onMouseDown={close}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={t('Komut paleti')}>
        <input
          autoFocus
          value={q}
          placeholder={t('Sahneye git ya da bir komut yaz…')}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((v) => Math.min(filtered.length - 1, v + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((v) => Math.max(0, v - 1));
            }
            if (e.key === 'Enter') run(filtered[sel]);
          }}
        />
        <ul role="listbox">
          {filtered.slice(0, 100).map((c, i) => (
            <li key={c.id} role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
              <span className="kind">{c.kind}</span>
              <span className="grow">{c.label}</span>
              {c.hint ? <span className="kbd">{c.hint}</span> : null}
            </li>
          ))}
          {filtered.length === 0 ? <li className="muted">{t('Eşleşen yok.')}</li> : null}
        </ul>
      </div>
    </div>
  );
}
