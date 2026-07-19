import { describe, expect, it } from "vitest";

import { chunkText } from "@/lib/rag/chunk";

describe("chunkText", () => {
  it("returns an empty array for empty or whitespace-only text", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("returns a single chunk when the text fits within chunkSize", () => {
    const text = "Paragraph one.\n\nParagraph two.";
    const chunks = chunkText(text, { chunkSize: 1000 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text);
  });

  it("splits into multiple chunks once paragraphs exceed chunkSize", () => {
    const paragraphs = Array.from({ length: 5 }, (_, i) => `Paragraph ${i}. `.repeat(20));
    const text = paragraphs.join("\n\n");
    const chunks = chunkText(text, { chunkSize: 300, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(300 + 50);
    }
  });

  it("carries overlap context from the end of the previous chunk into the next", () => {
    const paragraphs = ["A".repeat(200), "B".repeat(200), "C".repeat(200)];
    const chunks = chunkText(paragraphs.join("\n\n"), { chunkSize: 250, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    // The tail of chunk[0] should reappear at the head of chunk[1].
    const tail = chunks[0].slice(-50);
    expect(chunks[1].startsWith(tail)).toBe(true);
  });

  it("hard-slices a single paragraph longer than chunkSize", () => {
    const longParagraph = "X".repeat(1000);
    const chunks = chunkText(longParagraph, { chunkSize: 300, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(300);
    }
  });

  it("never produces empty chunks", () => {
    const text = "One.\n\n\n\nTwo.\n\n   \n\nThree.";
    const chunks = chunkText(text);
    expect(chunks.every((c) => c.trim().length > 0)).toBe(true);
  });
});
