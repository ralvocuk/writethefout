import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  CH,
  LEFT,
  LINE,
  MARGIN_TOP,
  PAPER,
  RIGHT_EDGE,
  paginate,
  titlePageLayout,
  type LayoutOptions,
  type PLine,
  type Page,
  type Run,
  type ScriptBlock,
} from './layout';
import type { TitleInfo } from './fountain';

export interface FontSet {
  regular: Uint8Array;
  bold: Uint8Array;
  italic: Uint8Array;
  boldItalic: Uint8Array;
}

export interface PdfOptions extends LayoutOptions {
  /** revizyon yıldızları ve üst bilgide revizyon adı */
  revision?: { label: string; date: string } | null;
  /** yalnızca bu sayfa numaralarını bas (revize sayfalar) */
  onlyPages?: number[];
  /** her sayfanın sol üstüne yazılacak bilgi (ör. "NERMİN — oyuncu sayfaları") */
  header?: string;
}

interface Fonts {
  r: PDFFont;
  b: PDFFont;
  i: PDFFont;
  bi: PDFFont;
}

const INK = rgb(0, 0, 0);
/** fosforlu kalem sarısı */
const MARKER = rgb(1, 0.93, 0.5);
const len = (s: string) => [...s].length;
const runsLen = (runs: Run[]) => runs.reduce((a, r) => a + len(r.text), 0);

function drawRuns(page: PDFPage, fonts: Fonts, runs: Run[], x: number, y: number) {
  let cx = x;
  for (const r of runs) {
    if (!r.text) continue;
    const font = r.b && r.i ? fonts.bi : r.b ? fonts.b : r.i ? fonts.i : fonts.r;
    page.drawText(r.text, { x: cx, y, size: 12, font, color: INK });
    const w = len(r.text) * CH;
    if (r.u) page.drawLine({ start: { x: cx, y: y - 1.6 }, end: { x: cx + w, y: y - 1.6 }, thickness: 0.6, color: INK });
    cx += w;
  }
}

function lineX(ln: PLine) {
  const w = runsLen(ln.runs) * CH;
  if (ln.align === 'right') return RIGHT_EDGE - w;
  if (ln.align === 'center') return (LEFT + RIGHT_EDGE) / 2 - w / 2;
  return ln.x;
}

function drawTitlePage(doc: PDFDocument, fonts: Fonts, opts: LayoutOptions, t: TitleInfo) {
  const { w, h } = PAPER[opts.paper];
  const page = doc.addPage([w, h]);
  for (const l of titlePageLayout(t, opts.paper, opts.lang)) {
    const tw = len(l.text) * CH;
    const x = l.align === 'center' ? l.x - tw / 2 : l.align === 'right' ? l.x - tw : l.x;
    page.drawText(l.text, { x, y: h - l.y, size: 12, font: l.bold ? fonts.b : fonts.r, color: INK });
  }
}

function drawPage(doc: PDFDocument, fonts: Fonts, opts: PdfOptions, p: Page) {
  const { w, h } = PAPER[opts.paper];
  const page = doc.addPage([w, h]);
  const headerY = h - 36 - 9;
  if (p.number > 1) {
    const label = `${p.number}.`;
    page.drawText(label, { x: RIGHT_EDGE - len(label) * CH, y: headerY, size: 12, font: fonts.r, color: INK });
  }
  if (opts.revision && p.lines.some((l) => l?.rev || l?.pair?.rev)) {
    const rl = `${opts.revision.label} — ${opts.revision.date}`;
    page.drawText(rl, { x: LEFT, y: headerY, size: 12, font: fonts.r, color: INK });
  } else if (opts.header) {
    page.drawText(opts.header, { x: LEFT, y: headerY, size: 12, font: fonts.r, color: INK });
  }
  p.lines.forEach((ln, idx) => {
    if (!ln) return;
    const y = h - MARGIN_TOP - idx * LINE - 9;
    for (const part of [ln, ln.pair].filter(Boolean) as PLine[]) {
      const w = runsLen(part.runs) * CH;
      if (part.hl && w > 0) page.drawRectangle({ x: lineX(part) - 2.5, y: y - 3, width: w + 5, height: LINE, color: MARKER });
    }
    for (const part of [ln, ln.pair].filter(Boolean) as PLine[]) {
      const runs = part.el === 'sceneHeading' ? part.runs.map((r) => ({ ...r, b: true })) : part.runs;
      drawRuns(page, fonts, runs, lineX(part), y);
    }
    if (ln.sceneNo) {
      const n = ln.sceneNo;
      page.drawText(n, { x: LEFT - 30 - len(n) * CH, y, size: 12, font: fonts.r, color: INK });
      page.drawText(n, { x: RIGHT_EDGE + 18, y, size: 12, font: fonts.r, color: INK });
    }
    // revizyon yıldızı sağ kenarda
    if (opts.revision && (ln.rev || ln.pair?.rev)) {
      page.drawText('*', { x: RIGHT_EDGE + (ln.sceneNo ? 46 : 30), y, size: 12, font: fonts.r, color: INK });
    }
  });
}

export async function renderPdf(
  blocks: ScriptBlock[],
  opts: PdfOptions,
  title: TitleInfo | null,
  fontBytes: FontSet,
): Promise<{ bytes: Uint8Array; pages: number }> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fonts: Fonts = {
    r: await doc.embedFont(fontBytes.regular, { subset: true }),
    b: await doc.embedFont(fontBytes.bold, { subset: true }),
    i: await doc.embedFont(fontBytes.italic, { subset: true }),
    bi: await doc.embedFont(fontBytes.boldItalic, { subset: true }),
  };
  doc.setTitle(title?.title || 'Senaryo');
  if (title?.author) doc.setAuthor(title.author);
  doc.setCreator('writetheFout.');
  doc.setProducer('writetheFout.');

  if (title && title.title) drawTitlePage(doc, fonts, opts, title);
  const all = paginate(blocks, opts);
  const pages = opts.onlyPages ? all.filter((p) => opts.onlyPages!.includes(p.number)) : all;
  for (const p of pages) drawPage(doc, fonts, opts, p);
  return { bytes: await doc.save(), pages: pages.length };
}
