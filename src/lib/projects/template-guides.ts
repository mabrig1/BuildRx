import { BEGINNER_CODE_TEMPLATES } from "@/lib/projects/beginner-catalog";
import { GITHUB_APP_TEMPLATES } from "@/lib/projects/github-app-templates";

/**
 * Catalog evidence describes *source provenance*, not verified execution,
 * provider readiness, deployment, or absence of malware.
 * Keep this server-curated and never let the browser supply import URLs.
 */
export type TemplateCategory =
  | "Business apps" | "Education" | "E-commerce" | "Inventory"
  | "Booking" | "Dashboards" | "AI tools";

export interface TemplateGuide {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  difficulty: "Beginner" | "Intermediate";
  state: "source-reviewed" | "planned";
  origin: "BuildRx original" | "Pinned GitHub" | "Planned";
  sourceUrl: string | null;
  sourceNote: string;
  deployed: "Not verified" | "Not applicable";
  services: readonly string[];
  assumptions: readonly string[];
  envKeys: readonly string[];
  setup: readonly string[];
  safeStart: readonly string[];
  editable: readonly string[];
  nextAction: string;
  rollback: string;
}

const ORIGINAL_SOURCE =
  "https://github.com/mabrig1/BuildRx/blob/67fed4a2df164cab42dc3f12cd66a3423efa3695/src/lib/projects/beginner-code-templates.ts";

const UNIVERSAL_CHECKS = [
  "Confirm origin, commit or local source, MIT license and attribution.",
  "Never paste API keys, passwords or service-role tokens into browser fields.",
  "Review dependencies and code; a static malware scan is not a guarantee.",
  "Keep the imported workspace private and Draft until tests pass.",
] as const;

const originals: readonly TemplateGuide[] = BEGINNER_CODE_TEMPLATES.map(t => {
  const isStock = t.id === "beginner-stock-list";
  const isTask = t.id === "beginner-task-planner";
  return {
    id: t.id, name: t.name, description: t.description,
    category: (isStock ? "Inventory" : isTask ? "Dashboards" : "Business apps") as TemplateCategory,
    difficulty: "Beginner" as const,
    state: "source-reviewed" as const,
    origin: "BuildRx original" as const,
    sourceUrl: ORIGINAL_SOURCE,
    sourceNote: "Original BuildRx MIT starter source reviewed in PR #50; not an independent upstream GitHub repository.",
    deployed: "Not verified" as const,
    services: ["None required for the demo"],
    assumptions: ["Intended beginner/business use is a suggestion; no customer adoption or production uptime has been checked."],
    envKeys: [],
    setup: ["Clone the private draft.", "Open README.md and inspect app/page.tsx.",
      "Install dependencies only in a trusted local environment after review.",
      "Run local tests and check preview before publishing."],
    safeStart: UNIVERSAL_CHECKS,
    editable: isStock ? ["Stock items", "Low-stock threshold", "Branding", "Demo storage"] :
      isTask ? ["Task labels", "List behaviour", "Branding", "Demo storage"] :
      ["Page content", "Colors", "Contact link", "Cards and headings"],
    nextAction: t.nextStep,
    rollback: "Delete the private Draft if unused; restore from a downloaded ZIP or previous version before overriding code.",
  };
});

const github: readonly TemplateGuide[] = GITHUB_APP_TEMPLATES.map(t => ({
  id: t.id, name: t.name, description: t.description,
  category: (t.id === "github-supabase-starter" ? "Business apps" :
    t.id === "github-blog-starter" ? "Education" :
    t.id === "github-context-counter" ? "Dashboards" : "E-commerce") as TemplateCategory,
  difficulty: t.difficulty,
  state: "source-reviewed" as const,
  origin: "Pinned GitHub" as const,
  sourceUrl: t.sourceUrl,
  sourceNote: "Allowlisted Vercel Next.js MIT example at immutable commit " + t.commit +
    "; imported files checked statically; dependencies and runtime are not certified.",
  deployed: "Not verified" as const,
  services: t.requiresExternalService ? ["Supabase account and Auth/database setup"] :
    ["None required for initial source review"],
  assumptions: ["Compatibility with this BuildRx preview and deployment toolchain is unproven until built and tested."],
  envKeys: t.id === "github-supabase-starter" ?
    ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] : [],
  setup: ["Clone pinned source to a private Draft.", "Read README.md and BUILD-RX-SOURCE.md.",
    "Check skipped binary assets, package versions and dependency advisories.",
    t.setupNote, "Run locally, test behavior and review access controls before hosting."],
  safeStart: UNIVERSAL_CHECKS,
  editable: ["Branding", "Pages", "Styles", "Content", "App components"],
  nextAction: t.setupNote,
  rollback: "Keep the original commit/source attribution; discard the private Draft or restore your own saved version.",
}));

// These are opportunities, NOT approved GitHub clone sources. Never invent a
// repository URL or turn these into import IDs without a separate review.
const planned: readonly TemplateGuide[] = [
  {
    id: "planned-booking", name: "Appointment Scheduler", category: "Booking",
    description: "Service booking, staff shifts, conflict-safe slots and cancellation.",
    difficulty: "Intermediate", state: "planned", origin: "Planned", sourceUrl: null,
    sourceNote: "Specification only. No reviewed, cloneable source is present in the allowlist.",
    deployed: "Not verified", services: ["Supabase Auth/database", "Optional email/SMS (not configured)"],
    assumptions: ["Suggested architecture only; no source, live provider or booking contention test exists."],
    envKeys: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    setup: ["Review booking requirements and staff ownership.", "Design atomic conflict protection.",
      "Generate and review source separately; no code can be cloned from this card."],
    safeStart: UNIVERSAL_CHECKS,
    editable: ["Service list", "Staff hours", "Booking rules", "Timezones"],
    nextAction: "Approve a tested, audited repository with transactional booking and RLS before enabling cloning.",
    rollback: "No clone is possible; retain the specification and avoid external side effects.",
  },
  {
    id: "planned-courses", name: "Learning Portal", category: "Education",
    description: "Courses, lessons, enrollments and owner-scoped learner records.",
    difficulty: "Intermediate", state: "planned", origin: "Planned", sourceUrl: null,
    sourceNote: "Idea brief only; no source link has been verified.",
    deployed: "Not verified", services: ["Database/Auth (not configured)"],
    assumptions: ["Course roles and service requirements are design hypotheses."],
    envKeys: ["NEXT_PUBLIC_SUPABASE_URL"],
    setup: ["Define roles and learner privacy.", "Review a licensed pinned-source candidate."],
    safeStart: UNIVERSAL_CHECKS,
    editable: ["Lessons", "Quizzes", "Enrollment workflow"],
    nextAction: "Find and security-review a permissively licensed education starter.",
    rollback: "No clone has been performed.",
  },
  {
    id: "planned-store", name: "Online Shop", category: "E-commerce",
    description: "Product pages, carts and checkout requiring real payment verification.",
    difficulty: "Intermediate", state: "planned", origin: "Planned", sourceUrl: null,
    sourceNote: "Not an approved clone source or verified payment integration.",
    deployed: "Not verified", services: ["Database", "Payment provider (not configured)"],
    assumptions: ["Checkout/provider architecture is hypothetical until implemented and audited."],
    envKeys: ["PAYMENT_PROVIDER_SECRET_KEY"],
    setup: ["Choose provider with webhook validation.", "Review licensing and dependency tree."],
    safeStart: UNIVERSAL_CHECKS,
    editable: ["Catalog", "Cart", "Checkout copy"],
    nextAction: "Review a licensed shop starter and test verified payment callbacks.",
    rollback: "No clone has been performed.",
  },
  {
    id: "planned-analytics", name: "Analytics Dashboard", category: "Dashboards",
    description: "Accessible charts and KPIs with truthful sample-data labels.",
    difficulty: "Beginner", state: "planned", origin: "Planned", sourceUrl: null,
    sourceNote: "Planned template; screenshots and charts alone are not an audited repository.",
    deployed: "Not verified", services: ["None until real data is connected"],
    assumptions: ["KPI sources and chart requirements are proposed; no live metric feed verified."],
    envKeys: [],
    setup: ["Specify KPI formulas.", "Review chart accessibility and real data permissions."],
    safeStart: UNIVERSAL_CHECKS,
    editable: ["KPI cards", "Filters", "Charts"],
    nextAction: "Audit a licensed dashboard source, then pin an immutable commit.",
    rollback: "No clone has been performed.",
  },
  {
    id: "planned-ai", name: "AI Assistant", category: "AI tools",
    description: "A server-proxied assistant with safe rate limits and opt-in model connection.",
    difficulty: "Intermediate", state: "planned", origin: "Planned", sourceUrl: null,
    sourceNote: "No verified clone source; a prompt mockup is not a working AI integration.",
    deployed: "Not verified", services: ["Server-only AI provider (not configured)"],
    assumptions: ["AI provider access, model performance and pricing are unknown."],
    envKeys: ["AI_PROVIDER_API_KEY"],
    setup: ["Design server-only key handling.", "Review request limits and misuse controls."],
    safeStart: UNIVERSAL_CHECKS,
    editable: ["Assistant instructions", "UI", "Model routing"],
    nextAction: "Audit source and test fail-closed behavior without real keys.",
    rollback: "No clone has been performed.",
  },
];

export const TEMPLATE_GUIDES: readonly TemplateGuide[] = [...originals, ...github, ...planned];

export function approvedTemplateIds(): string[] {
  return TEMPLATE_GUIDES.filter(t => t.state === "source-reviewed").map(t => t.id);
}

export function findTemplateGuide(id: string) {
  return TEMPLATE_GUIDES.find(t => t.id === id);
}
