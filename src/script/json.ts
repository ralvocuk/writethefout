/** Editör belgesinin JSON biçimi ve küçük yardımcılar (içe aktarıcılar bunu üretir). */
import type { El } from './elements';

export interface JMark {
  type: string;
  attrs?: Record<string, unknown>;
}
export interface JText {
  type: 'text' | 'hardBreak';
  text?: string;
  marks?: JMark[];
}
export interface JLine {
  type: 'line';
  attrs: { el: El; sid?: string | null; num?: string | null; dual?: boolean; pageLock?: number | null };
  content: JText[];
}
export interface JDoc {
  type: 'doc';
  content: JLine[];
}

export function textNodes(text: string, marks: JMark[] = []): JText[] {
  const out: JText[] = [];
  text.split('\n').forEach((part, k) => {
    if (k > 0) out.push({ type: 'hardBreak' });
    if (part) out.push(marks.length ? { type: 'text', text: part, marks } : { type: 'text', text: part });
  });
  return out;
}

export const line = (el: El, content: JText[] = [], attrs: Partial<JLine['attrs']> = {}): JLine => ({
  type: 'line',
  attrs: { el, ...attrs },
  content,
});

/** Editörün JSON'unda boş satırların `content` alanı olmaz; her yerde dizi olsun */
export const normalizeDoc = (doc: JDoc): JDoc => ({
  type: 'doc',
  content: (doc?.content ?? []).map((l) => ({ ...l, attrs: l.attrs ?? ({ el: 'action' } as JLine['attrs']), content: l.content ?? [] })),
});

export const lineText = (l: JLine) => (l.content ?? []).map((c) => (c.type === 'hardBreak' ? '\n' : (c.text ?? ''))).join('');

/** Başlıklara sid ver, boş belgeyi doldur */
export function finalize(doc: JDoc, newSid: () => string): JDoc {
  const content = normalizeDoc(doc).content.map((l) =>
    l.attrs.el === 'sceneHeading' ? { ...l, attrs: { ...l.attrs, sid: l.attrs.sid ?? newSid() } } : l,
  );
  if (!content.length) content.push(line('sceneHeading', [], { sid: newSid() }));
  return { type: 'doc', content };
}
