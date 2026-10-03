/**
 * Oyuncu sayfaları (sides) ve replik dökümü.
 * İkisi de basılacak blok listesi üretir; PDF'e dönüşüm ortak motorla (renderPdf) yapılır.
 */
import { blockText, type ScriptBlock } from '../script/blocks';
import { baseName } from '../script/elements';
import type { SceneInfo } from '../script/model';
import { scriptLabels, type Lang } from './layout';

const SPEECH = new Set(['dialogue', 'parenthetical', 'lyrics']);

/** Karakterin konuştuğu sahneler */
export function scenesWith(scenes: SceneInfo[], name: string): SceneInfo[] {
  return scenes.filter((s) => s.characters.includes(name));
}

/**
 * Oyuncu sayfaları: seçili sahneler, numaraları senaryodakiyle aynı.
 * `blocks` numaralanmış olmalı (numberScenes).
 */
export function sidesBlocks(blocks: ScriptBlock[], scenes: SceneInfo[], sids: string[], opts: { newPagePerScene: boolean }): ScriptBlock[] {
  const out: ScriptBlock[] = [];
  const chosen = scenes.filter((s) => sids.includes(s.sid));
  chosen.forEach((s, i) => {
    if (i > 0 && opts.newPagePerScene) out.push({ el: 'pageBreak', runs: [] });
    for (const b of blocks.slice(s.idx, s.end)) if (b.el !== 'section' && b.el !== 'pageBreak') out.push(b);
  });
  return out;
}

export interface Speech {
  /** sahne başlık bloğu */
  heading: ScriptBlock | null;
  /** önceki konuşmacının son repliği (ipucu) */
  cue: { name: string; text: string } | null;
  /** karakter + replik blokları */
  group: ScriptBlock[];
  sid: string | null;
}

/** Karakterin tüm replikleri, her birinin önündeki ipucuyla */
export function speechesOf(blocks: ScriptBlock[], name: string): Speech[] {
  const out: Speech[] = [];
  let heading: ScriptBlock | null = null;
  let last: { name: string; text: string } | null = null;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.el === 'sceneHeading') {
      heading = b;
      last = null;
      continue;
    }
    if (b.el !== 'character') {
      // aksiyon ipucu değildir ama araya giren son konuşmayı da silmez
      continue;
    }
    let j = i + 1;
    while (j < blocks.length && SPEECH.has(blocks[j].el)) j++;
    const group = blocks.slice(i, j);
    const speaker = baseName(blockText(b));
    if (speaker === name) out.push({ heading, cue: last && last.name !== name ? last : null, group, sid: heading?.sid ?? null });
    const lastLine = [...group].reverse().find((g) => g.el === 'dialogue' || g.el === 'lyrics');
    if (lastLine) last = { name: speaker, text: blockText(lastLine) };
    i = j - 1;
  }
  return out;
}

/** İpucu: son cümle (uzunsa sondan kısaltılmış) */
export function cueText(text: string, max = 60): string {
  const t = text.replace(/\s+/g, ' ').trim();
  const parts = t.split(/(?<=[.!?…])\s+/u).filter(Boolean);
  let cue = parts.at(-1) ?? t;
  if (cue.length > max) cue = cue.slice(cue.length - max).replace(/^\S*\s/u, '');
  return cue === t ? cue : `…${cue}`;
}

/** Replik dökümü: sahne başlıkları, ipuçları ve replikler */
export function lineListBlocks(speeches: Speech[], lang: Lang): ScriptBlock[] {
  const out: ScriptBlock[] = [];
  let lastSid: string | null | undefined;
  for (const sp of speeches) {
    if (sp.sid !== lastSid) {
      if (sp.heading) out.push(sp.heading);
      lastSid = sp.sid;
    } else out.push({ el: 'centered', runs: [{ text: '· · ·' }] });
    if (sp.cue) {
      out.push({ el: 'character', runs: [{ text: `${sp.cue.name} (${scriptLabels(lang).cue})` }] });
      out.push({ el: 'dialogue', runs: [{ text: cueText(sp.cue.text), i: true }] });
    }
    // çift diyalog dökümde tek sütun basılır
    out.push(...sp.group.map((g) => (g.dual ? { ...g, dual: false } : g)));
  }
  return out;
}
