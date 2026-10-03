import { describe, expect, it } from 'vitest';
import { parseDocument, serializeDocument, emptyTitle, DEFAULT_SETTINGS, type ScriptDocument } from '../src/script/document';
import { parseFountain } from '../src/export/fountain';
import { lineText, type JDoc } from '../src/script/json';
import { sampleProject } from '../src/data/sample';

let n = 0;
const sid = () => `x${++n}`;

const T = (text: string, marks?: { type: string; attrs?: Record<string, unknown> }[]) =>
  marks ? { type: 'text' as const, text, marks } : { type: 'text' as const, text };

function richDoc(): ScriptDocument {
  const doc: JDoc = {
    type: 'doc',
    content: [
      { type: 'line', attrs: { el: 'section' }, content: [T('Birinci Perde')] },
      { type: 'line', attrs: { el: 'sceneHeading', sid: 'a', num: '1' }, content: [T('Dış. iskele - Gece')] },
      {
        type: 'line',
        attrs: { el: 'action' },
        content: [T('Elinde '), T('bir harita', [{ type: 'tag', attrs: { cat: 'prop' } }]), T(' var. '), T('yeni cümle', [{ type: 'rev', attrs: { gen: 2 } }]), T(' eski', [{ type: 'del', attrs: { gen: 2 } }])],
      },
      { type: 'line', attrs: { el: 'action' }, content: [T('İkinci paragraf'), { type: 'hardBreak' }, { type: 'hardBreak' }, T('boş satırdan sonra.')] },
      { type: 'line', attrs: { el: 'action' }, content: [T('TAMAMI BÜYÜK HARF')] },
      { type: 'line', attrs: { el: 'action' }, content: [T('#etiket gibi başlayan aksiyon')] },
      { type: 'line', attrs: { el: 'character' }, content: [T('Nermin')] },
      { type: 'line', attrs: { el: 'parenthetical' }, content: [T('(gülümser)')] },
      { type: 'line', attrs: { el: 'dialogue' }, content: [T('Merhaba '), T('dünya', [{ type: 'bold' }]), T(' '), T('not burada', [{ type: 'note' }])] },
      { type: 'line', attrs: { el: 'character', dual: true }, content: [T('Hikmet')] },
      { type: 'line', attrs: { el: 'dialogue' }, content: [T('Selam.')] },
      { type: 'line', attrs: { el: 'action' }, content: [T('Kapalı metin', [{ type: 'omit' }])] },
      { type: 'line', attrs: { el: 'centered' }, content: [T('SON')] },
      { type: 'line', attrs: { el: 'transition' }, content: [T('Kesme:')] },
      { type: 'line', attrs: { el: 'pageBreak' }, content: [] },
      { type: 'line', attrs: { el: 'sceneHeading', sid: 'b' }, content: [T('INT. HOUSE - DAY')] },
      { type: 'line', attrs: { el: 'character' }, content: [T('MIKE')] },
      { type: 'line', attrs: { el: 'lyrics' }, content: [T('La la la')] },
    ],
  };
  return {
    title: { ...emptyTitle(), title: 'Fener Bekçisi', author: 'Ralvo', contact: 'a@b.c\n0555', source: 'Bir romandan', draftDate: '3 Ekim 2026' },
    settings: { ...DEFAULT_SETTINGS, revisionOn: true, revisionGen: 2 },
    doc,
    scenes: {
      a: { sid: 'a', synopsis: 'Nermin vapuru kaçırır.', color: 'indigo', status: 'revised', storyDay: '1. gün' },
      b: { sid: 'b', synopsis: '', color: 'olive', status: 'draft', storyDay: '' },
    },
    characters: { NERMİN: { name: 'NERMİN', description: 'Harita restoratörü', color: 'indigo' } },
    notes: [{ id: 'n1', title: 'Ton', doc: '{"type":"doc","content":[]}' }],
  };
}

const norm = (d: JDoc) => JSON.stringify(d.content.map((l) => ({ el: l.attrs.el, sid: l.attrs.sid ?? null, num: l.attrs.num ?? null, dual: !!l.attrs.dual, c: l.content })));

describe('belge biçimi', () => {
  it('kayıpsız gidiş-dönüş: metin, işaretler, sahne bilgileri, karakterler, notlar, başlık', () => {
    const src = richDoc();
    const file = serializeDocument(src);
    const back = parseDocument(file, sid);
    expect(norm(back.doc)).toBe(norm(src.doc));
    expect(back.scenes.a).toEqual(src.scenes.a);
    expect(back.scenes.b.color).toBe('olive');
    expect(back.characters.NERMİN.description).toBe('Harita restoratörü');
    expect(back.notes).toEqual(src.notes);
    expect(back.title.source).toBe('Bir romandan');
    expect(back.title.contact).toBe('a@b.c\n0555');
    expect(back.settings.revisionGen).toBe(2);
  });

  it('ikinci kez kaydetmek aynı dosyayı üretir (kararlı)', () => {
    const f1 = serializeDocument(richDoc());
    const f2 = serializeDocument(parseDocument(f1, sid));
    expect(f2).toBe(f1);
  });

  it('başka programlar için geçerli Fountain: meta veri boneyard içinde, elemanlar doğru', () => {
    const file = serializeDocument(richDoc());
    expect(file).toMatch(/\/\* writetheFout\n\{.*\}\n\*\/\n$/s);
    expect(file).toContain('.Dış. iskele - Gece #1#');
    expect(file).toContain('= Nermin vapuru kaçırır.');
    expect(file).toContain('@Nermin');
    expect(file).toContain('@Hikmet ^');
    expect(file).toContain('!TAMAMI BÜYÜK HARF');
    expect(file).toContain('!#etiket');
    expect(file).toContain('İkinci paragraf\n  \nboş satırdan sonra.');
    // meta veriyi bilmeyen bir okuyucu (boneyard'ı kapalı metin sayar) elemanları yine doğru görür
    const plain = parseFountain(file.replace(/\n\/\* writetheFout[\s\S]*$/, ''));
    expect(plain.doc.content.map((l) => l.attrs.el)).toEqual(richDoc().doc.content.map((l) => l.attrs.el));
  });

  it('dosya dışarıda değiştirilirse yalnız o satırın işaretleri düşer', () => {
    const file = serializeDocument(richDoc()).replace('Elinde bir harita var.', 'Elinde bir pusula var.');
    const back = parseDocument(file, sid);
    const action = back.doc.content[2];
    expect(lineText(action)).toContain('pusula');
    expect(JSON.stringify(action)).not.toContain('"tag"');
    // diğer satırların işaretleri ve sahne bilgileri yerinde
    expect(back.scenes.a.color).toBe('indigo');
  });

  it('dışarıda satır eklense de işaretler kaydırılarak bulunur', () => {
    const file = serializeDocument(richDoc()).replace('Birinci Perde\n', 'Birinci Perde\n\nYeni eklenmiş bir aksiyon satırı.\n');
    const back = parseDocument(file, sid);
    const withTag = back.doc.content.find((l) => JSON.stringify(l).includes('"tag"'));
    expect(withTag && lineText(withTag)).toContain('harita');
  });

  it('meta verisi olmayan sıradan bir Fountain dosyası açılır', () => {
    const back = parseDocument('Title: Test\nAuthor: X\n\nINT. ROOM - DAY\n\n= Kısa özet\n\nHello.\n', sid);
    expect(back.title.title).toBe('Test');
    expect(back.doc.content.map((l) => l.attrs.el)).toEqual(['sceneHeading', 'action']);
    const s = back.doc.content[0].attrs.sid!;
    expect(back.scenes[s].synopsis).toBe('Kısa özet');
  });

  it('örnek senaryo kayıpsız', () => {
    const s = sampleProject();
    const d: ScriptDocument = {
      title: { ...emptyTitle(), title: s.title },
      settings: DEFAULT_SETTINGS,
      doc: JSON.parse(s.script.doc!),
      scenes: Object.fromEntries(s.scenes.map((x) => [x.sid, x])),
      characters: Object.fromEntries(s.characters.map((c) => [c.name, c])),
      notes: [],
    };
    const back = parseDocument(serializeDocument(d), sid);
    expect(norm(back.doc)).toBe(norm(d.doc));
    expect(back.scenes.s3.synopsis).toContain('koordinatlar');
  });
});

describe('editör JSON’u', () => {
  it('içeriği olmayan boş satırlarla kaydeder (Kaydet hatası)', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'line', attrs: { el: 'sceneHeading', sid: 'a1', num: null, dual: false }, content: [{ type: 'text', text: 'İÇ. EV - GECE' }] },
        { type: 'line', attrs: { el: 'action', sid: null, num: null, dual: false } },
        { type: 'line', attrs: { el: 'sceneHeading', sid: 'a2', num: null, dual: false } },
      ],
    } as unknown as JDoc;
    const file = serializeDocument({ title: emptyTitle(), settings: { ...DEFAULT_SETTINGS }, doc, scenes: {}, characters: {}, notes: [] });
    expect(file).toContain('İÇ. EV - GECE');
    const back = parseDocument(file, () => 'x');
    expect(lineText(back.doc.content[0])).toBe('İÇ. EV - GECE');
  });
});
