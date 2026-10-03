// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import {
  linesPerPage,
  numberScenes,
  paginate,
  sceneSpans,
  wrapRuns,
  type LayoutOptions,
  type PLine,
} from '../src/export/layout';
import { blocksFromJson, type ScriptBlock } from '../src/script/blocks';
import { buildModel, moveScene, parseHeading } from '../src/script/model';
import { parseFountain, toFountain } from '../src/export/fountain';
import { parseFdx, toFdx } from '../src/export/fdx';
import { importFile } from '../src/export/importers';
import { renderPdf } from '../src/export/pdf';
import { sampleProject } from '../src/data/sample';
import type { El } from '../src/script/elements';

const B = (el: El, text: string, extra: Partial<ScriptBlock> = {}): ScriptBlock => ({ el, runs: [{ text }], ...extra });
const opts: LayoutOptions = { paper: 'letter', lang: 'tr', sceneNumbers: true, headingSpace: 2 };
const txt = (l: PLine | null | undefined) => (l ? l.runs.map((r) => r.text).join('') : '');
const filler = (n: number) => Array.from({ length: n }, (_, i) => B('action', `Kısa aksiyon ${i}.`));

describe('satır kırma', () => {
  it('kelime sınırında böler', () => {
    const lines = wrapRuns([{ text: 'bir iki üç dört beş altı yedi sekiz dokuz on' }], 10);
    expect(lines.map((l) => l.map((r) => r.text).join(''))).toEqual(['bir iki üç', 'dört beş', 'altı yedi', 'sekiz', 'dokuz on']);
  });
});

describe('sayfalama', () => {
  it('Letter 54, A4 58 satır', () => {
    expect(linesPerPage('letter')).toBe(54);
    expect(linesPerPage('a4')).toBe(58);
  });
  it('sahne başlığı sayfa dibinde yalnız kalmaz', () => {
    const pages = paginate([...filler(26), B('sceneHeading', 'İç. Ev - Gece'), B('action', 'Biri girer.')], opts);
    expect(txt(pages[1].lines[0])).toBe('İÇ. EV - GECE');
  });
  it('uzun diyalog: (DEVAM EDİYOR) ve AD (DEVAM)', () => {
    const long = 'Bu cümle uzun bir konuşmanın parçasıdır ve birkaç satır sürer. '.repeat(8);
    const pages = paginate([...filler(22), B('character', 'Nermin'), B('dialogue', long)], opts);
    const p1 = pages[0].lines.filter(Boolean) as PLine[];
    expect(txt(p1.at(-1))).toBe('(DEVAM EDİYOR)');
    expect(txt(pages[1].lines[0])).toBe('NERMİN (DEVAM)');
    expect(pages.every((p) => p.lines.length <= 54)).toBe(true);
  });
  it('İngilizce etiketler', () => {
    const long = 'This sentence is part of a long speech and wraps. '.repeat(8);
    const pages = paginate([...filler(22), B('character', 'Mike'), B('dialogue', long)], { ...opts, lang: 'en' });
    expect(txt(pages[1].lines[0])).toBe("MIKE (CONT'D)");
  });
  it('zorunlu sayfa sonu yeni sayfa açar, bölüm basılmaz', () => {
    const pages = paginate([B('section', 'Perde'), B('action', 'Bir.'), B('pageBreak', ''), B('action', 'İki.')], opts);
    expect(pages).toHaveLength(2);
    expect(txt(pages[0].lines[0])).toBe('Bir.');
    expect(txt(pages[1].lines[0])).toBe('İki.');
  });
  it('çift diyalog iki sütun yan yana', () => {
    const pages = paginate(
      [B('character', 'Ali'), B('dialogue', 'Evet.'), B('character', 'Ayşe ^', { dual: true }), B('dialogue', 'Hayır.')],
      opts,
    );
    const first = pages[0].lines[0]!;
    expect(txt(first)).toBe('ALİ');
    expect(txt(first.pair)).toBe('AYŞE');
    expect(first.pair!.x).toBeGreaterThan(first.x);
  });
  it('ortalı metin ortalanır, şarkı italik', () => {
    const pages = paginate([B('centered', 'SON'), B('lyrics', 'La la')], opts);
    expect(pages[0].lines[0]!.align).toBe('center');
    expect(pages[0].lines[2]!.runs[0].i).toBe(true);
  });
  it('otomatik (DEVAM): aynı karakter aksiyondan sonra sürdürürse', () => {
    const pages = paginate(
      [B('character', 'Ali'), B('dialogue', 'Bir.'), B('action', 'Durur.'), B('character', 'Ali'), B('dialogue', 'İki.')],
      { ...opts, autoContd: true },
    );
    const names = pages[0].lines.filter((l) => l?.el === 'character').map(txt);
    expect(names).toEqual(['ALİ', 'ALİ (DEVAM)']);
  });
  it('revizyonlu satır işaretlenir', () => {
    const pages = paginate([{ el: 'action', runs: [{ text: 'Eski ' }, { text: 'yeni', rev: 2 }] }], opts);
    expect(pages[0].lines[0]!.rev).toBe(2);
  });
});

describe('sahne numaraları', () => {
  it('kilit yoksa 1, 2, 3', () => {
    const b = numberScenes([B('sceneHeading', 'A'), B('sceneHeading', 'B')]);
    expect(b.map((x) => x.sceneNo)).toEqual(['1', '2']);
  });
  it('kilitli numaralar korunur, araya girenler 1A, 1B; öncekiler A1', () => {
    const b = numberScenes([
      B('sceneHeading', 'Önce'),
      B('sceneHeading', 'A', { num: '1' }),
      B('sceneHeading', 'Yeni'),
      B('sceneHeading', 'Yeni 2'),
      B('sceneHeading', 'B', { num: '2' }),
    ]);
    expect(b.map((x) => x.sceneNo)).toEqual(['A1', '1', '1A', '1B', '2']);
  });
});

describe('senaryo modeli', () => {
  const sample = sampleProject();
  const m = buildModel(sample.script.doc, 'a4');
  it('sahneleri, bölümleri ve karakterleri çıkarır', () => {
    expect(m.scenes.map((s) => s.sid)).toEqual(['s1', 's2', 's3']);
    expect(m.sections.map((s) => s.title)).toEqual(['Birinci Perde', 'İkinci Perde']);
    expect(m.scenes[2].section).toBe('İkinci Perde');
    expect(m.characters.slice(0, 2).map((c) => c.name).sort()).toEqual(['HİKMET', 'NERMİN']);
    expect(m.characters.find((c) => c.name === 'NERMİN')!.lines).toBe(3);
    expect(m.scenes[0].characters).toEqual(['NERMİN', 'HİKMET']);
    expect(m.scenes[0].notes.join(' ')).toContain('sıcak bir an');
    expect(m.scenes[0].tags.map((t) => t.cat)).toEqual(['prop', 'prop']);
  });
  it('kapalı metin basılmaz ve sayılmaz', () => {
    expect(m.blocks.some((b) => b.runs.some((r) => r.text.includes('tuzdan')))).toBe(false);
  });
  it('başlığı çözer', () => {
    expect(parseHeading('Dış. Kadıköy iskelesi - Gece')).toEqual({ intExt: 'DIŞ', location: 'KADIKÖY İSKELESİ', time: 'GECE' });
    expect(parseHeading('INT. HOUSE - DAY')).toEqual({ intExt: 'İÇ', location: 'HOUSE', time: 'DAY' });
  });
  it('sahne taşır', () => {
    const doc = JSON.parse(sample.script.doc!);
    const moved = moveScene(doc, 's3', 's1');
    const order = buildModel(moved, 'a4').scenes.map((s) => s.sid);
    expect(order).toEqual(['s3', 's1', 's2']);
  });
  it('sahne uzunlukları (1/8 sayfa)', () => {
    const blocks = numberScenes(blocksFromJson(sample.script.doc));
    const spans = sceneSpans(paginate(blocks, { ...opts, paper: 'a4' }), 'a4');
    expect(spans.map((s) => s.sid)).toEqual(['s1', 's2', 's3']);
    expect(spans.every((s) => s.eighths >= 1)).toBe(true);
  });
});

describe('Fountain', () => {
  it('gidiş-dönüş: elemanlar, notlar, kapalı metin, çift diyalog korunur', () => {
    const sample = sampleProject();
    const doc = JSON.parse(sample.script.doc!);
    const f = toFountain(doc, { title: 'Fener Bekçisi', author: 'Ralvo', contact: '' }, 'tr');
    expect(f).toContain('.DIŞ. KADIKÖY İSKELESİ - GECE');
    expect(f).toContain('[[Burada daha sıcak bir an olmalı.]]');
    expect(f).toContain('/*Nermin defteri açıyor');
    expect(f).toContain('@HİKMET ^');
    expect(f).toContain('> ON İKİ YIL ÖNCE <');
    expect(f).toContain('~Deniz ne der');
    expect(f).toContain('# İkinci Perde');
    const back = parseFountain(f);
    expect(back.title.title).toBe('Fener Bekçisi');
    expect(back.doc.content.map((l) => l.attrs.el)).toEqual(doc.content.map((l: { attrs: { el: string } }) => l.attrs.el));
    const dual = back.doc.content.find((l) => l.attrs.dual);
    expect(dual?.attrs.el).toBe('character');
    const note = back.doc.content.flatMap((l) => l.content).find((c) => c.marks?.some((m) => m.type === 'note'));
    expect(note?.text).toBe('Burada daha sıcak bir an olmalı.');
    const omit = back.doc.content.flatMap((l) => l.content).find((c) => c.marks?.some((m) => m.type === 'omit'));
    expect(omit?.text).toContain('tuzdan');
  });

  it('standart İngilizce Fountain okunur', () => {
    const src = `Title: Test

INT. KITCHEN - DAY #4#

Anna pours *coffee*.

ANNA
(quietly)
Good morning.

BOB ^
Hi.

CUT TO:

===

EXT. STREET - NIGHT
`;
    const { doc } = parseFountain(src);
    expect(doc.content.map((l) => l.attrs.el)).toEqual([
      'sceneHeading', 'action', 'character', 'parenthetical', 'dialogue', 'character', 'dialogue', 'transition', 'pageBreak', 'sceneHeading',
    ]);
    expect(doc.content[0].attrs.num).toBe('4');
    expect(doc.content[5].attrs.dual).toBe(true);
    expect(doc.content[1].content.find((c) => c.marks?.some((m) => m.type === 'italic'))?.text).toBe('coffee');
  });
});

describe('Final Draft', () => {
  it('dışa aktarır: kaçış, türler, çift diyalog, sayfa sonu', () => {
    const blocks = numberScenes([
      B('sceneHeading', 'İç. A & B'),
      B('character', 'Elif'),
      B('dialogue', 'Evet.'),
      B('character', 'Can', { dual: true }),
      B('dialogue', 'Hayır.'),
      B('pageBreak', ''),
      B('centered', 'SON'),
    ]);
    const x = toFdx(blocks, null, 'tr', true);
    expect(x).toContain('<Paragraph Type="Scene Heading" Number="1"><Text>İÇ. A &amp; B</Text></Paragraph>');
    expect(x).toContain('<DualDialogue>');
    expect(x).toContain('Alignment="Center" StartsNewPage="Yes"');
  });
  it('içe aktarır ve gidiş-dönüş tutarlı', () => {
    const blocks = numberScenes([B('sceneHeading', 'İç. Ev'), B('character', 'Elif'), B('dialogue', 'Evet.'), B('character', 'Can', { dual: true }), B('dialogue', 'Hayır.')]);
    const { doc } = parseFdx(toFdx(blocks, null, 'tr', true));
    expect(doc.content.map((l) => l.attrs.el)).toEqual(['sceneHeading', 'character', 'dialogue', 'character', 'dialogue']);
    expect(doc.content[0].attrs.num).toBe('1');
    expect(doc.content[3].attrs.dual).toBe(true);
  });
});

describe('diğer biçimler', () => {
  it('Highland (zip içi Fountain)', () => {
    const zip = zipSync({ 'Senaryo.textbundle/text.fountain': strToU8('INT. ROOM - DAY\n\nHello.\n') });
    const r = importFile('test.highland', zip);
    expect(r.doc.content.map((l) => l.attrs.el)).toEqual(['sceneHeading', 'action']);
  });
  it('Fade In (OSF)', () => {
    const xml = `<?xml version="1.0"?><document><paragraphs>
      <para><style basestyle="Scene Heading"/><text>INT. ROOM - DAY</text></para>
      <para><style basestyle="Character"/><text>ANNA</text></para>
      <para><style basestyle="Dialogue"/><text bold="1">Hi.</text></para></paragraphs></document>`;
    const r = importFile('x.fadein', zipSync({ 'document.xml': strToU8(xml) }));
    expect(r.doc.content.map((l) => l.attrs.el)).toEqual(['sceneHeading', 'character', 'dialogue']);
    expect(r.doc.content[2].content[0].marks?.[0].type).toBe('bold');
  });
  it('Celtx (HTML)', () => {
    const html = `<html><body><p class="sceneheading">INT. ROOM</p><p class="character">ANNA</p><p class="dialog">Hi.</p><p class="transition">CUT TO:</p></body></html>`;
    const r = importFile('x.celtx', zipSync({ 'script-1.html': strToU8(html) }));
    expect(r.doc.content.map((l) => l.attrs.el)).toEqual(['sceneHeading', 'character', 'dialogue', 'transition']);
  });
});

describe('PDF', () => {
  it('Türkçe, çok sayfalı, revizyonlu PDF üretir', async () => {
    const dir = 'src/assets/fonts/';
    const fonts = {
      regular: new Uint8Array(readFileSync(dir + 'CourierPrime_400Regular.ttf')),
      bold: new Uint8Array(readFileSync(dir + 'CourierPrime_700Bold.ttf')),
      italic: new Uint8Array(readFileSync(dir + 'CourierPrime_400Regular_Italic.ttf')),
      boldItalic: new Uint8Array(readFileSync(dir + 'CourierPrime_700Bold_Italic.ttf')),
    };
    const sample = sampleProject();
    const long = 'Bu cümle uzun bir konuşmanın parçasıdır ve birkaç satır sürer. '.repeat(8);
    const blocks = numberScenes([
      ...blocksFromJson(sample.script.doc),
      ...filler(14),
      B('character', 'Nermin'),
      B('dialogue', long),
      { el: 'action', runs: [{ text: 'Revize edilmiş ' }, { text: 'yeni satır', rev: 1 }, { text: '.' }] },
    ]);
    const { bytes, pages } = await renderPdf(
      blocks,
      { ...opts, paper: 'a4', autoContd: true, revision: { label: 'Mavi revizyon', date: '03.10.2026' } },
      { title: 'Fener Bekçisi', author: 'Ralvo', contact: 'ralvo@örnek.com' },
      fonts,
    );
    expect(pages).toBeGreaterThanOrEqual(2);
    mkdirSync('/tmp/claude-0/pdf2', { recursive: true });
    writeFileSync('/tmp/claude-0/pdf2/ornek.pdf', bytes);
  });
});

describe('Final Draft revizyonları', () => {
  it('revizyonlu metin RevisionID ile yazılır ve geri okunur', () => {
    const blocks = numberScenes([{ el: 'action' as const, runs: [{ text: 'Eski ' }, { text: 'yeni', rev: 2 }] }]);
    const x = toFdx(blocks, null, 'tr', false);
    expect(x).toContain('<Text RevisionID="2">yeni</Text>');
    expect(x).toContain('<Revisions ActiveSet="2"');
    const { doc } = parseFdx(x);
    const rev = doc.content[0].content.find((c) => c.marks?.some((m) => m.type === 'rev'));
    expect(rev?.text).toBe('yeni');
  });
});

describe('revizyonda silme', () => {
  it('silinmeye aday metin basılmaz ama satır yıldız alır', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'line', attrs: { el: 'action' }, content: [{ type: 'text', text: 'Kalan ' }, { type: 'text', text: 'silinecek', marks: [{ type: 'del', attrs: { gen: 3 } }] }] },
        { type: 'line', attrs: { el: 'action' }, content: [{ type: 'text', text: 'Tümü gidiyor', marks: [{ type: 'del', attrs: { gen: 1 } }] }] },
        { type: 'line', attrs: { el: 'action' }, content: [{ type: 'text', text: 'Sonraki satır' }] },
      ],
    };
    const blocks = blocksFromJson(doc);
    const pages = paginate(blocks, opts);
    const lines = pages[0].lines.filter(Boolean) as PLine[];
    expect(lines.map(txt)).toEqual(['Kalan ', 'Sonraki satır']);
    expect(lines[0].rev).toBe(3);
    expect(lines[1].rev).toBe(1);
  });
});
