/**
 * Content generation engine — one entry point (generateContentPiece)
 * for all six writers. Blog/social/email/ad/video-script are a single
 * model call against a type-specific prompt (see prompts.ts). Ebooks
 * are multi-step: generate a chapter outline, then generate each
 * chapter in a bounded loop — a single completion call would either
 * truncate a multi-chapter book or produce a shallow summary instead
 * of real chapters.
 */

import { getProvider } from "@/lib/ai/providers/registry";
import type { AiProviderId } from "@/lib/ai/providers/types";
import {
  buildContentPrompt,
  buildEbookChapterPrompt,
  buildEbookOutlinePrompt,
  CONTENT_TYPE_LABELS,
  type ContentInputs,
  type ContentType,
} from "@/lib/content/prompts";

const MAX_EBOOK_CHAPTERS = 8;

export interface GeneratedContent {
  title: string;
  content: string;
  model: string;
}

async function runPrompt(
  providerId: AiProviderId,
  model: string | undefined,
  system: string,
  prompt: string,
  maxTokens: number
): Promise<{ text: string; model: string }> {
  const provider = getProvider(providerId);
  if (!provider.isConfigured()) {
    throw new Error(`${provider.label} isn't configured on this deployment.`);
  }
  const result = await provider.createCompletion([{ role: "user", content: prompt }], {
    model,
    system,
    maxTokens,
    temperature: 0.7,
  });
  return { text: result.text.trim(), model: result.model };
}

/** Pulls a title out of generated content (markdown H1 or "Subject:" line) with a sensible fallback. Pure/testable. */
export function deriveContentTitle(
  type: ContentType,
  inputs: ContentInputs,
  content: string
): string {
  const heading = /^#\s+(.+)$/m.exec(content);
  if (heading) return heading[1].trim();
  const subject = /^Subject:\s*(.+)$/m.exec(content);
  if (subject) return subject[1].trim();
  return inputs.topic ? `${CONTENT_TYPE_LABELS[type]}: ${inputs.topic}` : CONTENT_TYPE_LABELS[type];
}

interface EbookOutline {
  title: string;
  chapters: { title: string; summary: string }[];
}

/** Tolerates a model wrapping the JSON in prose/fences despite instructions. Pure/testable. */
export function parseEbookOutline(raw: string): EbookOutline {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.title === "string" && Array.isArray(parsed.chapters)) {
      return parsed;
    }
  } catch {
    // fall through to brace extraction
  }
  const match = /\{[\s\S]*\}/.exec(raw);
  if (match) {
    const parsed = JSON.parse(match[0]);
    if (parsed && typeof parsed.title === "string" && Array.isArray(parsed.chapters)) {
      return parsed;
    }
  }
  throw new Error("Couldn't plan the ebook outline — try again.");
}

async function generateEbook({
  providerId,
  model,
  inputs,
}: {
  providerId: AiProviderId;
  model?: string;
  inputs: ContentInputs;
}): Promise<GeneratedContent> {
  const outlineSpec = buildEbookOutlinePrompt(inputs);
  const outlineResult = await runPrompt(
    providerId,
    model,
    outlineSpec.system,
    outlineSpec.prompt,
    1000
  );
  const outline = parseEbookOutline(outlineResult.text);
  const chapters = outline.chapters.slice(0, MAX_EBOOK_CHAPTERS);
  if (chapters.length === 0) {
    throw new Error("The ebook outline came back with no chapters — try again.");
  }

  const chapterTexts: string[] = [];
  let resolvedModel = outlineResult.model;
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const chapterSpec = buildEbookChapterPrompt(
      inputs,
      outline.title,
      chapter.title,
      chapter.summary,
      i + 1,
      chapters.length
    );
    const chapterResult = await runPrompt(
      providerId,
      model,
      chapterSpec.system,
      chapterSpec.prompt,
      1800
    );
    chapterTexts.push(chapterResult.text);
    resolvedModel = chapterResult.model;
  }

  return {
    title: outline.title,
    content: `# ${outline.title}\n\n${chapterTexts.join("\n\n")}`,
    model: resolvedModel,
  };
}

export async function generateContentPiece({
  providerId,
  model,
  type,
  inputs,
}: {
  providerId: AiProviderId;
  model?: string;
  type: ContentType;
  inputs: ContentInputs;
}): Promise<GeneratedContent> {
  if (type === "ebook") {
    return generateEbook({ providerId, model, inputs });
  }

  const { system, prompt } = buildContentPrompt(type, inputs);
  const { text, model: resolvedModel } = await runPrompt(providerId, model, system, prompt, 3000);
  return { title: deriveContentTitle(type, inputs, text), content: text, model: resolvedModel };
}
