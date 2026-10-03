import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Modal } from './Dialogs';
import { spell } from '../spell/client';
import { t } from '../i18n';
import { SCRIPT_LANGS } from '../export/layout';

const close = () => useStore.getState().openDialogBox(null);

/** Kişisel sözlük: eklenen kelimeleri gör, sil, yenisini ekle */
export function DictionaryDialog() {
  const open = useStore((s) => s.dialog === 'dictionary');
  const spellOn = useStore((s) => s.spellOn);
  const toggle = useStore((s) => s.toggle);
  const scriptLang = useStore((s) => s.settings.lang);
  const tdkOn = useStore((s) => s.tdkOn);
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
  const langName = SCRIPT_LANGS.find((l) => l.id === scriptLang)?.name ?? scriptLang;
  const supported = spell.supports(scriptLang);
  const status = !supported
    ? t('{lang} için sözlük yok', { lang: langName })
    : {
        off: t('Sözlük henüz yüklenmedi'),
        loading: t('Sözlük yükleniyor…'),
        ready: t('{lang} sözlüğü hazır', { lang: langName }),
        error: t('Sözlük yüklenemedi'),
      }[spell.status];
  return (
    <Modal
      title={t('Yazım denetimi')}
      aside={status}
      onClose={close}
      foot={
        <>
          <label className="opt-row check" style={{ padding: 0 }}>
            <input type="checkbox" checked={spellOn} onChange={(e) => toggle('spellOn', e.target.checked)} />
            <span>{t('Yazarken denetle (F7)')}</span>
          </label>
          <span className="grow" />
          <button className="btn" onClick={close}>
            {t('Kapat')}
          </button>
        </>
      }
    >
      <div className="dialog-body">
        <p className="hint" style={{ marginTop: 0 }}>
          {t('Altı çizili kelimeye sağ tıklayıp öneri seçebilir ya da sözlüğe ekleyebilirsin. F8 sıradaki hataya gider. Karakter adları kendiliğinden doğru sayılır. Sözlük senaryo diline göre seçilir (Türkçe, İngilizce, İspanyolca).')}
        </p>
        <label className="opt-row check tdk-row">
          <input type="checkbox" checked={tdkOn} onChange={(e) => toggle('tdkOn', e.target.checked)} />
          <span>
            {t('TDK yazım önerileri (Türkçe senaryolarda)')}
            <span className="hint" style={{ display: 'block', margin: '2px 0 0' }}>
              {t('Yazmayı bıraktığın kelime TDK Güncel Türkçe Sözlük’te farklı yazılıyorsa (mekan → mekân) altında öneri çıkar; Enter kabul eder, Esc kapatır. Kelime sozluk.gov.tr’ye gönderilir, sonuç bilgisayarında saklanır. İnternet yoksa sessizce atlanır.')}
            </span>
          </span>
        </label>
        <div className="opt-row" style={{ gridTemplateColumns: '1fr auto' }}>
          <input
            className="text-input"
            value={q}
            placeholder={t('Sözlüğe kelime ekle')}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn" onClick={add} disabled={!q.trim()}>
            {t('Ekle')}
          </button>
        </div>
        <div className="dict-list">
          {words.length ? (
            words.map((w) => (
              <div className="dict-row" key={w}>
                <span>{w}</span>
                <button className="text-btn" onClick={() => spell.removeFromDictionary(w)}>
                  {t('Kaldır')}
                </button>
              </div>
            ))
          ) : (
            <p className="hint">{t('Kişisel sözlüğün boş.')}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
