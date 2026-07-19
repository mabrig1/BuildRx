import { describe, expect, it } from "vitest";

import { buildRagPrompt, summarizeCitations, type CitationChunk } from "@/lib/rag/prompt";

const chunks: CitationChunk[] = [
  {
    documentId: "doc-1",
    documentName: "Handbook.pdf",
    chunkIndex: 0,
    content: "Refunds are processed within 5 business days.",
    similarity: 0.91,
  },
  {
    documentId: "doc-2",
    documentName: "FAQ.docx",
    chunkIndex: 3,
    content: "Contact support at help@example.com for refund status.",
    similarity: 0.85,
  },
];

describe("buildRagPrompt", () => {
  it("numbers each chunk and includes its source document name", () => {
    const { prompt } = buildRagPrompt("How do refunds work?", chunks);
    expect(prompt).toContain('[1] (from "Handbook.pdf")');
    expect(prompt).toContain('[2] (from "FAQ.docx")');
    expect(prompt).toContain("Refunds are processed within 5 business days.");
    expect(prompt).toContain("How do refunds work?");
  });

  it("instructs the model to answer only from context and cite sources", () => {
    const { system } = buildRagPrompt("q", chunks);
    expect(system).toMatch(/only/i);
    expect(system).toMatch(/cite/i);
  });
});

describe("summarizeCitations", () => {
  it("de-duplicates by document while preserving first-seen order", () => {
    const repeated: CitationChunk[] = [
      chunks[0],
      chunks[1],
      { ...chunks[0], chunkIndex: 1, content: "different chunk, same doc" },
    ];
    const summary = summarizeCitations(repeated);
    expect(summary).toEqual([
      { documentId: "doc-1", documentName: "Handbook.pdf" },
      { documentId: "doc-2", documentName: "FAQ.docx" },
    ]);
  });

  it("returns an empty array for no chunks", () => {
    expect(summarizeCitations([])).toEqual([]);
  });
});
