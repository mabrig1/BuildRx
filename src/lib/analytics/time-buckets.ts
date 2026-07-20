/** Day-bucketing helpers shared by the admin and personal analytics dashboards. */

export interface DayCount {
  date: string; // YYYY-MM-DD
  count: number;
}

export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The last `n` days as YYYY-MM-DD strings, oldest first, ending today (UTC). */
export function lastNDays(n: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(dayKey(d));
  }
  return days;
}

/** Buckets ISO timestamps into the given days, zero-filling days with no events. */
export function bucketByDay(timestamps: string[], days: string[]): DayCount[] {
  const buckets = new Map<string, number>(days.map((d) => [d, 0]));
  for (const ts of timestamps) {
    const key = ts.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return days.map((date) => ({ date, count: buckets.get(date) ?? 0 }));
}

/** Groups arbitrary rows by a string key, counting occurrences — used for "by action" / "by provider" breakdowns. */
export function countBy<T>(rows: T[], keyOf: (row: T) => string): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyOf(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}
