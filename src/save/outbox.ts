// ---------------------------------------------------------------------------
// Offline outbox for run submissions.
//
// When submit_match can't reach the server, the RAW run stats are queued here
// (never the rewards — rewards are computed server-side). On next launch the
// Backend drains the queue, re-submits each run, then refetches the profile so
// the server-authoritative total wins. The queue holds stats ONLY; it never
// credits coins locally (amendment #3).
// ---------------------------------------------------------------------------

const OUTBOX_KEY = 'bh_outbox';

export interface QueuedRun {
  durationSeconds: number;
  kills: number;
  level: number;
  /** Client timestamp, for ordering / debugging. */
  ts: number;
}

function read(): QueuedRun[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedRun[]) : [];
  } catch {
    return [];
  }
}

function write(runs: QueuedRun[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(runs));
  } catch {
    // ignore — storage unavailable
  }
}

export const outbox = {
  push(run: Omit<QueuedRun, 'ts'>): void {
    const runs = read();
    runs.push({ ...run, ts: Date.now() });
    write(runs);
  },

  /** Return all queued runs and clear the queue atomically. */
  drain(): QueuedRun[] {
    const runs = read();
    if (runs.length > 0) write([]);
    return runs;
  },

  /** Re-queue runs that failed to submit during a drain attempt. */
  restore(runs: QueuedRun[]): void {
    if (runs.length === 0) return;
    write([...runs, ...read()]);
  },

  size(): number {
    return read().length;
  }
};
