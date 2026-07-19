import { describe, expect, it } from "vitest";

import {
  buildAdCopyPrompt,
  buildBlogPostPrompt,
  buildContentPrompt,
  buildEbookChapterPrompt,
  buildEbookOutlinePrompt,
  buildEmailPrompt,
  buildSocialPostPrompt,
  buildVideoScriptPrompt,
} from "@/lib/content/prompts";

describe("buildBlogPostPrompt", () => {
  it("includes topic, tone, audience, and keywords when provided", () => {
    const spec = buildBlogPostPrompt({
      topic: "remote work",
      tone: "friendly",
      targetAudience: "startup founders",
      keywords: "async, focus",
      wordCount: "short",
    });
    expect(spec.prompt).toContain("remote work");
    expect(spec.prompt).toContain("Tone: friendly.");
    expect(spec.prompt).toContain("Target audience: startup founders.");
    expect(spec.prompt).toContain("async, focus");
    expect(spec.prompt).toContain("400-600 words");
  });

  it("defaults to medium length and omits optional fields cleanly", () => {
    const spec = buildBlogPostPrompt({ topic: "cats" });
    expect(spec.prompt).toContain("800-1200 words");
    expect(spec.prompt).not.toContain("Tone:");
    expect(spec.prompt).not.toContain("Target audience:");
  });
});

describe("buildEbookOutlinePrompt", () => {
  it("clamps chapter count into the 3-8 range", () => {
    expect(buildEbookOutlinePrompt({ topic: "x", chapterCount: 1 }).prompt).toContain(
      "exactly 3 chapters"
    );
    expect(buildEbookOutlinePrompt({ topic: "x", chapterCount: 20 }).prompt).toContain(
      "exactly 8 chapters"
    );
    expect(buildEbookOutlinePrompt({ topic: "x", chapterCount: 5 }).prompt).toContain(
      "exactly 5 chapters"
    );
  });

  it("defaults to 5 chapters when unspecified", () => {
    expect(buildEbookOutlinePrompt({ topic: "x" }).prompt).toContain("exactly 5 chapters");
  });
});

describe("buildEbookChapterPrompt", () => {
  it("numbers the chapter and includes the title, summary, and book title", () => {
    const spec = buildEbookChapterPrompt(
      { topic: "gardening" },
      "The Gardener's Handbook",
      "Getting Started",
      "Covers tools and soil prep.",
      2,
      6
    );
    expect(spec.prompt).toContain('"The Gardener\'s Handbook"');
    expect(spec.prompt).toContain("chapter 2 of 6");
    expect(spec.prompt).toContain("Getting Started");
    expect(spec.prompt).toContain("Covers tools and soil prep.");
  });
});

describe("buildSocialPostPrompt", () => {
  it("requests hashtags when includeHashtags is true", () => {
    const spec = buildSocialPostPrompt({ topic: "launch", platform: "X", includeHashtags: true });
    expect(spec.prompt).toContain("Include 3-5 relevant hashtags.");
    expect(spec.system).toContain("X");
  });

  it("explicitly excludes hashtags when false", () => {
    const spec = buildSocialPostPrompt({ topic: "launch", includeHashtags: false });
    expect(spec.prompt).toContain("Do not include hashtags.");
  });
});

describe("buildEmailPrompt", () => {
  it("defaults purpose to marketing and includes the call to action when given", () => {
    const spec = buildEmailPrompt({ topic: "new feature", callToAction: "Try it now" });
    expect(spec.prompt).toContain("marketing email");
    expect(spec.prompt).toContain("Call to action: Try it now.");
  });
});

describe("buildAdCopyPrompt", () => {
  it("centers the prompt on the product rather than a topic", () => {
    const spec = buildAdCopyPrompt({ product: "Noise-cancelling headphones", platform: "Instagram" });
    expect(spec.prompt).toContain("Noise-cancelling headphones");
    expect(spec.system).toContain("Instagram");
  });
});

describe("buildVideoScriptPrompt", () => {
  it("differentiates short-form and long-form guidance", () => {
    expect(buildVideoScriptPrompt({ topic: "x", videoLength: "short" }).prompt).toContain(
      "under 60 seconds"
    );
    expect(buildVideoScriptPrompt({ topic: "x", videoLength: "long" }).prompt).toContain(
      "3-8 minutes"
    );
  });
});

describe("buildContentPrompt", () => {
  it("dispatches to the matching builder for each non-ebook type", () => {
    expect(buildContentPrompt("blog_post", { topic: "x" }).system).toContain("blog posts");
    expect(buildContentPrompt("social_post", { topic: "x" }).system).toContain("posts");
    expect(buildContentPrompt("email", { topic: "x" }).system).toContain("emails");
    expect(buildContentPrompt("ad_copy", { product: "x" }).system).toContain("copywriter");
    expect(buildContentPrompt("video_script", { topic: "x" }).system).toContain("video scripts");
  });

  it("throws for ebook, which requires the two-step outline/chapter flow", () => {
    expect(() => buildContentPrompt("ebook", { topic: "x" })).toThrow(/Ebooks are generated via/);
  });
});
