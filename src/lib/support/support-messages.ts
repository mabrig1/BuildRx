import { brandConfig } from "@/lib/constants";

export type SupportIssue =
  | "paid-course"
  | "account"
  | "builder"
  | "lab"
  | "deployment"
  | "billing"
  | "other";

export const SUPPORT_TOPICS: readonly {
  id: SupportIssue;
  title: string;
  hint: string;
  nextSteps: readonly string[];
}[] = [
  {
    id: "paid-course",
    title: "Paid for the Academy but cannot enter",
    hint: "Use the email on your BuildRx account and the payment reference (never a bank/card PIN).",
    nextSteps: [
      "Sign in to the same BuildRx account used during checkout.",
      "Open /course to check your enrollment status.",
      "If the payment was successful but access is still locked, share your provider and transaction reference privately with support.",
    ],
  },
  {
    id: "account",
    title: "Cannot sign in or reset my password",
    hint: "Use the self-service reset first. Never send your password or one-time passcode.",
    nextSteps: [
      "Visit /forgot-password and enter the email registered on your account.",
      "Check inbox and spam for the recovery link.",
      "If the reset fails, describe the error without providing passwords, OTPs or secret recovery links.",
    ],
  },
  {
    id: "builder",
    title: "BuildRx AI app creation problem",
    hint: "Tell us which feature fails, what you expected and the non-sensitive error text.",
    nextSteps: [
      "Keep your saved project; do not delete it to fix an error.",
      "Try the project Build Doctor or check the build/preview log.",
      "Provide the failed step and an error summary, without any keys or private customer data.",
    ],
  },
  {
    id: "lab",
    title: "Hands-on coding lab or training help",
    hint: "Tell us the module, exercise or milestone and the exact point where you got stuck.",
    nextSteps: [
      "Review the exercise acceptance checks.",
      "Open the matching playground or Project Studio starter.",
      "Share the exercise name and what you tried; do not send private source code or credentials.",
    ],
  },
  {
    id: "deployment",
    title: "GitHub, Vercel or Cloudflare deployment",
    hint: "Share the provider, branch and error summary; no deployment tokens or credentials.",
    nextSteps: [
      "Check whether GitHub CI passed, then inspect the hosting deployment status.",
      "Separate a successful build from a correctly functioning live app.",
      "Send the failing step and a public deployment link if available; never share API keys.",
    ],
  },
  {
    id: "billing",
    title: "Subscription, payment or refund enquiry",
    hint: "Use the provider name and transaction reference, not card data or PIN.",
    nextSteps: [
      "Confirm whether you purchased a SaaS plan or the one-time Academy course.",
      "Check the payment provider's transaction status.",
      "Describe the mismatch and share a non-sensitive reference with support.",
    ],
  },
  {
    id: "other",
    title: "Partnership or other enquiry",
    hint: "Describe the request and how you prefer to be contacted.",
    nextSteps: [
      "Describe the support request in one or two sentences.",
      "Include the relevant product, course or business name.",
      "Choose WhatsApp or email to send the message.",
    ],
  },
] as const;

export type SupportDraft = {
  issue: SupportIssue;
  name: string;
  email: string;
  description: string;
  reference: string;
};

const stripControls = (text: string, maxLength: number): string =>
  text.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);

export function validSupportDraft(input: SupportDraft): boolean {
  return SUPPORT_TOPICS.some(t => t.id === input.issue) &&
    stripControls(input.description, 1200).length >= 12 &&
    input.description.length <= 1200 &&
    input.name.length <= 80 &&
    input.email.length <= 150 &&
    input.reference.length <= 140;
}

/** The user reviews and sends this draft through their own WhatsApp or email app. */
export function supportMessage(input: SupportDraft): string {
  const topic = SUPPORT_TOPICS.find(t => t.id === input.issue)?.title ?? "BuildRx support";
  return [
    "Hello MABRIG Technologies BuildRx Support,",
    "Topic: " + topic,
    ...(input.name.trim() ? ["Name: " + stripControls(input.name, 80)] : []),
    ...(input.email.trim() ? ["BuildRx email: " + stripControls(input.email, 150)] : []),
    ...(input.reference.trim() ? ["Payment/project reference: " + stripControls(input.reference, 140)] : []),
    "Issue: " + stripControls(input.description, 1200),
    "Please advise on the next safe step. I have not included passwords, one-time codes or API keys.",
  ].join("\n");
}

export function supportWhatsAppUrl(input: SupportDraft): string {
  const phone = brandConfig.contacts.whatsapp.href.replace("https://wa.me/", "");
  return "https://wa.me/" + phone + "?text=" + encodeURIComponent(supportMessage(input));
}

export function supportEmailUrl(input: SupportDraft): string {
  return "mailto:" + brandConfig.contacts.contactEmail.value +
    "?subject=" + encodeURIComponent("BuildRx support: " + SUPPORT_TOPICS.find(t => t.id === input.issue)?.title) +
    "&body=" + encodeURIComponent(supportMessage(input));
}
