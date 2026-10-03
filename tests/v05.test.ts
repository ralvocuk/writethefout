import { describe, expect, it, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import nspell from 'nspell';
import { checkWord, suggestWord, WORD_RE, type Speller } from '../src/spell/engine';
import { streakOf, lastDays, addDays, formatClock } from '../src/script/goals';
import { blocksFromJson, type ScriptBlock } from '../src/script/blocks';
import { buildModel } from '../src/script/model';
import { numberScenes, paginate, type LayoutOptions } from '../src/export/layout';
import { cueText, lineListBlocks, scenesWith, sidesBlocks, speechesOf } from '../src/export/sides';
import { renderPdf } from '../src/export/pdf';
import { sampleProject } from '../src/data/sample';

describe('yazım denetimi (Türkçe sözlük)', () => {
  let sp: Speller;
  beforeAll(() => {
    sp = nspell(readFileSync('public/dict/tr.aff', 'utf8'), readFileSync('public/dict/tr.dic', 'utf8'));
  }, 30000);

  it('çekimli Türkçe kelimeleri tanır', () => {
    for (const w of ['kitaplarımızdan', 'gidiyorduk', 'iskeleden', 'kaçırayım', 'yetiştim', 'değil']) expect(checkWord(sp, w)).toBe(true);
  });
  it('büyük harfli satırlarda Türkçe harf kurallarıyla denetler', () => {
    for (const w of ['İSKELESİ', 'KAYIĞI', 'ŞAFAK', 'GECE', 'Kadıköy', 'KADIKÖY']) expect(checkWord(sp, w)).toBe(true);
  });
  it('kesmeli özel adlar ve sayılar', () => {
    expect(checkWord(sp, "Ankara'dan")).toBe(true);
    expect(checkWord(sp, '1990')).toBe(true);
  });
  it('hataları yakalar', () => {
    for (const w of ['gidyorum', 'kitapp', 'degil', 'cok']) expect(checkWord(sp, w)).toBe(false);
  });
  it('Türkçe karakter eksikliğini önce önerir, yazım biçimini korur', () => {
    expect(suggestWord(sp, 'cok')[0]).toBe('çok');
    expect(suggestWord(sp, 'degil')[0]).toBe('değil');
    expect(suggestWord(sp, 'gidiyrum')).toContain('gidiyorum');
    expect(suggestWord(sp, 'GİDİYRUM')).toContain('GİDİYORUM');
    // nspell'in Türkçe olmayan büyük harfli önerileri elenir
    expect(suggestWord(sp, 'gidyorum').some((s) => s === s.toUpperCase())).toBe(false);
  });
  it('kelimeleri metinden ayırır', () => {
    const words = [...'HİKMET’in avucunda — bir çay bardağı, 2 kez.'.matchAll(WORD_RE)].map((m) => m[0]);
    expect(words).toEqual(['HİKMET’in', 'avucunda', 'bir', 'çay', 'bardağı', 'kez']);
  });
});

describe('yazma hedefleri', () => {
  const t = '2026-10-03';
  it('seri: bugün tamamlanmadıysa dünden geriye sayar', () => {
    const h = [
      { day: '2026-09-29', words: 1200 },
      { day: '2026-09-30', words: 300 },
      { day: '2026-10-01', words: 1000 },
      { day: '2026-10-02', words: 1500 },
      { day: t, words: 100 },
    ];
    expect(streakOf(h, 1000, t)).toEqual({ current: 2, longest: 2, todayDone: false });
    expect(streakOf([...h.slice(0, 4), { day: t, words: 1000 }], 1000, t)).toEqual({ current: 3, longest: 3, todayDone: true });
  });
  it('ay ve yıl geçişleri', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    const days = lastDays([{ day: t, words: 5 }], 3, t);
    expect(days.map((d) => d.words)).toEqual([0, 0, 5]);
    expect(formatClock(65_000)).toBe('1:05');
  });
});

describe('oyuncu sayfaları', () => {
  const model = buildModel(sampleProject().script.doc);
  const blocks = numberScenes(model.blocks);
  const opts: LayoutOptions = { paper: 'a4', lang: 'tr', sceneNumbers: true, headingSpace: 2 };

  it('karakterin sahnelerini seçer, numaraları korur', () => {
    const sc = scenesWith(model.scenes, 'KAPTAN RIZA');
    expect(sc.map((s) => s.number)).toEqual(['3']);
    const out = sidesBlocks(blocks, model.scenes, sc.map((s) => s.sid), { newPagePerScene: false });
    expect(out[0].el).toBe('sceneHeading');
    expect(out[0].sceneNo).toBe('3');
  });

  it('replikleri vurgular (yalnız o karakterin satırları)', () => {
    const pages = paginate(blocks, { ...opts, highlight: 'NERMİN' });
    const lines = pages.flatMap((p) => p.lines).filter(Boolean);
    const hl = lines.filter((l) => l!.hl);
    expect(hl.length).toBeGreaterThan(0);
    expect(hl.some((l) => l!.el === 'character' && l!.runs.map((r) => r.text).join('').startsWith('NERMİN'))).toBe(true);
    expect(lines.filter((l) => l!.el === 'action').every((l) => !l!.hl)).toBe(true);
  });

  it('replik dökümü ipucu satırlarıyla', () => {
    const sp = speechesOf(blocks, 'NERMİN');
    expect(sp.length).toBeGreaterThan(1);
    expect(sp[0].cue).toBeNull();
    expect(sp[1].cue?.name).toBe('HİKMET');
    const list = lineListBlocks(sp, 'tr');
    expect(list.some((b) => b.el === 'character' && b.runs[0].text.includes('(İPUCU)'))).toBe(true);
  });

  it('ipucu son cümleyi alır', () => {
    expect(cueText('İlk cümle. Son cümle burada.')).toBe('…Son cümle burada.');
    expect(cueText('Tek cümle')).toBe('Tek cümle');
  });

  it('PDF üretir', async () => {
    const dir = 'src/assets/fonts/';
    const fonts = {
      regular: new Uint8Array(readFileSync(dir + 'CourierPrime_400Regular.ttf')),
      bold: new Uint8Array(readFileSync(dir + 'CourierPrime_700Bold.ttf')),
      italic: new Uint8Array(readFileSync(dir + 'CourierPrime_400Regular_Italic.ttf')),
      boldItalic: new Uint8Array(readFileSync(dir + 'CourierPrime_700Bold_Italic.ttf')),
    };
    const sides = sidesBlocks(blocks, model.scenes, scenesWith(model.scenes, 'NERMİN').map((s) => s.sid), { newPagePerScene: true });
    const a = await renderPdf(sides, { ...opts, highlight: 'NERMİN', header: 'NERMİN — oyuncu sayfaları' }, null, fonts);
    const list: ScriptBlock[] = lineListBlocks(speechesOf(blocks, 'NERMİN'), 'tr');
    const b = await renderPdf(list, { ...opts, highlight: 'NERMİN', header: 'NERMİN — replik dökümü' }, null, fonts);
    expect(a.pages).toBeGreaterThanOrEqual(2);
    expect(b.pages).toBeGreaterThanOrEqual(1);
    mkdirSync('/tmp/claude-0/sides', { recursive: true });
    writeFileSync('/tmp/claude-0/sides/sides.pdf', a.bytes);
    writeFileSync('/tmp/claude-0/sides/lines.pdf', b.bytes);
  });
});

// blocksFromJson kullanılmadığında uyarı vermesin
void blocksFromJson;

describe('yazım denetimi: şapkalı harfler', () => {
  it('rüzgâr, kâğıt, Rüzgâr', () => {
    const sp = nspell(readFileSync('public/dict/tr.aff', 'utf8'), readFileSync('public/dict/tr.dic', 'utf8'));
    for (const w of ['rüzgâr', 'Rüzgâr', 'kâğıt', 'hikâye']) expect(checkWord(sp, w)).toBe(true);
  }, 30000);
});

describe('yazım denetimi: yabancı özel adlar', () => {
  it("kesmeli bilinmeyen özel ad doğru sayılır, küçük harfli olan sayılmaz", () => {
    const sp = nspell(readFileSync('public/dict/tr.aff', 'utf8'), readFileSync('public/dict/tr.dic', 'utf8'));
    expect(checkWord(sp, "DANNY'NİN")).toBe(true);
    expect(checkWord(sp, "Danny'nin")).toBe(true);
    expect(checkWord(sp, "danny'nin")).toBe(false);
  }, 30000);
});
