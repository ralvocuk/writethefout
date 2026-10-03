import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { Modal } from './Dialogs';
import { today, type DayWords, type Sprint } from '../data/repository';
import { addDays, formatClock, lastDays, streakOf } from '../script/goals';
import { formatNumber } from '../script/elements';

const close = () => useStore.getState().openDialogBox(null);
const PRESETS = [10, 15, 25, 45, 60];
const DAYS = 30;

/** Yazma hedefleri: günlük hedef, seri, son 30 gün ve süreli seanslar */
export function GoalsDialog() {
  const open = useStore((s) => s.dialog === 'goals');
  const goal = useStore((s) => s.dailyGoal);
  const wordsToday = useStore((s) => s.wordsToday);
  const sprint = useStore((s) => s.sprint);
  const repo = useStore((s) => s.repo);
  const setGoal = useStore((s) => s.setDailyGoal);
  const startSprint = useStore((s) => s.startSprint);
  const stopSprint = useStore((s) => s.stopSprint);
  const [history, setHistory] = useState<DayWords[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [minutes, setMinutes] = useState(25);
  const [target, setTarget] = useState('');
  const [goalText, setGoalText] = useState(String(goal));

  useEffect(() => {
    if (!open || !repo) return;
    setGoalText(String(useStore.getState().dailyGoal));
    // seri için geniş aralık
    repo.wordHistory(addDays(today(), -400)).then(setHistory);
    repo.sprints(6).then(setSprints);
  }, [open, repo, sprint]);

  if (!open) return null;
  const t = today();
  // bugünün canlı sayısını geçmişe işle
  const hist = [...history.filter((h) => h.day !== t), { day: t, words: wordsToday }];
  const streak = streakOf(hist, Math.max(1, goal), t);
  const days = lastDays(hist, DAYS, t);
  const max = Math.max(goal, ...days.map((d) => d.words), 1);
  const total30 = days.reduce((a, d) => a + d.words, 0);
  const pct = goal ? Math.min(100, Math.round((wordsToday / goal) * 100)) : 0;

  const commitGoal = () => {
    const n = parseInt(goalText.replace(/\D/g, ''), 10);
    if (Number.isFinite(n)) setGoal(n);
    else setGoalText(String(goal));
  };

  return (
    <Modal title="Yazma hedefleri" aside={`Bugün ${formatNumber(wordsToday)} kelime`} onClose={close} wide>
      <div className="dialog-body goals">
        <section className="goal-top">
          <div className="goal-stat">
            <span className="goal-n num">%{pct}</span>
            <span className="muted">günün hedefi</span>
            <div className="progress">
              <i className={pct >= 100 ? 'full' : ''} style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="goal-stat">
            <span className="goal-n num">{streak.current}</span>
            <span className="muted">gün üst üste{streak.todayDone ? '' : ' (bugün henüz değil)'}</span>
          </div>
          <div className="goal-stat">
            <span className="goal-n num">{streak.longest}</span>
            <span className="muted">en uzun seri</span>
          </div>
          <div className="goal-stat">
            <span className="goal-n num">{formatNumber(total30)}</span>
            <span className="muted">son {DAYS} gün</span>
          </div>
        </section>

        <label className="opt-row goal-input">
          <span className="muted">Günlük hedef</span>
          <span>
            <input
              className="num-input"
              inputMode="numeric"
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              onBlur={commitGoal}
              onKeyDown={(e) => e.key === 'Enter' && commitGoal()}
              aria-label="Günlük kelime hedefi"
            />{' '}
            <span className="muted">kelime</span>
            <span className="goal-presets">
              {[250, 500, 1000, 1500, 2000].map((n) => (
                <button key={n} className="chip-btn" aria-pressed={goal === n} onClick={() => (setGoal(n), setGoalText(String(n)))}>
                  {formatNumber(n)}
                </button>
              ))}
            </span>
          </span>
        </label>

        <div className="goal-chart" role="img" aria-label={`Son ${DAYS} günde yazılan kelimeler`}>
          {goal ? <div className="goal-line" style={{ bottom: `${(goal / max) * 100}%` }} title={`Hedef: ${formatNumber(goal)}`} /> : null}
          {days.map((d) => (
            <div
              key={d.day}
              className={`goal-bar ${d.words >= goal && goal ? 'hit' : ''} ${d.day === t ? 'today' : ''}`}
              title={`${new Date(d.day + 'T12:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' })}: ${formatNumber(d.words)} kelime`}
            >
              <i style={{ height: `${(d.words / max) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="goal-axis muted num">
          <span>{new Date(days[0].day + 'T12:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}</span>
          <span>bugün</span>
        </div>

        <h3 className="label goal-h">Süreli seans</h3>
        {sprint ? (
          <SprintStatus big onStop={() => stopSprint(false)} />
        ) : (
          <div className="sprint-setup">
            <div className="segmented sprint-len" role="radiogroup" aria-label="Süre">
              {PRESETS.map((m) => (
                <button key={m} role="radio" aria-checked={minutes === m} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
                  {m} dk
                </button>
              ))}
            </div>
            <label className="sprint-target">
              <span className="muted">Kelime hedefi</span>
              <input className="num-input wide" inputMode="numeric" placeholder="isteğe bağlı" value={target} onChange={(e) => setTarget(e.target.value.replace(/\D/g, ''))} />
            </label>
            <button
              className="btn primary"
              onClick={() => {
                startSprint(minutes, target ? parseInt(target, 10) : null);
                close();
              }}
            >
              Seansı başlat
            </button>
          </div>
        )}
        {sprints.length ? (
          <div className="sprint-list">
            {sprints.map((s) => (
              <div key={s.id} className="sprint-row">
                <span className="muted num">
                  {new Date(s.startedAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="num">{s.minutes} dk</span>
                <span className="num">
                  {formatNumber(s.words)} kelime{s.target ? ` / ${formatNumber(s.target)}` : ''}
                </span>
                <span className={s.target && s.words >= s.target ? 'ok' : 'muted'}>{s.completed ? (s.target ? (s.words >= s.target ? 'hedef tuttu' : 'tamamlandı') : 'tamamlandı') : 'yarıda bırakıldı'}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/** Saniyede bir yenilenen geri sayım */
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function SprintStatus({ big, onStop }: { big?: boolean; onStop?: () => void }) {
  const sprint = useStore((s) => s.sprint);
  const now = useNow(!!sprint);
  if (!sprint) return null;
  const end = sprint.startedAt + sprint.minutes * 60000;
  const left = end - now;
  const words = Math.max(0, sprint.words);
  const frac = Math.min(1, (now - sprint.startedAt) / (sprint.minutes * 60000));
  return (
    <div className={`sprint ${big ? 'big' : ''}`} title="Süreli seans">
      <svg width={big ? 28 : 14} height={big ? 28 : 14} viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r="8" fill="none" stroke="var(--rule-strong)" strokeWidth="2.4" />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.4"
          strokeDasharray={`${frac * 50.27} 50.27`}
          transform="rotate(-90 10 10)"
        />
      </svg>
      <span className="num">{formatClock(left)}</span>
      <span className="num muted">
        {formatNumber(words)}
        {sprint.target ? ` / ${formatNumber(sprint.target)}` : ''} k.
      </span>
      <button className="text-btn" onClick={onStop ?? (() => useStore.getState().stopSprint(false))}>
        Durdur
      </button>
    </div>
  );
}

/** Seans süresi dolunca bitir (App içinde bir kez kurulur) */
export function useSprintTimer() {
  const sprint = useStore((s) => s.sprint);
  useEffect(() => {
    if (!sprint) return;
    const end = sprint.startedAt + sprint.minutes * 60000;
    const t = setTimeout(() => useStore.getState().stopSprint(true), Math.max(0, end - Date.now()));
    return () => clearTimeout(t);
  }, [sprint?.id]); // eslint-disable-line react-hooks/exhaustive-deps
}
