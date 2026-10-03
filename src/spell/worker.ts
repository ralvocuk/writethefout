/// <reference lib="webworker" />
/** Yazım denetimi işçisi: sözlüğü bir kez yükler, kelime kontrolü ve öneri yapar. */
import nspell from 'nspell';
import { checkWord, suggestWord, type Speller } from './engine';

type In = { id: number; type: 'check'; words: string[] } | { id: number; type: 'suggest'; word: string } | { id: number; type: 'load'; base: string };

let speller: Speller | null = null;
let loading: Promise<void> | null = null;

async function load(base: string) {
  if (speller) return;
  loading ??= (async () => {
    const [aff, dic] = await Promise.all([
      fetch(`${base}dict/tr.aff`).then((r) => r.text()),
      fetch(`${base}dict/tr.dic`).then((r) => r.text()),
    ]);
    speller = nspell(aff, dic);
  })();
  await loading;
}

self.onmessage = async (e: MessageEvent<In>) => {
  const m = e.data;
  try {
    if (m.type === 'load') {
      await load(m.base);
      self.postMessage({ id: m.id, ok: true });
    } else if (m.type === 'check') {
      await loading;
      const result: Record<string, boolean> = {};
      for (const w of m.words) result[w] = speller ? checkWord(speller, w) : true;
      self.postMessage({ id: m.id, result });
    } else if (m.type === 'suggest') {
      await loading;
      self.postMessage({ id: m.id, result: speller ? suggestWord(speller, m.word) : [] });
    }
  } catch (err) {
    self.postMessage({ id: m.id, error: err instanceof Error ? err.message : String(err) });
  }
};
