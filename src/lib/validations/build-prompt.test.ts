import { describe, expect, it } from "vitest";
import { isBuildBrief, isRepairCommand } from "./build-prompt";
describe("repair intent stays in the saved project", () => {
  it.each(["Repair", "fix it", "please troubleshoot this app", "Fix this error in the current preview", "debug my project", "repair the build error"])("recognizes %s", text => {
    expect(isRepairCommand(text)).toBe(true);
    expect(isBuildBrief(text)).toBe(false);
  });
  it.each(["Build an error management app", "Create a debugging dashboard", "A statistics app for researchers"])("keeps a product request as a build: %s", text => {
    expect(isRepairCommand(text)).toBe(false);
    expect(isBuildBrief(text)).toBe(true);
  });
});
