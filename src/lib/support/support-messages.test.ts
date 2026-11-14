import { describe, expect, it } from "vitest";
import { SUPPORT_TOPICS, supportWhatsAppUrl, supportEmailUrl, supportMessage, validSupportDraft } from "./support-messages";

const input = {
  issue: "paid-course" as const,
  name: "Learner",
  email: "learner@example.com",
  reference: "pay_ref_123",
  description: "I paid for the Academy but the course still says locked.",
};

describe("BuildRx human-operated support", () => {
  it("advertises the verified WhatsApp number with a URL-encoded message", () => {
    expect(supportWhatsAppUrl(input)).toContain("https://wa.me/2347065342818?text=");
    expect(decodeURIComponent(supportWhatsAppUrl(input).split("?text=")[1])).toBe(supportMessage(input));
    expect(supportEmailUrl(input)).toContain("mailto:contact@mabrigkorie.org");
  });
  it("covers account recovery, checkout, lab and deployment paths", () => {
    for (const issue of ["paid-course", "account", "builder", "lab", "deployment", "billing", "other"]) {
      expect(SUPPORT_TOPICS.some(x => x.id === issue)).toBe(true);
    }
    expect(SUPPORT_TOPICS.find(x => x.id === "account")?.nextSteps.join(" ")).toContain("/forgot-password");
  });
  it("rejects blank/overlong drafts and strips control characters", () => {
    expect(validSupportDraft(input)).toBe(true);
    expect(validSupportDraft({ ...input, description: "short" })).toBe(false);
    expect(validSupportDraft({ ...input, reference: "a".repeat(200) })).toBe(false);
    expect(supportMessage({ ...input, description: "First line\nAnother line" })).not.toContain("First line\nAnother line");
  });
});
