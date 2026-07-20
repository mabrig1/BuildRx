import { describe, expect, it } from "vitest";

import { bucketByDay, countBy, dayKey, lastNDays } from "@/lib/analytics/time-buckets";

describe("dayKey", () => {
  it("formats a date as YYYY-MM-DD in UTC", () => {
    expect(dayKey(new Date("2026-07-04T15:30:00Z"))).toBe("2026-07-04");
  });
});

describe("lastNDays", () => {
  it("returns n days ending today, oldest first", () => {
    const days = lastNDays(7);
    expect(days).toHaveLength(7);
    expect(days[6]).toBe(dayKey(new Date()));
  });

  it("returns consecutive calendar days", () => {
    const days = lastNDays(5);
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(`${days[i - 1]}T00:00:00Z`);
      const curr = new Date(`${days[i]}T00:00:00Z`);
      expect(curr.getTime() - prev.getTime()).toBe(864e5);
    }
  });
});

describe("bucketByDay", () => {
  it("counts timestamps into matching day buckets", () => {
    const days = ["2026-07-01", "2026-07-02", "2026-07-03"];
    const timestamps = [
      "2026-07-01T09:00:00Z",
      "2026-07-01T20:00:00Z",
      "2026-07-03T00:00:00Z",
    ];
    expect(bucketByDay(timestamps, days)).toEqual([
      { date: "2026-07-01", count: 2 },
      { date: "2026-07-02", count: 0 },
      { date: "2026-07-03", count: 1 },
    ]);
  });

  it("ignores timestamps outside the given days", () => {
    const days = ["2026-07-01"];
    expect(bucketByDay(["2026-06-30T00:00:00Z"], days)).toEqual([
      { date: "2026-07-01", count: 0 },
    ]);
  });

  it("zero-fills every day when there are no timestamps", () => {
    const days = ["2026-07-01", "2026-07-02"];
    expect(bucketByDay([], days)).toEqual([
      { date: "2026-07-01", count: 0 },
      { date: "2026-07-02", count: 0 },
    ]);
  });
});

describe("countBy", () => {
  it("groups and counts, sorted by count descending", () => {
    const rows = ["a", "b", "a", "c", "a", "b"];
    expect(countBy(rows, (r) => r)).toEqual([
      { key: "a", count: 3 },
      { key: "b", count: 2 },
      { key: "c", count: 1 },
    ]);
  });

  it("returns an empty array for no rows", () => {
    expect(countBy([], (r: string) => r)).toEqual([]);
  });
});
