import { describe, expect, it } from 'vitest';
import { paginate } from '../src/export/layout';
import type { ScriptBlock } from '../src/script/blocks';

const b = (el: ScriptBlock['el'], text: string, extra: Partial<ScriptBlock> = {}): ScriptBlock => ({
  el, runs: text ? [{ text }] : [], ...extra,
});

describe('sayfa kilitleri', () => {
  it('kilitli sahneyi istenen sayfadan önce başlatmaz', () => {
    const pages = paginate([
      b('action', 'Önceki sahne içeriği.'),
      b('sceneHeading', 'İÇ. EV - GECE', { sid: 's1', pageLock: 3 }),
      b('action', 'Yeni sahne.'),
    ], { paper: 'a4', lang: 'tr', sceneNumbers: false, headingSpace: 2 });
    const pageWithHeading = pages.findIndex((p) => p.lines.some((l) => l?.sid === 's1')) + 1;
    expect(pageWithHeading).toBe(3);
  });

  it('kilit sayfası doğal sayfadan küçükse geriye sarmaz', () => {
    const pages = paginate([
      b('action', 'A'.repeat(900)),
      b('sceneHeading', 'İÇ. EV - GECE', { sid: 's1', pageLock: 1 }),
    ], { paper: 'a4', lang: 'tr', sceneNumbers: false, headingSpace: 2 });
    const pageWithHeading = pages.findIndex((p) => p.lines.some((l) => l?.sid === 's1')) + 1;
    expect(pageWithHeading).toBeGreaterThan(1);
  });
});
