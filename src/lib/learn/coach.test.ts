import { describe, expect, it } from "vitest";
import { coachMessages, containsLikelyCredential, validateCoachRequest } from "./coach";
import { getKnowledgeLesson } from "./lessons";

describe("safe and grounded beginner AI training", () => {
  it("accepts only actual lesson IDs and bounded options", () => {
    expect(validateCoachRequest({ lessonId: "cloudflare-launch", mode: "lesson" }).ok).toBe(true);
    expect(validateCoachRequest({ lessonId: "not-on-the-list" }).ok).toBe(false);
    expect(validateCoachRequest({ lessonId: "github-basics", goal: "x".repeat(161) }).ok).toBe(false);
    expect(validateCoachRequest({ lessonId: "github-basics", administrator: true }).ok).toBe(false);
  });
  it("rejects likely credentials rather than forwarding them to AI", () => {
    for (const value of [
      "mongodb+srv://user:pass@cluster.example/", "github_pat_abcdef12345",
      "Bearer verysecret1234", "api_key=verysecret1234", "https://example.com?token=123456",
    ]) {
      expect(containsLikelyCredential(value)).toBe(true);
      expect(validateCoachRequest({ lessonId: "mongodb-basics", goal: value }).ok).toBe(false);
    }
    expect(containsLikelyCredential("I need to understand how GitHub commits work")).toBe(false);
  });
  it("grounds generated lessons and forbids false provider status", () => {
    const validated = validateCoachRequest({
      lessonId: "cloudflare-launch", level: "first-time",
      mode: "five-day-plan", goal: "Launch my first school booking app",
    });
    if (!validated.ok) throw new Error("Expected valid request");
    const messages = coachMessages(validated.lesson, validated.request);
    expect(messages[0].content).toMatch(/Never claim to have connected/);
    expect(messages[0].content).toMatch(/Cloudflare preparation/);
    expect(messages[1].content).toMatch(/five-day/);
    expect(messages[1].content).toMatch(/workers\/ci-cd/);
    expect(getKnowledgeLesson(validated.lesson.id)).toBeDefined();
  });
});
