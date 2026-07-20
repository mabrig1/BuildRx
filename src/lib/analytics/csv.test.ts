import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/analytics/csv";

describe("toCsv", () => {
  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });

  it("writes a header row from the first row's keys", () => {
    const csv = toCsv([{ a: 1, b: 2 }]);
    expect(csv.split("\n")[0]).toBe("a,b");
  });

  it("quotes values containing commas, quotes, or newlines", () => {
    const csv = toCsv([{ note: 'has, a comma and "quotes"\nand a newline' }]);
    expect(csv).toBe('note\n"has, a comma and ""quotes""\nand a newline"');
  });

  it("renders null/undefined as an empty field", () => {
    const csv = toCsv([{ a: null, b: undefined }]);
    expect(csv).toBe("a,b\n,");
  });

  it("renders multiple rows in order", () => {
    const csv = toCsv([
      { name: "alice", count: 3 },
      { name: "bob", count: 5 },
    ]);
    expect(csv).toBe("name,count\nalice,3\nbob,5");
  });
});
