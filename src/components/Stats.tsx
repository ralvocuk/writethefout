import { useStore } from '../store/useStore';
import { TAG_CATS, formatEighths, formatNumber } from '../script/elements';
import { Stat } from './Characters';
import { safeName, saveFile } from '../export/platform';

function Bars({ items }: { items: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="hbars">
      {items.map((i) => (
        <div className="hbar" key={i.label}>
          <span className="hbar-label" title={i.label}>
            {i.label}
          </span>
          <span className="bar">
            <i style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <span className="num muted">{i.note ?? i.value}</span>
        </div>
      ))}
    </div>
  );
}

/** İstatistikler ve prodüksiyon dökümü */
export function Stats() {
  const model = useStore((s) => s.model);
  const docTitle = useStore((s) => s.title.title);
  const openScript = useStore((s) => s.openScript);
  if (!model) return null;
  const sc = model.scenes;
  const totalEighths = sc.reduce((a, s) => a + s.eighths, 0);
  const avg = sc.length ? Math.round(totalEighths / sc.length) : 0;
  const longest = [...sc].sort((a, b) => b.eighths - a.eighths)[0];

  const count = (key: (s: (typeof sc)[number]) => string) => {
    const m = new Map<string, { n: number; e: number }>();
    for (const s of sc) {
      const k = key(s) || '—';
      const v = m.get(k) ?? { n: 0, e: 0 };
      v.n++;
      v.e += s.eighths;
      m.set(k, v);
    }
    return [...m.entries()].sort((a, b) => b[1].e - a[1].e);
  };
  const ie = count((s) => s.intExt);
  const times = count((s) => s.time);
  const locs = count((s) => s.location).slice(0, 12);
  const dialoguePct = model.dialogueWords + model.actionWords ? Math.round((model.dialogueWords / (model.dialogueWords + model.actionWords)) * 100) : 0;

  // prodüksiyon dökümü
  const breakdown = TAG_CATS.map((cat) => {
    const items = new Map<string, Set<string>>();
    for (const s of sc)
      for (const t of s.tags)
        if (t.cat === cat.id && t.text) {
          const key = t.text.toLocaleLowerCase('tr-TR');
          const set = items.get(key) ?? new Set<string>();
          set.add(s.number);
          items.set(key, set);
        }
    return { cat, items: [...items.entries()].map(([text, nums]) => ({ text, scenes: [...nums] })) };
  }).filter((b) => b.items.length);

  const exportCsv = async () => {
    const rows = [['Kategori', 'Öğe', 'Sahneler']];
    for (const b of breakdown) for (const it of b.items) rows.push([b.cat.name, it.text, it.scenes.join(' ')]);
    // sahne başına döküm
    rows.push([], ['Sahne', 'Başlık', 'Sayfa', 'Uzunluk', 'Karakterler', ...TAG_CATS.map((c) => c.name)]);
    for (const s of sc)
      rows.push([
        s.number,
        s.heading,
        String(s.page),
        formatEighths(s.eighths),
        s.characters.join(', '),
        ...TAG_CATS.map((c) => s.tags.filter((t) => t.cat === c.id).map((t) => t.text).join(', ')),
      ]);
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    await saveFile(`${safeName(docTitle || 'senaryo')} - döküm.csv`, csv, { name: 'CSV', extensions: ['csv'] });
  };

  return (
    <div className="view-pad stats">
      <div className="stat-row big">
        <Stat n={model.pages} label="sayfa" />
        <Stat n={`≈ ${Math.max(1, Math.round(totalEighths / 8))}`} label="dakika" />
        <Stat n={sc.length} label="sahne" />
        <Stat n={formatEighths(avg)} label="ortalama sahne (sayfa)" />
        <Stat n={model.characters.length} label="konuşan karakter" />
        <Stat n={`%${dialoguePct}`} label="diyalog / aksiyon" />
      </div>
      {longest ? (
        <p className="hint">
          En uzun sahne:{' '}
          <button className="link" onClick={() => openScript(longest.sid)}>
            {longest.number}. {longest.heading}
          </button>{' '}
          ({formatEighths(longest.eighths)} sayfa)
        </p>
      ) : null}

      <div className="stats-grid">
        <section>
          <h3 className="label">İç / dış</h3>
          <Bars items={ie.map(([k, v]) => ({ label: k, value: v.e, note: `${v.n} sahne` }))} />
        </section>
        <section>
          <h3 className="label">Günün saati</h3>
          <Bars items={times.map(([k, v]) => ({ label: k, value: v.e, note: `${v.n} sahne` }))} />
        </section>
        <section>
          <h3 className="label">Mekanlar (sayfa)</h3>
          <Bars items={locs.map(([k, v]) => ({ label: k, value: v.e, note: formatEighths(v.e) }))} />
        </section>
        <section>
          <h3 className="label">Replikler</h3>
          <Bars items={model.characters.slice(0, 12).map((c) => ({ label: c.name, value: c.lines, note: `${c.lines} · ${formatNumber(c.words)} k.` }))} />
        </section>
      </div>

      <section className="breakdown">
        <div className="breakdown-head">
          <h3 className="label">Prodüksiyon dökümü</h3>
          <button className="btn" onClick={exportCsv}>
            CSV olarak kaydet
          </button>
        </div>
        {breakdown.length === 0 ? (
          <p className="hint">
            Senaryoda bir kelimeyi seçip <span className="kbd">Ctrl</span>
            <span className="kbd">T</span> ile etiketle (aksesuar, kostüm, araç…). Burada sahne numaralarıyla listelenir.
          </p>
        ) : (
          <div className="breakdown-grid">
            {breakdown.map((b) => (
              <div key={b.cat.id} className="bd-cat">
                <div className="bd-title">
                  <i style={{ background: `var(${b.cat.color})` }} />
                  {b.cat.name}
                </div>
                {b.items.map((it) => (
                  <div key={it.text} className="bd-item">
                    <span>{it.text}</span>
                    <span className="num muted">{it.scenes.join(', ')}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
