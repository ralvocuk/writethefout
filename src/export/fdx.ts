/** Final Draft (.fdx) dışa ve içe aktarma */
import { blockText, type ScriptBlock } from '../script/blocks';
import type { El } from '../script/elements';
import { line, textNodes, type JDoc, type JLine, type JMark } from '../script/json';
import { scriptLabels, upper, type Lang } from './layout';
import { REVISIONS } from '../script/elements';
import { t } from '../i18n';
import type { TitleInfo } from './fountain';

const TYPE: Partial<Record<El, string>> = {
  sceneHeading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  centered: 'Action',
  lyrics: 'Dialogue',
};

export const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function para(b: ScriptBlock, lang: Lang, sceneNumbers: boolean, newPage: boolean): string {
  const caps = b.el === 'sceneHeading' || b.el === 'character' || b.el === 'transition';
  const texts = b.runs
    .map((r) => {
      const italic = r.i || b.el === 'lyrics';
      const style = [r.b && 'Bold', italic && 'Italic', r.u && 'Underline'].filter(Boolean).join('+');
      const t = xml(caps ? upper(r.text, lang) : r.text);
      const attrs = [style ? `Style="${style}"` : '', r.rev ? `RevisionID="${r.rev}"` : ''].filter(Boolean).join(' ');
      return attrs ? `<Text ${attrs}>${t}</Text>` : `<Text>${t}</Text>`;
    })
    .join('');
  const attrs = [
    `Type="${TYPE[b.el]}"`,
    sceneNumbers && b.sceneNo && b.el === 'sceneHeading' ? `Number="${b.sceneNo}"` : '',
    b.el === 'centered' ? 'Alignment="Center"' : '',
    newPage ? 'StartsNewPage="Yes"' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<Paragraph ${attrs}>${texts}</Paragraph>`;
}

export function toFdx(blocks: ScriptBlock[], title: TitleInfo | null, lang: Lang, sceneNumbers: boolean): string {
  const out: string[] = [];
  let newPage = false;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.el === 'pageBreak') {
      newPage = true;
      continue;
    }
    if (b.el === 'section' || !blockText(b).trim()) continue;
    // çift diyalog: karakter grubu + dual işaretli ikinci grup
    if (b.el === 'character') {
      let j = i + 1;
      while (j < blocks.length && ['dialogue', 'parenthetical', 'lyrics'].includes(blocks[j].el)) j++;
      if (blocks[j]?.el === 'character' && blocks[j].dual) {
        let k = j + 1;
        while (k < blocks.length && ['dialogue', 'parenthetical', 'lyrics'].includes(blocks[k].el)) k++;
        const inner = blocks.slice(i, k).map((x) => `        ${para(x, lang, false, false)}`).join('\n');
        out.push(`    <Paragraph${newPage ? ' StartsNewPage="Yes"' : ''}>\n      <DualDialogue>\n${inner}\n      </DualDialogue>\n    </Paragraph>`);
        newPage = false;
        i = k - 1;
        continue;
      }
    }
    out.push(`    ${para(b, lang, sceneNumbers, newPage)}`);
    newPage = false;
  }
  const tp =
    title && title.title
      ? `  <TitlePage>
    <Content>
      <Paragraph Alignment="Center" Type="Action"><Text>${xml(upper(title.title, lang))}</Text></Paragraph>
      <Paragraph Alignment="Center" Type="Action"><Text></Text></Paragraph>
      <Paragraph Alignment="Center" Type="Action"><Text>${xml(scriptLabels(lang).written)}</Text></Paragraph>
      <Paragraph Alignment="Center" Type="Action"><Text>${xml(title.author)}</Text></Paragraph>
${title.contact
  .split('\n')
  .filter(Boolean)
  .map((l) => `      <Paragraph Alignment="Left" Type="Action"><Text>${xml(l)}</Text></Paragraph>`)
  .join('\n')}
    </Content>
  </TitlePage>
`
      : '';
  // revizyon kümeleri: Final Draft'ın renk/işaret tanımları
  const gens = [...new Set(blocks.flatMap((b) => b.runs.map((r) => r.rev ?? 0)).filter(Boolean))].sort();
  const revisions = gens.length
    ? `  <Revisions ActiveSet="${Math.max(...gens)}" Location="7.75" RevisionMode="Active" RevisionsShown="Active" ShowAllMarks="No" ShowAllSets="No">
${REVISIONS.map((r, i) => `    <Revision Color="${r.color}" FullRevision="False" ID="${i + 1}" Mark="*" Name="${xml(scriptLabels(lang).revision(i + 1))}" PageColor="${r.color}" Style=""/>`).join('\n')}
  </Revisions>
`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
  <Content>
${out.join('\n')}
  </Content>
${tp}${revisions}</FinalDraft>
`;
}

/* ---------- İçe aktarma ---------- */

const FROM_TYPE: Record<string, El> = {
  'scene heading': 'sceneHeading',
  action: 'action',
  general: 'action',
  shot: 'action',
  character: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  transition: 'transition',
  lyrics: 'lyrics',
  'cast list': 'action',
};

export function parseFdx(src: string): { title: Partial<TitleInfo>; doc: JDoc } {
  const dom = new DOMParser().parseFromString(src, 'application/xml');
  if (dom.querySelector('parsererror')) throw new Error(t('Final Draft dosyası okunamadı (XML hatalı).'));
  const content = dom.querySelector('FinalDraft > Content') ?? dom.querySelector('Content');
  const out: JLine[] = [];

  const readPara = (p: Element, dual = false) => {
    const type = (p.getAttribute('Type') ?? 'Action').toLowerCase();
    const el: El = p.getAttribute('Alignment') === 'Center' && type === 'action' ? 'centered' : (FROM_TYPE[type] ?? 'action');
    const nodes = [...p.children].filter((c) => c.tagName === 'Text').flatMap((t) => {
      const style = (t.getAttribute('Style') ?? '').split('+');
      const marks: JMark[] = [];
      if (style.includes('Bold')) marks.push({ type: 'bold' });
      if (style.includes('Italic') && el !== 'lyrics') marks.push({ type: 'italic' });
      if (style.includes('Underline')) marks.push({ type: 'underline' });
      const rev = Number(t.getAttribute('RevisionID'));
      if (rev > 0) marks.push({ type: 'rev', attrs: { gen: Math.min(8, rev) } });
      return textNodes(t.textContent ?? '', marks);
    });
    if (p.getAttribute('StartsNewPage') === 'Yes') out.push(line('pageBreak'));
    const num = el === 'sceneHeading' ? p.getAttribute('Number') : null;
    out.push(line(el, nodes, { ...(num ? { num } : {}), ...(dual ? { dual: true } : {}) }));
  };

  for (const p of [...(content?.children ?? [])]) {
    if (p.tagName !== 'Paragraph') continue;
    const dd = p.querySelector('DualDialogue');
    if (dd) {
      let chars = 0;
      for (const inner of [...dd.children]) {
        if (inner.tagName !== 'Paragraph') continue;
        const isChar = (inner.getAttribute('Type') ?? '').toLowerCase() === 'character';
        if (isChar) chars++;
        readPara(inner, isChar && chars === 2);
      }
      continue;
    }
    readPara(p);
  }
  const tp = [...dom.querySelectorAll('TitlePage Paragraph')].map((p) => p.textContent?.trim() ?? '').filter(Boolean);
  return { title: { title: tp[0] }, doc: { type: 'doc', content: out } };
}
