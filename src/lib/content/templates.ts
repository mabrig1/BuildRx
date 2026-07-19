/**
 * Static starter prompts shown in the Prompt Library alongside the
 * user's own saved prompts — zero-setup examples, not tied to any
 * database row (mirrors the Agent Builder's AGENT_TEMPLATES pattern).
 */

import type { ContentType } from "@/lib/content/prompts";

export interface PromptTemplate {
  id: string;
  title: string;
  category: ContentType | "general";
  promptText: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "blog-howto",
    title: "How-to blog post",
    category: "blog_post",
    promptText: "A practical how-to guide for beginners on {topic}, with numbered steps and common pitfalls to avoid.",
  },
  {
    id: "blog-listicle",
    title: "Listicle",
    category: "blog_post",
    promptText: "A listicle of the top 7 {topic}, each with a short explanation of why it matters.",
  },
  {
    id: "ebook-guide",
    title: "Beginner's guide ebook",
    category: "ebook",
    promptText: "A beginner's guide to {topic}, structured so each chapter builds on the last.",
  },
  {
    id: "social-announcement",
    title: "Product announcement",
    category: "social_post",
    promptText: "An exciting announcement post for launching {topic}, with a clear call to action.",
  },
  {
    id: "social-tip",
    title: "Quick tip",
    category: "social_post",
    promptText: "A single actionable tip about {topic} that stops the scroll in the first line.",
  },
  {
    id: "email-welcome",
    title: "Welcome email",
    category: "email",
    promptText: "A warm welcome email for new users of {topic}, setting expectations for what's next.",
  },
  {
    id: "email-newsletter",
    title: "Newsletter roundup",
    category: "email",
    promptText: "A newsletter roundup covering recent updates to {topic}, friendly and skimmable.",
  },
  {
    id: "ad-benefit",
    title: "Benefit-led ad",
    category: "ad_copy",
    promptText: "Ad copy for {topic} that leads with the single biggest benefit to the customer.",
  },
  {
    id: "video-explainer",
    title: "Explainer video",
    category: "video_script",
    promptText: "A short explainer video script that answers 'what is {topic} and why should I care?' in under 60 seconds.",
  },
];
