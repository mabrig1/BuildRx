import { describe, expect, it } from "vitest";
import { canComposeEasyBrief, composeEasyBrief, suggestedProjectName, type EasyBriefInput } from "./easy-brief";
const valid: EasyBriefInput = {
  idea: "I want to build a supermarket app for a local shop",
  audience: "Shop owner and customers",
  mainJob: "Customers find goods, place orders, and the shop owner fulfills them",
  dataMode: "orders",
  design: "modern",
  payments: true,
};

describe("beginner-friendly brief creator", () => {
  it("turns everyday language into a real app spec with verified payment constraints", () => {
    const text = composeEasyBrief(valid);
    expect(text).toContain("supermarket app");
    expect(text).toContain("administrator fulfillment view");
    expect(text).toContain("verified provider callback or webhook");
    expect(text).toContain("NOT A HELLO WORLD");
    expect(text).toContain("Vercel or Cloudflare");
  });
  it("does not claim real payments when not selected", () => {
    const result = composeEasyBrief({ ...valid, payments: false, dataMode: "none" });
    expect(result).toContain("No live payment processing");
    expect(result).toContain("No sign-in or long-term saved data");
  });
  it("prevents weak empty briefs and caps user input", () => {
    expect(canComposeEasyBrief(valid)).toBe(true);
    expect(canComposeEasyBrief({ ...valid, mainJob: "buy" })).toBe(false);
    expect(() => composeEasyBrief({ ...valid, idea: "a".repeat(501) })).toThrow();
  });
  it("suggests a readable project name", () => {
    expect(suggestedProjectName("I want to build a supermarket app that tracks stock")).toBe("Supermarket App");
    expect(suggestedProjectName("!")).toBe("My Smart App");
  });
});
