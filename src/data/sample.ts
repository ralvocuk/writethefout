import type { El } from '../script/elements';
import type { CharacterProfile, DocNode, SceneMeta } from './types';

type Inline = string | { t: string; m: ('note' | 'omit' | 'bold' | 'italic' | 'underline')[] } | { tag: string; t: string };
type L = [El, ...Inline[]] | [El, Inline[], Record<string, unknown>];

function line(el: El, parts: Inline[], attrs: Record<string, unknown> = {}) {
  const content = parts
    .filter((p) => (typeof p === 'string' ? p : p.t))
    .map((p) =>
      typeof p === 'string'
        ? { type: 'text', text: p }
        : 'tag' in p
          ? { type: 'text', text: p.t, marks: [{ type: 'tag', attrs: { cat: p.tag } }] }
          : { type: 'text', text: p.t, marks: p.m.map((type) => ({ type })) },
    );
  return { type: 'line', attrs: { el, ...attrs }, content };
}

export const docJson = (lines: ReturnType<typeof line>[]) => JSON.stringify({ type: 'doc', content: lines });

export const emptyScript = (sid: string) => docJson([line('sceneHeading', [], { sid })]);

const mk = (spec: L[]) =>
  spec.map((s) => {
    const [el, ...rest] = s;
    if (rest.length === 2 && Array.isArray(rest[0]) && typeof rest[1] === 'object' && !Array.isArray(rest[1]) && !('t' in (rest[1] as object)))
      return line(el, rest[0] as Inline[], rest[1] as Record<string, unknown>);
    return line(el, rest as Inline[]);
  });

/** Uygulamayı tanıtmak için yazılmış özgün kısa bir senaryo. */
export function sampleProject(): {
  title: string;
  script: DocNode;
  scenes: SceneMeta[];
  characters: CharacterProfile[];
  notes: DocNode[];
} {
  const doc = docJson(
    mk([
      ['section', ['Birinci Perde'], {}],
      ['sceneHeading', ['Dış. Kadıköy iskelesi - Gece'], { sid: 's1' }],
      ['action', 'Son vapur iskeleden ayrılıyor. NERMİN (40), turnikeye yürüyor; acele etmiyor. Elinde ', { tag: 'prop', t: 'rulo halinde bir harita' }, '.'],
      ['action', 'Dalgakıranın ucunda HİKMET (70) oturuyor, iki avucunun arasında ', { tag: 'prop', t: 'bir çay bardağı' }, '.'],
      ['character', 'Nermin'],
      ['dialogue', 'Hikmet Amca?'],
      ['character', 'Hikmet'],
      ['parenthetical', '(gülümser)'],
      ['dialogue', 'Kaptanın kızı. Sen de mi kaçırdın?', { t: ' Burada daha sıcak bir an olmalı.', m: ['note'] }],
      ['character', 'Nermin'],
      ['dialogue', 'Yirmi yıldır her vapura yetiştim. Bir kere de kaçırayım dedim.'],
      ['transition', 'Kesme:'],

      ['sceneHeading', ['İç. Hikmet’in kayığı - Gece'], { sid: 's2' }],
      ['action', 'Kayık, Nermin’in hatırladığından küçük. Hikmet, ', { tag: 'prop', t: 'muşambaya sarılı bir paket' }, ' uzatıyor.'],
      ['character', 'Hikmet'],
      ['dialogue', 'Bunu sana yıllar önce vermem gerekiyordu.'],
      ['character', 'Nermin'],
      ['dialogue', 'Babamın seyir defteri.'],
      ['character', ['Hikmet'], { dual: true }],
      ['dialogue', 'Son seferinin.'],
      ['action', { t: 'Nermin defteri açıyor; sayfalar tuzdan kabarmış.', m: ['omit'] }],
      ['action', 'Nermin defteri açmıyor. Göğsüne bastırıyor.'],

      ['section', ['İkinci Perde'], {}],
      ['sceneHeading', ['Dış. Fener adası - Şafak'], { sid: 's3' }],
      ['action', 'Terk edilmiş fener. Rüzgâr ', { tag: 'sfx', t: 'kırık camlardan ıslık çalıyor' }, '.'],
      ['centered', 'ON İKİ YIL ÖNCE'],
      ['action', 'KAPTAN RIZA (55) fenerin kapısını zorluyor.'],
      ['character', 'Kaptan Rıza'],
      ['lyrics', 'Deniz ne der, rüzgâr ne der…'],
      ['transition', 'Kararma.'],
    ]),
  );
  return {
    title: 'Fener Bekçisi',
    script: { id: 'script', kind: 'script', title: 'Senaryo', order: 0, doc, plainText: '', wordCount: 0, updatedAt: Date.now() },
    scenes: [
      { sid: 's1', synopsis: 'Nermin son vapuru kaçırır; iskelede babasının eski meslektaşı Hikmet ile karşılaşır.', color: 'indigo', status: 'revised', storyDay: '1. gün' },
      { sid: 's2', synopsis: 'Hikmet, kaptanın son seferine ait seyir defterini Nermin’e verir.', color: 'earth', status: 'draft', storyDay: '1. gün' },
      { sid: 's3', synopsis: 'Defterdeki koordinatlar Nermin’i terk edilmiş fener adasına götürür.', color: 'olive', status: 'draft', storyDay: '2. gün' },
    ],
    characters: [
      { name: 'NERMİN', description: 'Kırk yaşında harita restoratörü. Babasının neden o rotayı seçtiğini anlamak istiyor.', color: 'indigo' },
      { name: 'HİKMET', description: 'Kaptanın eski tayfası. Yıllardır bir sırrı taşıyor.', color: 'earth' },
    ],
    notes: [
      {
        id: 'n1',
        kind: 'note',
        title: 'Ton ve tema',
        order: 0,
        doc: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Sessizlik konuşmadan daha çok şey anlatmalı. Diyaloglar kısa, aksiyon satırları görsel.' }] },
          ],
        }),
        plainText: '',
        wordCount: 0,
        updatedAt: Date.now(),
      },
    ],
  };
}
