import { UI_LANGS, setUiLang, t, useLang, type UiLang } from '../i18n';

/** Arayüz dili seçici */
export function LangSwitch() {
  const lang = useLang((s) => s.lang);
  return (
    <label className="lang-switch" title={t('Arayüz dili')}>
      <span className="muted">{t('Dil')}</span>
      <select className="select small" value={lang} onChange={(e) => setUiLang(e.target.value as UiLang)} aria-label={t('Arayüz dili')}>
        {UI_LANGS.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
