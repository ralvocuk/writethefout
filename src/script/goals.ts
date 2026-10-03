/** Yazma hedefleri: gün serisi ve son günler. Saf fonksiyonlar (test edilir). */
import type { DayWords } from '../data/repository';

const pad = (n: number) => String(n).padStart(2, '0');
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
};

export interface Streak {
  /** bugün dahil (bugün henüz tamamlanmadıysa dünden geriye) üst üste hedefi tutan gün */
  current: number;
  longest: number;
  /** bugün hedef tuttu mu */
  todayDone: boolean;
}

export function streakOf(history: DayWords[], goal: number, today: string): Streak {
  const done = new Set(history.filter((h) => h.words >= goal).map((h) => h.day));
  const todayDone = done.has(today);
  let current = 0;
  for (let d = todayDone ? today : addDays(today, -1); done.has(d); d = addDays(d, -1)) current++;
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of [...done].sort()) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = day;
  }
  return { current, longest, todayDone };
}

/** Bugünle biten n günün dizisi (boş günler 0) */
export function lastDays(history: DayWords[], n: number, today: string): DayWords[] {
  const map = new Map(history.map((h) => [h.day, h.words]));
  const out: DayWords[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push({ day, words: map.get(day) ?? 0 });
  }
  return out;
}

export const formatClock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
};
