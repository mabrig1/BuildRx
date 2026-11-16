/**
 * Converts plain-language beginner answers into an editable, actionable
 * app-building specification. No AI credits, network, payment or mutation.
 */
import { MAX_AI_PROMPT_CHARACTERS } from "@/lib/validations/limits";

export type DataMode = "none" | "accounts" | "records" | "orders";
export type DesignMode = "clean" | "modern" | "bold";
export interface EasyBriefInput {
  idea: string;
  audience: string;
  mainJob: string;
  dataMode: DataMode;
  design: DesignMode;
  payments: boolean;
}
export const EASY_BRIEF_DEFAULT: EasyBriefInput = {
  idea: "", audience: "", mainJob: "", dataMode: "records", design: "modern", payments: false,
};

const clean = (value: string, limit: number) => value.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, limit);

export function canComposeEasyBrief(input: EasyBriefInput): boolean {
  return input.idea.trim().length >= 10 &&
    input.mainJob.trim().length >= 8 &&
    input.audience.trim().length >= 3 &&
    input.idea.length <= 500 && input.mainJob.length <= 500 && input.audience.length <= 150;
}

export function suggestedProjectName(idea: string): string {
  const text = clean(idea, 200)
    .replace(/^(?:i want to (?:create|build|make)|please (?:create|build|make)|build|create|make)\s+(?:me\s+)?/i, "")
    .replace(/^(?:a|an|the)\s+/i, "")
    .split(/\s+(?:that|where|which|so|because)\b/i)[0]
    .split(/[.,;!?]/)[0]
    .split(/\s+/).slice(0, 5).join(" ");
  const name = text.replace(/[^\p{L}\p{N}\s&-]/gu, "").trim();
  if (name.length < 2) return "My Smart App";
  return name.slice(0, 60).replace(/\b\p{L}/gu, letter => letter.toUpperCase());
}

export function composeEasyBrief(input: EasyBriefInput): string {
  if (!canComposeEasyBrief(input)) throw new Error("Complete your idea, users and main task first.");
  const idea = clean(input.idea, 500);
  const audience = clean(input.audience, 150);
  const workflow = clean(input.mainJob, 500);
  const dataNeeds: Record<DataMode, string> = {
    none: "No sign-in or long-term saved data. Do not invent fake storage; keep the site useful as a static app.",
    accounts: "Real user accounts, profile details and role-protected pages. Use properly configured authentication and per-user access policies.",
    records: "Real persistent application records with create, list, edit, delete and search as appropriate. Enforce per-user or per-role access rules.",
    orders: "Products or services, customer checkout/order records and an administrator fulfillment view. Validate prices server-side and keep payment status honest.",
  };
  const styleNeeds: Record<DesignMode, string> = {
    clean: "Clean, accessible and simple layout, with clear navigation and readable typography.",
    modern: "Modern, premium but approachable design with cards, spacing, responsive images, mobile navigation and polished empty states.",
    bold: "Bold branded hero, strong contrast, large product illustrations and an energetic professional UI, while remaining accessible.",
  };
  const result = [
    "BUILD A COMPLETE, FUNCTIONAL APP — NOT A HELLO WORLD OR STATIC MOCKUP",
    "",
    "PRODUCT IDEA",
    idea,
    "",
    "PRIMARY USERS",
    audience,
    "",
    "MAIN END-TO-END JOB",
    workflow,
    "",
    "DATA AND ACCOUNTS",
    dataNeeds[input.dataMode],
    "",
    "DESIGN DIRECTION",
    styleNeeds[input.design],
    "Mobile-first responsive web experience; clear onboarding, loading, empty, success and error states.",
    "",
    "PAGES AND PERMISSIONS",
    "- Create the pages and navigation required to complete the main job without dead ends.",
    "- Include a user dashboard and an administrator dashboard only when the product needs these roles.",
    "- Do not show administrator controls to ordinary customers or rely on an email string as the only permission check.",
    "",
    "PAYMENTS",
    input.payments
      ? "- Include provider-ready payment screens and documented setup, but never mark payment successful until a real verified provider callback or webhook confirms it. No fabricated charges or access grants."
      : "- No live payment processing is needed. Do not claim to have processed payments.",
    "",
    "REAL FUNCTIONALITY",
    "- Every prominent button, form, filter and navigation item should perform its stated purpose or clearly report why an external integration is not configured.",
    "- Implement the complete main job from first action to persisted outcome with a working back end if records are needed.",
    "- Validate inputs server-side, protect private data, and avoid hardcoded secrets or hidden service keys in browser code.",
    "- Include safe, visibly labeled DEMO sample products/records if this helps a new user understand the product; never present sample payments or accounts as real.",
    "",
    "QUALITY AND ACCEPTANCE CHECKS",
    "- Produce the actual pages and code files, package.json with build/test scripts, a readable README and .env.example containing only variable names.",
    "- Include a meaningful interactive preview that represents the intended app, not merely a greeting screen.",
    "- Check imports, missing modules, syntax, runtime requirements and security before showing a build as ready.",
    "- Provide simple reproduction steps for any remaining error instead of pretending it was fixed.",
    "- Verify that the core workflow works, that saved data survives a refresh, and that unauthorized users cannot read other customers' data (where persistence applies).",
    "- Explain how to save the project to GitHub, configure the chosen database, and deploy to Vercel or Cloudflare with explicit owner approval.",
    "- After completion, show the beginner the next concrete step and how to recover or roll back if something fails.",
  ].join("\n");
  return result.slice(0, MAX_AI_PROMPT_CHARACTERS);
}
