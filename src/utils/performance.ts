export interface PerfRecord {
  detect: number;
  align: number;
  embed: number;
  match: number;
  total: number;
}

export function makeStopwatch() {
  let t = Date.now();
  return {
    lap(): number {
      const now = Date.now();
      const elapsed = now - t;
      t = now;
      return elapsed;
    },
    elapsed(): number {
      return Date.now() - t;
    },
  };
}

export function logPerfTable(label: string, p: PerfRecord): void {
  console.log(`
[AegisFace Perf — ${label}]
  detect : ${p.detect} ms
  align  : ${p.align} ms
  embed  : ${p.embed} ms
  match  : ${p.match} ms
  ─────────────────────
  TOTAL  : ${p.total} ms  (target <1000 ms)
`);
}
