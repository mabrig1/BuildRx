/**
 * Prompt builders for the Content Studio's six writers. Each writer
 * shares one generation engine (see ai.ts) — only the system/user
 * prompt built from its type-specific inputs differs, so that's kept
 * here as pure, unit-testable functions rather than duplicated across
 * six near-identical AI-calling functions.
 */

export type ContentType =
  | "blog_post"
  | "ebook"
  | "social_post"
  | "email"
  | "ad_copy"
  | "video_script";

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  blog_post: "Blog post",
  ebook: "Ebook",
  social_post: "Social media post",
  email: "Email",
  ad_copy: "Ad copy",
  video_script: "Video script",
};

/** Every writer's input fields, all optional at the type level — each builder validates what it actually needs. */
export interface ContentInputs {
  topic?: string;
  tone?: string;
  targetAudience?: string;
  keywords?: string;
  wordCount?: "short" | "medium" | "long";
  platform?: string;
  includeHashtags?: boolean;
  purpose?: string;
  callToAction?: string;
  product?: string;
  chapterCount?: number;
  videoLength?: "short" | "long";
}

export interface PromptSpec {
  system: string;
  prompt: string;
}

const WORD_COUNT_GUIDANCE: Record<NonNullable<ContentInputs["wordCount"]>, string> = {
  short: "About 400-600 words.",
  medium: "About 800-1200 words.",
  long: "About 1500-2000 words.",
};

function toneLine(inputs: ContentInputs): string {
  return inputs.tone ? ` Tone: ${inputs.tone}.` : "";
}

function audienceLine(inputs: ContentInputs): string {
  return inputs.targetAudience ? ` Target audience: ${inputs.targetAudience}.` : "";
}

export function buildBlogPostPrompt(inputs: ContentInputs): PromptSpec {
  const wordCount = WORD_COUNT_GUIDANCE[inputs.wordCount ?? "medium"];
  return {
    system:
      "You are an expert content writer producing well-structured, engaging blog posts in markdown, with a clear headline, subheadings, and a natural flow. No filler, no generic platitudes.",
    prompt:
      `Write a blog post about: ${inputs.topic ?? "the given topic"}.${toneLine(inputs)}${audienceLine(inputs)} ${wordCount}` +
      (inputs.keywords ? ` Naturally include these keywords/phrases: ${inputs.keywords}.` : "") +
      ` Use a # title and ## subheadings.`,
  };
}

export function buildEbookOutlinePrompt(inputs: ContentInputs): PromptSpec {
  const chapterCount = Math.min(Math.max(inputs.chapterCount ?? 5, 3), 8);
  return {
    system:
      "You are an expert non-fiction author planning an ebook. Respond with ONLY minified JSON, no markdown fences, no commentary.",
    prompt:
      `Plan an ebook about: ${inputs.topic ?? "the given topic"}.${audienceLine(inputs)} ` +
      `Produce exactly ${chapterCount} chapters. Respond with JSON matching: ` +
      `{"title": string, "chapters": [{"title": string, "summary": string}]}`,
  };
}

export function buildEbookChapterPrompt(
  inputs: ContentInputs,
  ebookTitle: string,
  chapterTitle: string,
  chapterSummary: string,
  chapterNumber: number,
  totalChapters: number
): PromptSpec {
  return {
    system:
      "You are an expert non-fiction author writing one chapter of an ebook in markdown. Write substantive, well-organized content — not a summary of the chapter, the actual chapter.",
    prompt:
      `Ebook: "${ebookTitle}".${toneLine(inputs)}${audienceLine(inputs)}\n` +
      `Write chapter ${chapterNumber} of ${totalChapters}: "${chapterTitle}"\n` +
      `Chapter focus: ${chapterSummary}\n\n` +
      `Start with "## ${chapterTitle}" and write 500-900 words of real chapter content.`,
  };
}

export function buildSocialPostPrompt(inputs: ContentInputs): PromptSpec {
  const platform = inputs.platform ?? "general social media";
  return {
    system: `You write scroll-stopping ${platform} posts that match the platform's conventions (length, tone, formatting).`,
    prompt:
      `Write a ${platform} post about: ${inputs.topic ?? "the given topic"}.${toneLine(inputs)}` +
      (inputs.includeHashtags ? " Include 3-5 relevant hashtags." : " Do not include hashtags."),
  };
}

export function buildEmailPrompt(inputs: ContentInputs): PromptSpec {
  return {
    system:
      "You write clear, effective marketing/transactional emails with a compelling subject line and a natural, non-spammy tone.",
    prompt:
      `Write a ${inputs.purpose ?? "marketing"} email about: ${inputs.topic ?? "the given topic"}.${toneLine(inputs)}${audienceLine(inputs)}` +
      (inputs.callToAction ? ` Call to action: ${inputs.callToAction}.` : "") +
      ` Start with "Subject: <line>" then a blank line, then the email body.`,
  };
}

export function buildAdCopyPrompt(inputs: ContentInputs): PromptSpec {
  const platform = inputs.platform ?? "general";
  return {
    system: `You are an expert direct-response copywriter for ${platform} ads — concise, benefit-driven, no wasted words.`,
    prompt:
      `Write ad copy for: ${inputs.product ?? "the given product/service"}.${toneLine(inputs)}${audienceLine(inputs)}` +
      (inputs.callToAction ? ` Call to action: ${inputs.callToAction}.` : "") +
      ` Provide 3 headline variants and one body copy variant, clearly labeled.`,
  };
}

export function buildVideoScriptPrompt(inputs: ContentInputs): PromptSpec {
  const lengthGuidance =
    inputs.videoLength === "short"
      ? "a short-form video (under 60 seconds) — tight, hook in the first line"
      : "a longer-form video (3-8 minutes)";
  const platform = inputs.platform ?? "general";
  return {
    system: `You write video scripts for ${platform}, with clear scene/beat markers and natural spoken dialogue — not an essay.`,
    prompt:
      `Write a script for ${lengthGuidance} about: ${inputs.topic ?? "the given topic"}.${toneLine(inputs)}${audienceLine(inputs)} ` +
      `Format as labeled beats (e.g. "HOOK:", "BODY:", "CTA:") with the spoken line under each.`,
  };
}

export function buildContentPrompt(type: ContentType, inputs: ContentInputs): PromptSpec {
  switch (type) {
    case "blog_post":
      return buildBlogPostPrompt(inputs);
    case "social_post":
      return buildSocialPostPrompt(inputs);
    case "email":
      return buildEmailPrompt(inputs);
    case "ad_copy":
      return buildAdCopyPrompt(inputs);
    case "video_script":
      return buildVideoScriptPrompt(inputs);
    case "ebook":
      throw new Error("Ebooks are generated via buildEbookOutlinePrompt/buildEbookChapterPrompt, not buildContentPrompt.");
  }
}
