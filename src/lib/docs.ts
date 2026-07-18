import { BookOpen, Braces, Cloud, KeyRound, type LucideIcon } from "lucide-react";

/** The markdown guides in /docs, rendered at /docs/[slug]. */
export interface DocPage {
  slug: string;
  icon: LucideIcon;
  title: string;
  description: string;
}

export const docPages: DocPage[] = [
  {
    slug: "installation",
    icon: BookOpen,
    title: "Installation",
    description:
      "Prerequisites, Supabase setup, migrations, auth providers, first run, and troubleshooting.",
  },
  {
    slug: "environment-variables",
    icon: KeyRound,
    title: "Environment variables",
    description:
      "Every variable, where to get it, and exactly what falls back to demo mode without it.",
  },
  {
    slug: "deployment",
    icon: Cloud,
    title: "Deployment",
    description:
      "Deploying to Vercel, payment webhooks, custom domains, and the post-deploy checklist.",
  },
  {
    slug: "api",
    icon: Braces,
    title: "API reference",
    description:
      "Every endpoint: auth, request/response shapes, streaming formats, and error codes.",
  },
];
