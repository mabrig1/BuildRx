import { describe, expect, it } from "vitest";
import { getKnowledgeLesson, KNOWLEDGE_LESSONS } from "./lessons";

describe("curated BuildRx beginner knowledge base", () => {
  it("includes key app-to-live milestones without a cloud-host claim", () => {
    expect(KNOWLEDGE_LESSONS.length).toBeGreaterThanOrEqual(9);
    for (const id of [
      "first-app", "preview-versus-real-app", "github-basics",
      "vercel-launch", "cloudflare-launch", "mongodb-basics",
      "supabase-auth", "environment-secrets", "fix-build-errors",
      "launch-checklist",
    ]) expect(getKnowledgeLesson(id)).toBeTruthy();
    expect(getKnowledgeLesson("__proto__")).toBeUndefined();
  });
  it("contains usable self-study material and valid quiz answers", () => {
    const ids = new Set(KNOWLEDGE_LESSONS.map(l => l.id));
    expect(ids.size).toBe(KNOWLEDGE_LESSONS.length);
    for (const item of KNOWLEDGE_LESSONS) {
      expect(item.steps.length).toBeGreaterThanOrEqual(4);
      expect(item.pitfalls.length).toBeGreaterThanOrEqual(2);
      expect(item.quiz.options.length).toBeGreaterThanOrEqual(3);
      expect(item.quiz.answer).toBeGreaterThanOrEqual(0);
      expect(item.quiz.answer).toBeLessThan(item.quiz.options.length);
      expect(item.docs.every(d => d.url.startsWith("https://") || d.url.startsWith("/"))).toBe(true);
    }
  });
});
