/**
 * Curated open-source starter snapshots. Never accept a client-supplied
 * repository URL, branch, or git SHA when importing: only these reviewed,
 * commit-pinned directories are eligible.
 *
 * Sources: vetted, commit-pinned MIT-licensed GitHub repositories.
 * Keep the original license and attribution. These are real code sources,
 * not finished BuildRx-generated apps; users must review and test them.
 */
export interface GithubAppTemplate {
  id: string;
  name: string;
  description: string;
  category: "Content" | "Authentication" | "AI Assistant" | "AI Agents" | "AI SaaS";
  repository: "vercel/next.js" | "shadcn-ui/chatbot-template" | "thorchh/agent-starter" | "AdityaKodez/gridly";
  subdirectory: string;
  commit: string;
  license: "MIT";
  sourceUrl: string;
  setupNote: string;
}

const NEXTJS_SNAPSHOT = "cc65c414d283e22e587828c94770d9b12522bbb4";

export const GITHUB_APP_TEMPLATES: readonly GithubAppTemplate[] = [
  {
    id: "github-blog-starter",
    name: "Editorial Blog (GitHub)",
    description: "Real Next.js editorial website, article pages, Markdown content and SEO foundations.",
    category: "Content",
    repository: "vercel/next.js",
    subdirectory: "examples/blog-starter",
    commit: NEXTJS_SNAPSHOT,
    license: "MIT",
    sourceUrl: `https://github.com/vercel/next.js/tree/${NEXTJS_SNAPSHOT}/examples/blog-starter`,
    setupNote: "Review the original example's Next.js version, content paths and any image assets before going live.",
  },
  {
    id: "github-supabase-starter",
    name: "Login & Database Starter (GitHub)",
    description: "Real Next.js source with Supabase sign-in patterns, reusable UI and protected routes.",
    category: "Authentication",
    repository: "vercel/next.js",
    subdirectory: "examples/with-supabase",
    commit: NEXTJS_SNAPSHOT,
    license: "MIT",
    sourceUrl: `https://github.com/vercel/next.js/tree/${NEXTJS_SNAPSHOT}/examples/with-supabase`,
    setupNote: "A user-owned Supabase project and environment settings are required. Authentication is not connected merely by importing.",
  },
  {
    id: "github-shadcn-ai-chatbot",
    name: "AI Chatbot & Tools (GitHub)",
    description: "Modern conversational website with streamed replies, typed AI tools and customizable shadcn UI.",
    category: "AI Assistant",
    repository: "shadcn-ui/chatbot-template",
    subdirectory: "",
    commit: "4106041b1bc9bab44e81ffd2764aa2b6f100e2b0",
    license: "MIT",
    sourceUrl: "https://github.com/shadcn-ui/chatbot-template/tree/4106041b1bc9bab44e81ffd2764aa2b6f100e2b0",
    setupNote: "Next.js 16 and AI SDK 7; configure the server-only AI Gateway/provider key. No AI usage is free by default. Add authentication and storage if your app needs them.",
  },
  {
    id: "github-ai-agent-starter",
    name: "Tool-Using AI Agent (GitHub)",
    description: "Multi-provider AI agent website with streaming conversations, tools and research-style interactions.",
    category: "AI Agents",
    repository: "thorchh/agent-starter",
    subdirectory: "",
    commit: "b6edd7621637781fd84c01dac022e9a0c33d3672",
    license: "MIT",
    sourceUrl: "https://github.com/thorchh/agent-starter/tree/b6edd7621637781fd84c01dac022e9a0c33d3672",
    setupNote: "Next.js 16, AI SDK, and optional external tools/providers. Supply your own server-only keys; vet outbound actions and permission scopes before enabling tools.",
  },
  {
    id: "github-ai-saas-gridly",
    name: "AI Business SaaS (GitHub)",
    description: "Full-stack SaaS website with AI chat, authentication, dashboard, database and optional billing.",
    category: "AI SaaS",
    repository: "AdityaKodez/gridly",
    subdirectory: "",
    commit: "4f52ab299242ad380c559e077bd660c516e2fa65",
    license: "MIT",
    sourceUrl: "https://github.com/AdityaKodez/gridly/tree/4f52ab299242ad380c559e077bd660c516e2fa65",
    setupNote: "Advanced Next.js 16 + Prisma/PostgreSQL template. Configure database migrations, Better Auth and AI providers. Payments remain disabled until you deliberately configure and validate Polar billing.",
  },
] as const;

export function findGithubAppTemplate(id: string) {
  return GITHUB_APP_TEMPLATES.find((item) => item.id === id);
}
