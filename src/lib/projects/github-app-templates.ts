/**
 * Curated open-source starter snapshots. Never accept a client-supplied
 * repository URL, branch, or git SHA when importing: only these reviewed,
 * commit-pinned directories are eligible.
 *
 * Source: Vercel Next.js examples (MIT licensed). Import the upstream
 * license and attribution with the project. These are real code sources,
 * not finished BuildRx-generated apps; users must review and test them.
 */
export interface GithubAppTemplate {
  id: string;
  name: string;
  description: string;
  category: "Content" | "Authentication" | "Website" | "Learning";
  difficulty: "Beginner" | "Intermediate";
  requiresExternalService: boolean;
  repository: "vercel/next.js";
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
    difficulty: "Beginner",
    requiresExternalService: false,
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
    difficulty: "Intermediate",
    requiresExternalService: true,
    repository: "vercel/next.js",
    subdirectory: "examples/with-supabase",
    commit: NEXTJS_SNAPSHOT,
    license: "MIT",
    sourceUrl: `https://github.com/vercel/next.js/tree/${NEXTJS_SNAPSHOT}/examples/with-supabase`,
    setupNote: "A user-owned Supabase project and environment settings are required. Authentication is not connected merely by importing.",
  },
  {
    id: "github-basic-css",
    name: "Simple Website (GitHub)",
    description: "A small Next.js App Router website. Learn editable pages, layouts and CSS modules without accounts or APIs.",
    category: "Website",
    difficulty: "Beginner",
    requiresExternalService: false,
    repository: "vercel/next.js",
    subdirectory: "examples/basic-css",
    commit: NEXTJS_SNAPSHOT,
    license: "MIT",
    sourceUrl: `https://github.com/vercel/next.js/tree/${NEXTJS_SNAPSHOT}/examples/basic-css`,
    setupNote: "Basic App Router pages and CSS module. Review and update the pinned example's React/Next.js dependencies before deployment.",
  },
  {
    id: "github-context-counter",
    name: "Interactive Counter (GitHub)",
    description: "A real two-page Next.js example showing reusable UI, React Context and shared interactive state.",
    category: "Learning",
    difficulty: "Beginner",
    requiresExternalService: false,
    repository: "vercel/next.js",
    subdirectory: "examples/with-context-api",
    commit: NEXTJS_SNAPSHOT,
    license: "MIT",
    sourceUrl: `https://github.com/vercel/next.js/tree/${NEXTJS_SNAPSHOT}/examples/with-context-api`,
    setupNote: "Learn shared React state. State is only in memory: it resets on refresh and is not a database.",
  },
] as const;

export function findGithubAppTemplate(id: string) {
  return GITHUB_APP_TEMPLATES.find((item) => item.id === id);
}
