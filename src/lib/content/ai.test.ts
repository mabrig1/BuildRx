import { describe, expect, it } from "vitest";

import { deriveContentTitle, parseEbookOutline } from "@/lib/content/ai";

describe("deriveContentTitle", () => {
  it("prefers a markdown H1 heading", () => {
    const title = deriveContentTitle("blog_post", { topic: "gardening" }, "# The Beginner's Guide\n\nSome text.");
    expect(title).toBe("The Beginner's Guide");
  });

  it("falls back to a Subject: line for emails", () => {
    const title = deriveContentTitle("email", { topic: "launch" }, "Subject: We just launched!\n\nBody text.");
    expect(title).toBe("We just launched!");
  });

  it("falls back to type label + topic when neither is present", () => {
    const title = deriveContentTitle("ad_copy", { topic: "shoes" }, "Just some copy with no heading.");
    expect(title).toBe("Ad copy: shoes");
  });

  it("falls back to just the type label when there is no topic either", () => {
    const title = deriveContentTitle("ad_copy", {}, "Just some copy with no heading.");
    expect(title).toBe("Ad copy");
  });
});

describe("parseEbookOutline", () => {
  it("parses clean JSON", () => {
    const outline = parseEbookOutline(
      '{"title":"My Book","chapters":[{"title":"Intro","summary":"Sets the stage."}]}'
    );
    expect(outline.title).toBe("My Book");
    expect(outline.chapters).toHaveLength(1);
  });

  it("extracts JSON embedded in surrounding prose", () => {
    const outline = parseEbookOutline(
      'Sure, here is the outline:\n{"title":"My Book","chapters":[{"title":"Intro","summary":"x"}]}\nHope that helps!'
    );
    expect(outline.title).toBe("My Book");
  });

  it("throws a friendly error when no valid JSON can be found", () => {
    expect(() => parseEbookOutline("I couldn't come up with an outline, sorry.")).toThrow(
      "Couldn't plan the ebook outline — try again."
    );
  });

  it("throws when the JSON is well-formed but missing the expected shape", () => {
    expect(() => parseEbookOutline('{"foo": "bar"}')).toThrow(
      "Couldn't plan the ebook outline — try again."
    );
  });
});
