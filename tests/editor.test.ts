// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextSelection } from '@tiptap/pm/state';
import {
  Line,
  NoteMark,
  OmitMark,
  RevMark,
  DelMark,
  ScreenplayDocument,
  ScreenplayKeys,
  TagMark,
  detectElement,
  suggest,
  baseName,
  toggleDual,
} from '../src/editor/screenplay';
import { Search, findMatches } from '../src/editor/search';
import { countWords, type El } from '../src/script/elements';
import { docJson } from '../src/data/sample';

const L = (el: El, text = '', attrs: Record<string, unknown> = {}) => ({
  type: 'line',
  attrs: { el, ...attrs },
  content: text ? [{ type: 'text', text }] : [],
});

describe('kelime sayımı', () => {
  it('Türkçe ekleri ve kesme işaretini tek kelime sayar', () => {
    expect(countWords("Ayşe'nin kedisi yarı-açık kapıdan çıktı.")).toBe(5);
  });
});

describe('eleman algılama', () => {
  it('sahne başlıkları (Türkçe ve İngilizce büyük harf kuralı)', () => {
    expect(detectElement('İÇ. MUTFAK - GECE', 'action', null)).toBe('sceneHeading');
    expect(detectElement('dış. sokak', 'action', null)).toBe('sceneHeading');
    expect(detectElement('int. house', 'action', null)).toBe('sceneHeading');
    expect(detectElement('iç. ev', 'action', null)).toBe('sceneHeading');
    expect(detectElement('İçeride biri var.', 'action', null)).toBe('action');
  });
  it('geçiş, parantez, bölüm, ortalı, şarkı, sayfa sonu', () => {
    expect(detectElement('kesme:', 'action', null)).toBe('transition');
    expect(detectElement('(fısıldar)', 'action', 'character')).toBe('parenthetical');
    expect(detectElement('# Birinci Perde', 'action', null)).toBe('section');
    expect(detectElement('>SON<', 'action', null)).toBe('centered');
    expect(detectElement('~La la', 'action', 'dialogue')).toBe('lyrics');
    expect(detectElement('~La la', 'action', 'action')).toBe('action');
    expect(detectElement('===', 'action', null)).toBe('pageBreak');
  });
  it('otomatik tamamlama ve ad temizleme', () => {
    expect(suggest('ne', ['NERMİN'])).toBe('RMİN');
    expect(baseName('Elif (D.S.)')).toBe('ELİF');
    expect(baseName('Elif ^')).toBe('ELİF');
  });
});

let editor: Editor | null = null;
afterEach(() => editor?.destroy());

function make(lines: object[], opts: { known?: string[]; rev?: { on: boolean; gen: number } } = {}) {
  editor = new Editor({
    extensions: [
      StarterKit.configure({
        document: false, paragraph: false, heading: false, blockquote: false, bulletList: false,
        orderedList: false, listItem: false, listKeymap: false, codeBlock: false, code: false,
        horizontalRule: false, link: false, trailingNode: false, strike: false,
      }),
      ScreenplayDocument,
      Line,
      NoteMark,
      OmitMark,
      TagMark,
      RevMark,
      DelMark,
      Search,
      ScreenplayKeys.configure({
        known: () => ({ names: opts.known ?? [], headings: [] }),
        revision: () => opts.rev ?? { on: false, gen: 1 },
      }),
    ],
    content: JSON.parse(docJson(lines as never)),
  });
  editor.commands.focus('end');
  return editor;
}
const els = (e: Editor) => e.getJSON().content!.map((n) => n.attrs!.el as string);
const press = (e: Editor, key: string, mods: { shift?: boolean; ctrl?: boolean } = {}) => {
  const ev = new KeyboardEvent('keydown', { key, shiftKey: !!mods.shift, ctrlKey: !!mods.ctrl, bubbles: true });
  let handled = false;
  e.view.someProp('handleKeyDown', (f) => (handled = handled || f(e.view, ev)));
  return handled;
};
const type = (e: Editor, text: string) => {
  const { from, to } = e.state.selection;
  let handled = false;
  e.view.someProp('handleTextInput', (f) => (handled = handled || f(e.view, from, to, text, () => e.state.tr)));
  if (!handled) e.view.dispatch(e.state.tr.insertText(text, from, to));
};

describe('senaryo tuş akışı', () => {
  it('karakter → Enter → diyalog → Enter → aksiyon', () => {
    const e = make([L('character', 'Nermin')]);
    press(e, 'Enter');
    expect(els(e)).toEqual(['character', 'dialogue']);
    type(e, 'Merhaba.');
    press(e, 'Enter');
    expect(els(e)).toEqual(['character', 'dialogue', 'action']);
  });

  it('boş satırda Enter eleman değiştirir; Tab akışı', () => {
    const e = make([L('action')]);
    press(e, 'Tab');
    expect(els(e)).toEqual(['character']);
    press(e, 'Enter');
    expect(els(e)).toEqual(['action']);
    press(e, 'Enter');
    expect(els(e)).toEqual(['sceneHeading']);
  });

  it('diyalogda Tab parantez açar', () => {
    const e = make([L('character', 'Hikmet'), L('dialogue')]);
    press(e, 'Tab');
    type(e, 'gülümser');
    press(e, 'Enter');
    expect(els(e)).toEqual(['character', 'parenthetical', 'dialogue']);
    expect(e.getJSON().content![1].content![0].text).toBe('(gülümser)');
  });

  it('karakter adını önerir, Enter kabul eder', () => {
    const e = make([L('character', 'ner')], { known: ['NERMİN'] });
    press(e, 'Enter');
    expect(e.getJSON().content![0].content![0].text).toBe('nerMİN');
    expect(els(e)).toEqual(['character', 'dialogue']);
  });

  it('# yazınca bölüm olur ve işaret temizlenir', () => {
    const e = make([L('action')]);
    type(e, '# ');
    type(e, 'Birinci');
    expect(els(e)).toEqual(['section']);
    expect(e.getText()).toBe('Birinci');
  });

  it('Ctrl+D karakteri çift diyalog yapar', () => {
    const e = make([L('character', 'A'), L('dialogue', 'x'), L('character', 'B')]);
    toggleDual(e);
    expect(e.getJSON().content![2].attrs!.dual).toBe(true);
  });
});

describe('sahne kimlikleri', () => {
  it('her başlığa benzersiz sid verilir, bölünen başlık yeni sid alır', () => {
    const e = make([L('sceneHeading', 'İÇ. EV - GECE', { sid: 'a' })]);
    e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, 4)));
    e.view.dispatch(e.state.tr.split(4, 1, [{ type: e.schema.nodes.line, attrs: { el: 'sceneHeading', sid: 'a' } }]));
    const sids = e.getJSON().content!.map((n) => n.attrs!.sid);
    expect(sids[0]).toBe('a');
    expect(sids[1]).toBeTruthy();
    expect(sids[1]).not.toBe('a');
  });
  it('aksiyona dönen satırın sid’i temizlenir', () => {
    const e = make([L('sceneHeading', 'x', { sid: 'a' })]);
    e.view.dispatch(e.state.tr.setNodeMarkup(0, undefined, { el: 'action', sid: 'a' }));
    expect(e.getJSON().content![0].attrs!.sid).toBeNull();
  });
});

describe('revizyon modu', () => {
  it('açıkken yazılan metin kuşak rengiyle işaretlenir', () => {
    const e = make([L('action', 'Eski metin.')], { rev: { on: true, gen: 2 } });
    type(e, ' Yeni ek.');
    const content = e.getJSON().content![0].content!;
    const revRun = content.find((c) => c.marks?.some((m) => m.type === 'rev'));
    expect(revRun?.text).toBe(' Yeni ek.');
    expect(revRun?.marks?.find((m) => m.type === 'rev')?.attrs?.gen).toBe(2);
    expect(content[0].marks).toBeUndefined();
  });
  it('kapalıyken işaretlemez', () => {
    const e = make([L('action', 'Eski')]);
    type(e, ' yeni');
    expect(JSON.stringify(e.getJSON())).not.toContain('"rev"');
  });
});

describe('revizyonda silme', () => {
  const on = { rev: { on: true, gen: 3 } };
  it('Backspace eski metni silmez, silinmeye aday işaretler ve imleci geri alır', () => {
    const e = make([L('action', 'Eski metin')], on);
    press(e, 'Backspace');
    press(e, 'Backspace');
    const c = e.getJSON().content![0].content!;
    expect(c.map((x) => x.text).join('')).toBe('Eski metin');
    const del = c.find((x) => x.marks?.some((m) => m.type === 'del'));
    expect(del?.text).toBe('in');
    expect(del?.marks?.find((m) => m.type === 'del')?.attrs?.gen).toBe(3);
    expect(e.state.selection.from).toBe(1 + 'Eski met'.length);
  });
  it('bu revizyonda yazılan metin gerçekten silinir', () => {
    const e = make([L('action', 'Eski')], on);
    type(e, 'XY');
    press(e, 'Backspace');
    expect(e.getText()).toBe('EskiX');
  });
  it('seçimin üstüne yazmak: eskisi aday, yenisi revizyon', () => {
    const e = make([L('action', 'kırmızı elma')], on);
    e.view.dispatch(e.state.tr.setSelection(TextSelection.create(e.state.doc, 1, 8)));
    type(e, 'yeşil');
    const c = e.getJSON().content![0].content!;
    expect(c.find((x) => x.marks?.some((m) => m.type === 'del'))?.text).toBe('kırmızı');
    expect(c.find((x) => x.marks?.some((m) => m.type === 'rev'))?.text).toBe('yeşil');
  });
  it('revizyon kapalıyken tuşa karışmaz (silmeyi tarayıcı yapar), işaret eklemez', () => {
    const e = make([L('action', 'abc')]);
    expect(press(e, 'Backspace')).toBe(false);
    expect(JSON.stringify(e.getJSON())).not.toContain('"del"');
  });
});

describe('arama', () => {
  it('Türkçe harfleri doğru eşler (İ/i, I/ı)', () => {
    const e = make([L('action', 'İstanbul ve istasyon. ILIK ılık.')]);
    expect(findMatches(e.state, 'ist', false)).toHaveLength(2);
    expect(findMatches(e.state, 'ılık', false)).toHaveLength(2);
    expect(findMatches(e.state, 'İst', true)).toHaveLength(1);
  });
});
