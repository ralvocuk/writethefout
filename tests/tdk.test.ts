// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { _resetTdk, decide, eligible, matchCase, suggestionFor, type TdkResult } from '../src/spell/tdk';

// sozluk.gov.tr/gts yanıtlarından (alanlar kısaltıldı)
const mekan: TdkResult = [{ madde: 'mekân', madde_duz: 'mekan' }];
const hikaye: TdkResult = [{ madde: 'hikâye', madde_duz: 'hikaye' }];
const kar: TdkResult = [{ madde: 'kar' }, { madde: 'kâr', madde_duz: 'kar' }];
const hala: TdkResult = [
  { madde: 'hala', anlam: 'Babanın kız kardeşi' },
  { madde: 'hâlâ', madde_duz: 'hala', anlam: 'Şimdiye kadar, henüz' },
];

describe('TDK yazım önerisi', () => {
  beforeEach(() => _resetTdk());

  it('kararlar: yalnızca kesin durumda öneri', () => {
    expect(decide('mekan', mekan)).toMatchObject({ kind: 'sure', text: 'mekân' });
    expect(decide('mekân', mekan)).toEqual({ kind: 'valid' });
    // iki biçim de var: anlamlarıyla "bunu mu demek istediniz?"
    expect(decide('hala', hala)).toEqual({ kind: 'ambiguous', text: 'hâlâ', meaning: 'Şimdiye kadar, henüz', ownMeaning: 'Babanın kız kardeşi' });
    expect(decide('kar', kar)).toMatchObject({ kind: 'ambiguous', text: 'kâr' });
    expect(decide('gidyorum', null)).toEqual({ kind: 'none' });
  });

  it('uygun kelimeler', () => {
    expect(eligible('mekan')).toBe(true);
    expect(eligible('mekân')).toBe(false);
    expect(eligible('ev')).toBe(false);
    expect(eligible('ördek')).toBe(false); // a/ı/u yok — i bile yok
    expect(eligible("Danny'nin")).toBe(false);
  });

  it('harf düzeni korunur', () => {
    expect(matchCase('MEKAN', 'mekân')).toBe('MEKÂN');
    expect(matchCase('Mekan', 'mekân')).toBe('Mekân');
    expect(matchCase('ikinci', 'îkinci')).toBe('îkinci');
  });

  it('kök + ek: mekanda → mekânda, hikayeyi → hikâyeyi; karda öneri yok', async () => {
    _resetTdk({ mekan, hikaye, kar, mekanda: null, mekand: null, hikayeyi: null, hikayey: null, karda: null, kard: null });
    expect((await suggestionFor('mekanda'))?.text).toBe('mekânda');
    expect((await suggestionFor('Hikayeyi'))?.text).toBe('Hikâyeyi');
    // kökte anlam ayrımı yapılmaz: "karda" ≠ "kârda"
    expect(await suggestionFor('karda')).toBeNull();
    expect(await suggestionFor('mekan')).toMatchObject({ text: 'mekân', ambiguous: false });
  });

  it('hala yazınca hâlâ anlamıyla önerilir', async () => {
    _resetTdk({ hala });
    expect(await suggestionFor('Hala')).toEqual({ text: 'Hâlâ', ambiguous: true, meaning: 'Şimdiye kadar, henüz', ownMeaning: 'Babanın kız kardeşi' });
  });

  it('ağa gider, sonucu önbelleğe alır', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        calls.push(url);
        return { text: async () => (url.includes('mekan') ? JSON.stringify(mekan) : '{"error":"Sonuç bulunamadı"}') } as Response;
      }),
    );
    expect((await suggestionFor('mekan'))?.text).toBe('mekân');
    expect((await suggestionFor('mekan'))?.text).toBe('mekân');
    expect(calls).toEqual(['/tdk/gts?ara=mekan']);
    vi.unstubAllGlobals();
  });
});

import nspell from 'nspell';
import { readFileSync } from 'node:fs';
import { checkWord, setSpellLang, suggestWord } from '../src/spell/engine';
import { editDistance } from '../src/spell/common-tr';

describe('kelime yazımı', () => {
  const sp = nspell(readFileSync('public/dict/tr.aff', 'utf8'), readFileSync('public/dict/tr.dic', 'utf8'));
  setSpellLang('tr');
  it('sık yanlışlar yakalanır, doğru biçim ilk öneri', () => {
    const cases: [string, string][] = [
      ['seyehat', 'seyahat'],
      ['yanlız', 'yalnız'],
      ['yalnış', 'yanlış'],
      ['herkez', 'herkes'],
      ['herşey', 'her şey'],
      ['birsey', 'bir şey'],
      ['tabiki', 'tabii ki'],
      ['orjinal', 'orijinal'],
      ['süpriz', 'sürpriz'],
      ['ünvan', 'unvan'],
      ['mütevazi', 'mütevazı'],
      ['Yanlız', 'Yalnız'],
      ['SEYEHAT', 'SEYAHAT'],
    ];
    for (const [w, ok] of cases) {
      expect(checkWord(sp, w), w).toBe(false);
      expect(suggestWord(sp, w)[0], w).toBe(ok);
    }
  });
  it('yakınlık: yer değiştirme tek hata sayılır', () => {
    expect(editDistance('yanlız', 'yalnız')).toBe(1);
    expect(editDistance('seyehat', 'seyahat')).toBe(1);
  });
}, 60000);
