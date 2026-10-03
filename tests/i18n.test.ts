import { describe, expect, it, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { setUiLang, t, translated } from '../src/i18n';
import { EL_LABEL } from '../src/script/elements';
import { numberScenes, paginate, scriptLabels, SCRIPT_LANGS } from '../src/export/layout';
import { parseHeading } from '../src/script/model';
import { detectElement } from '../src/editor/screenplay';
import { toFountain } from '../src/export/fountain';
import { toFdx } from '../src/export/fdx';
import type { ScriptBlock } from '../src/script/blocks';

afterEach(() => setUiLang('tr'));

describe('arayüz çevirisi', () => {
  it('Türkçe kaynak, diğer dillerde katalog', () => {
    setUiLang('tr');
    expect(t('Kaydet')).toBe('Kaydet');
    setUiLang('en');
    expect(t('Kaydet')).toBe('Save');
    setUiLang('de');
    expect(t('Kaydet')).toBe('Speichern');
  });
  it('yer tutucu, sayı biçimi ve çoğul', () => {
    setUiLang('en');
    expect(t('{n} sahne', { n: 1 })).toBe('1 scene');
    expect(t('{n} sahne', { n: 1200 })).toBe('1,200 scenes');
    setUiLang('tr');
    expect(t('{n} sahne', { n: 1200 })).toBe('1.200 sahne');
    setUiLang('fr');
    expect(t('{n} sahne', { n: 0 })).toBe('0 séquence');
  });
  it('eksik çeviri Türkçeye düşer', () => {
    setUiLang('es');
    expect(t('Bu metin katalogda yok')).toBe('Bu metin katalogda yok');
  });
  it('kayıt tabloları okunurken çevrilir', () => {
    setUiLang('en');
    expect(EL_LABEL.sceneHeading).toBe('Scene heading');
    const tbl = translated({ a: 'Kapat' });
    expect(tbl.a).toBe('Close');
  });
  it('her dilde tüm anahtarlar var', () => {
    const keys: string[] = JSON.parse(readFileSync('src/i18n/keys.json', 'utf8'));
    for (const l of ['en', 'de', 'es', 'fr']) {
      const cat = JSON.parse(readFileSync(`src/i18n/locales/${l}.json`, 'utf8'));
      expect(keys.filter((k) => !cat[k])).toEqual([]);
    }
  });
});

describe('senaryo dilleri', () => {
  const B = (el: ScriptBlock['el'], text: string): ScriptBlock => ({ el, runs: [{ text }] });
  it('sayfa etiketleri ve revizyon adları', () => {
    expect(scriptLabels('de').more).toBe('(WEITER)');
    expect(scriptLabels('es').contd).toBe('(CONT.)');
    expect(scriptLabels('fr').revision(1)).toBe('Révision bleue');
    expect(scriptLabels('en').revision(2)).toBe('Pink Revision');
    expect(scriptLabels('tr').revision(3)).toBe('Sarı revizyon');
    expect(SCRIPT_LANGS.map((l) => l.id)).toEqual(['tr', 'en', 'de', 'es', 'fr']);
  });
  it('Almanca sahne başlığı tanınır ve büyük harf ß korunur', () => {
    expect(detectElement('innen. küche - tag', 'action', null)).toBe('sceneHeading');
    expect(detectElement('AUSSEN. STRASSE - NACHT', 'action', null)).toBe('sceneHeading');
    expect(parseHeading('INNEN. KÜCHE - TAG')).toMatchObject({ intExt: 'İÇ', location: 'KÜCHE', time: 'TAG' });
    expect(detectElement('SCHNITT AUF:', 'action', 'dialogue')).toBe('transition');
    expect(detectElement('COUPE SUR :', 'action', 'dialogue')).toBe('transition');
  });
  it('sayfa geçişinde dilin etiketi', () => {
    const long = 'Ein langer Satz, der über mehrere Zeilen geht und nicht endet. '.repeat(30);
    const blocks = numberScenes([B('sceneHeading', 'INNEN. KÜCHE - TAG'), ...Array.from({ length: 20 }, (_, i) => B('action', `Zeile ${i}.`)), B('character', 'Anna'), B('dialogue', long)]);
    const pages = paginate(blocks, { paper: 'a4', lang: 'de', sceneNumbers: true, headingSpace: 2 });
    const text = pages.flatMap((p) => p.lines).map((l) => (l ? l.runs.map((r) => r.text).join('') : ''));
    expect(text.some((s) => s.includes('(WEITER)'))).toBe(true);
    expect(text.some((s) => s.includes('(FORTS.)'))).toBe(true);
  });
  it('başlık sayfası yazar satırı Fountain ve FDX', () => {
    const doc = { type: 'doc' as const, content: [{ type: 'line', attrs: { el: 'action' as const }, content: [{ type: 'text', text: 'Hola.' }] }] };
    expect(toFountain(doc, { title: 'El faro', author: 'Ana', contact: '' }, 'es')).toContain('Credit: Escrito por');
    expect(toFdx([B('action', 'Bonjour.')], { title: 'Le phare', author: 'Léa', contact: '' }, 'fr', false)).toContain('Écrit par');
  });
});
