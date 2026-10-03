// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { _resetTdk, decide, eligible, matchCase, suggestionFor, type TdkResult } from '../src/spell/tdk';

// sozluk.gov.tr/gts yanıtlarından (alanlar kısaltıldı)
const mekan: TdkResult = [{ madde: 'mekân', madde_duz: 'mekan' }];
const hikaye: TdkResult = [{ madde: 'hikâye', madde_duz: 'hikaye' }];
const kar: TdkResult = [{ madde: 'kar' }, { madde: 'kâr', madde_duz: 'kar' }];
const hala: TdkResult = [{ madde: 'hala' }, { madde: 'hâlâ', madde_duz: 'hala' }];

describe('TDK yazım önerisi', () => {
  beforeEach(() => _resetTdk());

  it('kararlar: yalnızca kesin durumda öneri', () => {
    expect(decide('mekan', mekan)).toBe('mekân');
    expect(decide('mekân', mekan)).toBeUndefined();
    expect(decide('kar', kar)).toBeUndefined(); // kar/kâr anlam farkı: dokunma
    expect(decide('hala', hala)).toBeUndefined();
    expect(decide('gidyorum', null)).toBeNull();
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
    expect(await suggestionFor('mekanda')).toBe('mekânda');
    expect(await suggestionFor('Hikayeyi')).toBe('Hikâyeyi');
    expect(await suggestionFor('karda')).toBeNull();
    expect(await suggestionFor('mekan')).toBe('mekân');
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
    expect(await suggestionFor('mekan')).toBe('mekân');
    expect(await suggestionFor('mekan')).toBe('mekân');
    expect(calls).toEqual(['/tdk/gts?ara=mekan']);
    vi.unstubAllGlobals();
  });
});
