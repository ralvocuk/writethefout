import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Modal } from './Dialogs';
import { spell } from '../spell/client';

const close = () => useStore.getState().openDialogBox(null);

/** Kişisel sözlük: eklenen kelimeleri gör, sil, yenisini ekle */
export function DictionaryDialog() {
  const open = useStore((s) => s.dialog === 'dictionary');
  const spellOn = useStore((s) => s.spellOn);
  const toggle = useStore((s) => s.toggle);
  const [, force] = useState(0);
  const [q, setQ] = useState('');
  useEffect(() => spell.subscribe(() => force((x) => x + 1)), []);
  if (!open) return null;
  const words = spell.userWords();
  const add = () => {
    const w = q.trim();
    if (!w || /\s/.test(w)) return;
    spell.addToDictionary(w);
    setQ('');
  };
  const status = { off: 'Sözlük henüz yüklenmedi', loading: 'Sözlük yükleniyor…', ready: 'Türkçe sözlük hazır', error: 'Sözlük yüklenemedi' }[spell.status];
  return (
    <Modal
      title="Yazım denetimi"
      aside={status}
      onClose={close}
      foot={
        <>
          <label className="opt-row check" style={{ padding: 0 }}>
            <input type="checkbox" checked={spellOn} onChange={(e) => toggle('spellOn', e.target.checked)} />
            <span>Yazarken denetle (F7)</span>
          </label>
          <span className="grow" />
          <button className="btn" onClick={close}>
            Kapat
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <p className="hint" style={{ marginTop: 0 }}>
          Altı çizili kelimeye sağ tıklayıp öneri seçebilir ya da sözlüğe ekleyebilirsin. <span className="kbd">F8</span> sıradaki hataya
          gider. Karakter adları kendiliğinden doğru sayılır.
        </p>
        <div className="opt-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <input
            className="text-input"
            value={q}
            placeholder="Sözlüğe kelime ekle"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn" onClick={add} disabled={!q.trim()}>
            Ekle
          </button>
        </div>
        <div className="dict-list">
          {words.length ? (
            words.map((w) => (
              <div className="dict-row" key={w}>
                <span>{w}</span>
                <button className="text-btn" onClick={() => spell.removeFromDictionary(w)}>
                  Kaldır
                </button>
              </div>
            ))
          ) : (
            <p className="hint">Kişisel sözlüğün boş.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
