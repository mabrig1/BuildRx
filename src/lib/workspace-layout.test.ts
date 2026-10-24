import { describe, expect, it } from "vitest";
import {
  clampCodePercent,
  codePercentFromPointer,
  DEFAULT_WORKBENCH_LAYOUT,
  parseWorkbenchLayout,
} from "@/lib/workspace-layout";

describe("separated code / preview workbench", () => {
  it("defaults to two independent visible panes", () => {
    expect(parseWorkbenchLayout(null)).toEqual(DEFAULT_WORKBENCH_LAYOUT);
    expect(parseWorkbenchLayout("not-json")).toEqual(DEFAULT_WORKBENCH_LAYOUT);
  });
  it("restores only safe modes and widths", () => {
    expect(parseWorkbenchLayout('{"mode":"code","codePercent":39}')).toEqual({
      mode: "code", codePercent: 39,
    });
    expect(parseWorkbenchLayout('{"mode":"javascript:evil","codePercent":900}')).toEqual({
      mode: "split", codePercent: 72,
    });
    expect(parseWorkbenchLayout('{"mode":"preview","codePercent":"55"}')).toEqual({
      mode: "preview", codePercent: 54,
    });
  });
  it("provides bounded mouse and keyboard resizing", () => {
    expect(clampCodePercent(12)).toBe(30);
    expect(clampCodePercent(999)).toBe(72);
    expect(clampCodePercent(Number.NaN)).toBe(54);
    expect(codePercentFromPointer(600, 100, 1000)).toBe(50);
    expect(codePercentFromPointer(110, 100, 1000)).toBe(30);
    expect(codePercentFromPointer(500, 100, 0)).toBe(54);
  });
});
