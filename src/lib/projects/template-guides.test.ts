import { describe, expect, it } from "vitest";
import { BEGINNER_CODE_TEMPLATES } from "./beginner-catalog";
import { GITHUB_APP_TEMPLATES } from "./github-app-templates";
import {
  TEMPLATE_GUIDES, approvedTemplateIds, findTemplateGuide, type TemplateCategory,
} from "./template-guides";

describe("evidence-scoped beginner template catalog", () => {
  it("covers requested categories while separating real clone IDs from future concepts", () => {
    const categories: TemplateCategory[] = [
      "Business apps", "Education", "E-commerce", "Inventory",
      "Booking", "Dashboards", "AI tools",
    ];
    expect(new Set(TEMPLATE_GUIDES.map(t => t.id)).size).toBe(TEMPLATE_GUIDES.length);
    for (const category of categories) expect(TEMPLATE_GUIDES.some(t => t.category === category)).toBe(true);
    expect(TEMPLATE_GUIDES.every(t => t.deployed === "Not verified")).toBe(true);
  });

  it("exposes exactly eight existing server-allowlisted clone IDs", () => {
    const approved = approvedTemplateIds();
    const allowed = [...BEGINNER_CODE_TEMPLATES, ...GITHUB_APP_TEMPLATES].map(t => t.id);
    expect(approved.sort()).toEqual(allowed.sort());
    expect(approved).toHaveLength(8);
    expect(findTemplateGuide("github-random-unreviewed")).toBeUndefined();
  });

  it("never attributes a cloneable URL, credentials or deployment to planned ideas", () => {
    const plans = TEMPLATE_GUIDES.filter(t => t.state === "planned");
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      expect(plan.sourceUrl).toBeNull();
      expect(plan.origin).toBe("Planned");
      expect(approvedTemplateIds()).not.toContain(plan.id);
      expect(plan.deployed).toBe("Not verified");
    }
  });

  it("pins external GitHub source provenance and keeps environment keys names-only", () => {
    const expected = /^https:\/\/github\.com\/vercel\/next\.js\/tree\/[a-f0-9]{40}\/examples\/[a-z0-9-]+$/;
    for (const t of TEMPLATE_GUIDES) {
      expect(t.envKeys.every(k => /^[A-Z][A-Z0-9_]*$/.test(k))).toBe(true);
      expect(t.setup.length).toBeGreaterThan(0);
      expect(t.safeStart.some(s => /no|never|private/i.test(s))).toBe(true);
      if (t.origin === "Pinned GitHub") expect(t.sourceUrl).toMatch(expected);
      if (t.state === "source-reviewed") expect(t.sourceUrl).toContain("https://github.com/");
    }
  });
});
