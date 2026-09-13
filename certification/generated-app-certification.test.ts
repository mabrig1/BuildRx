import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { checksPass, runStaticChecks } from "@/lib/agents/checks";
import { runWorkflow } from "@/lib/agents/orchestrator";
import type {
  AgentEvent,
  WorkflowContext,
} from "@/lib/agents/types";

const execFileAsync = promisify(execFile);
const generatedRoots: string[] = [];

type CertificationCase = {
  slug: string;
  label: string;
  prompt: string;
  expectedPageFiles: string[];
  expectedTables: string[];
};

const CERTIFICATION_CASES: CertificationCase[] = [
  {
    slug: "crud-saas",
    label: "CRUD SaaS",
    prompt: `Build a secure multi-tenant customer relationship SaaS for small teams.

Pages:
- Home: pipeline summary, recent customers, tasks, and primary actions
- Customers: searchable customer records with create, edit, archive, and detail flows
- Deals: sales pipeline with status filters and ownership
- Activity: calls, notes, tasks, and follow-up history
- Settings: team and account preferences with validation

Components:
AppShell, CustomerTable, CustomerForm, DealBoard, ActivityTimeline, SearchFilters, EmptyState, StatusBadge

Tables:
- customers (id, owner_id, name, email, company, status, created_at)
- deals (id, owner_id, customer_id, title, value_cents, status, created_at)
- activities (id, owner_id, customer_id, subject, status, created_at)
- tasks (id, owner_id, customer_id, title, done, created_at)

Use authenticated ownership, persistent CRUD, search and filters, loading/error/empty/success states, and a Vercel-ready production build.
`,
    expectedPageFiles: [
      "src/app/page.tsx",
      "src/app/customers/page.tsx",
      "src/app/deals/page.tsx",
      "src/app/activity/page.tsx",
      "src/app/settings/page.tsx",
    ],
    expectedTables: ["customers", "deals", "activities", "tasks"],
  },
  {
    slug: "analytics-research",
    label: "Analytics / research",
    prompt: `Build a secure statistical analysis web app for researchers.

Pages:
- Home: project status, dataset health, and recent analyses
- Projects: searchable research projects
- Data: import CSV data, inspect variables, and resolve validation warnings
- Analysis: configure regression, ANOVA, correlation, and t-tests
- Results: review saved statistical outputs and interpretations
- Reports: compose and export publication-ready reports

Components:
WorkspaceShell, DatasetUploader, VariableInspector, DataGrid, AnalysisBuilder, AssumptionChecklist, ResultsTable, ResultChart, ReportComposer

Tables:
- projects (id, owner_id, name, status, created_at)
- datasets (id, owner_id, project_id, name, row_count, validation_status, created_at)
- analyses (id, owner_id, project_id, method, status, created_at)
- results (id, owner_id, analysis_id, summary, result_json, created_at)
- reports (id, owner_id, project_id, title, format, created_at)

Use authenticated ownership, persistent CRUD, loading/error/empty/success states, and a Vercel-ready production build.
`,
    expectedPageFiles: [
      "src/app/page.tsx",
      "src/app/projects/page.tsx",
      "src/app/data/page.tsx",
      "src/app/analysis/page.tsx",
      "src/app/results/page.tsx",
      "src/app/reports/page.tsx",
    ],
    expectedTables: ["projects", "datasets", "analyses", "results", "reports"],
  },
  {
    slug: "marketplace",
    label: "Marketplace",
    prompt: `Build a two-sided professional services marketplace where buyers can hire verified providers.

Pages:
- Home: discovery, trust signals, active orders, and role-aware actions
- Listings: searchable service listings with category and price filters
- Orders: buyer and seller order lifecycle with status and delivery states
- Messages: order-scoped buyer/seller communication
- Seller Console: listing management, incoming work, and delivery queue
- Profile: provider identity, portfolio, and account settings

Components:
MarketplaceShell, ListingGrid, ListingFilters, ListingForm, OrderTimeline, MessageThread, SellerQueue, ProviderProfile, EmptyState

Tables:
- listings (id, owner_id, title, category, price_cents, status, created_at)
- orders (id, owner_id, listing_id, status, price_cents, created_at)
- messages (id, owner_id, order_id, body, status, created_at)
- profiles (id, owner_id, display_name, headline, status, created_at)

Use authenticated ownership, buyer/seller permissions, persistent records, loading/error/empty/success states, and a Vercel-ready production build.
`,
    expectedPageFiles: [
      "src/app/page.tsx",
      "src/app/listings/page.tsx",
      "src/app/orders/page.tsx",
      "src/app/messages/page.tsx",
      "src/app/seller-console/page.tsx",
      "src/app/profile/page.tsx",
    ],
    expectedTables: ["listings", "orders", "messages", "profiles"],
  },
  {
    slug: "ai-workflow",
    label: "AI workflow app",
    prompt: `Build an AI-assisted grant proposal workspace for consultants and founders. AI generation must remain reviewable by a human before anything is finalized.

Pages:
- Home: active workspaces, recent AI runs, and review queue
- Opportunities: saved grant opportunities with search and eligibility status
- AI Studio: prompt, source context, generated draft, citations, and human approval controls
- Proposals: editable proposal drafts with version and status history
- Review Queue: generated sections awaiting human approval or rejection
- Settings: model and workspace preferences using environment variable names only

Components:
AiWorkspaceShell, OpportunityTable, PromptComposer, SourceContextPanel, DraftEditor, CitationList, ApprovalPanel, RunStatus, EmptyState

Tables:
- opportunities (id, owner_id, title, sponsor, status, created_at)
- proposals (id, owner_id, opportunity_id, title, status, created_at)
- ai_runs (id, owner_id, proposal_id, status, result_json, created_at)
- reviews (id, owner_id, proposal_id, status, summary, created_at)

Use authenticated ownership, persistent drafts, explicit human approval, loading/error/empty/success states, server-only secrets, and a Vercel-ready production build.
`,
    expectedPageFiles: [
      "src/app/page.tsx",
      "src/app/opportunities/page.tsx",
      "src/app/ai-studio/page.tsx",
      "src/app/proposals/page.tsx",
      "src/app/review-queue/page.tsx",
      "src/app/settings/page.tsx",
    ],
    expectedTables: ["opportunities", "proposals", "ai_runs", "reviews"],
  },
  {
    slug: "content-business",
    label: "Content / business operations",
    prompt: `Build a publishing business operations app for managing articles, authors, editorial review, and publication schedules.

Pages:
- Home: editorial KPIs, deadlines, recent drafts, and primary actions
- Content: searchable article library with draft, review, scheduled, and published states
- Calendar: publication schedule and deadline view
- Authors: author profiles, assignments, and contribution status
- Review: editorial review queue with approval and revision states
- Settings: publication and workflow preferences

Components:
PublisherShell, ContentTable, ArticleForm, EditorialCalendar, AuthorDirectory, ReviewQueue, WorkflowBadge, SearchFilters, EmptyState

Tables:
- articles (id, owner_id, title, status, created_at)
- authors (id, owner_id, name, email, status, created_at)
- assignments (id, owner_id, article_id, author_id, status, created_at)
- reviews (id, owner_id, article_id, status, summary, created_at)
- schedules (id, owner_id, article_id, publish_at, status, created_at)

Use authenticated ownership, persistent editorial workflow, search and filters, loading/error/empty/success states, and a Vercel-ready production build.
`,
    expectedPageFiles: [
      "src/app/page.tsx",
      "src/app/content/page.tsx",
      "src/app/calendar/page.tsx",
      "src/app/authors/page.tsx",
      "src/app/review/page.tsx",
      "src/app/settings/page.tsx",
    ],
    expectedTables: ["articles", "authors", "assignments", "reviews", "schedules"],
  },
];

const ISOLATED_ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "NVIDIA_API_KEY",
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MONGODB_URI",
  "MONGODB_DATABASE",
  "DATABASE_URL",
] as const;

const savedEnvironment = new Map<string, string | undefined>();

function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function runNpm(
  args: string[],
  cwd: string,
  timeout = 300_000
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(npmExecutable(), args, {
      cwd,
      timeout,
      maxBuffer: 20 * 1024 * 1024,
      env: {
        ...process.env,
        CI: "1",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });

    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } catch (error) {
    const failure = error as Error & {
      stdout?: string;
      stderr?: string;
      code?: string | number;
      signal?: string;
    };
    throw new Error(
      [
        `Command failed: npm ${args.join(" ")}`,
        `cwd: ${cwd}`,
        failure.code !== undefined ? `exit: ${String(failure.code)}` : "",
        failure.signal ? `signal: ${failure.signal}` : "",
        failure.stdout ? `stdout:\n${failure.stdout}` : "",
        failure.stderr ? `stderr:\n${failure.stderr}` : "",
        `error: ${failure.message}`,
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  }
}

async function materializeGeneratedApp(
  context: WorkflowContext,
  slug: string
): Promise<string> {
  const root = await mkdtemp(
    path.join(os.tmpdir(), `buildrx-certified-${slug}-`)
  );
  generatedRoots.push(root);

  for (const file of context.files.values()) {
    const destination = path.join(root, file.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.content, "utf8");
  }

  return root;
}

beforeAll(() => {
  for (const key of ISOLATED_ENV_KEYS) {
    savedEnvironment.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterAll(async () => {
  for (const key of ISOLATED_ENV_KEYS) {
    const original = savedEnvironment.get(key);
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }

  await Promise.all(
    generatedRoots.map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe("Generated App Certification Matrix", () => {
  it.each(CERTIFICATION_CASES)(
    "$label generates, installs, typechecks, and production-builds independently",
    async ({ slug, label, prompt, expectedPageFiles, expectedTables }) => {
      const events: AgentEvent[] = [];
      const context: WorkflowContext = {
        projectId: `generated-app-certification-${slug}`,
        userId: null,
        prompt,
        persist: false,
        files: new Map(),
      };

      await runWorkflow(context, (event) => events.push(event));

      expect(
        context.plan,
        `${label}: the pipeline must produce an application plan`
      ).toBeDefined();
      expect(
        context.files.size,
        `${label}: the pipeline must produce application files`
      ).toBeGreaterThan(15);

      const pipelineErrors = events.filter((event) => event.type === "error");
      expect(
        pipelineErrors,
        `${label}: fallback pipeline emitted errors:\n${pipelineErrors
          .map((event) => JSON.stringify(event))
          .join("\n")}`
      ).toEqual([]);

      const findings = runStaticChecks(context, context.plan!);
      const blockingFindings = findings.filter(
        (finding) => finding.severity === "error"
      );
      expect(
        checksPass(findings),
        `${label}: generated app failed BuildRx static QA:\n${blockingFindings
          .map(
            (finding) =>
              `[${finding.rule}] ${finding.file ?? ""} ${finding.message}`
          )
          .join("\n")}`
      ).toBe(true);

      for (const requiredPath of [
        "package.json",
        "tsconfig.json",
        "postcss.config.mjs",
        "src/app/page.tsx",
        "src/app/layout.tsx",
        "src/app/globals.css",
        "src/lib/mongodb.ts",
        "src/lib/supabase/server.ts",
        "supabase/schema.sql",
        "docs/RELEASE-CHECKLIST.md",
        ...expectedPageFiles,
      ]) {
        expect(
          context.files.has(requiredPath),
          `${label}: generated app is missing required artifact ${requiredPath}`
        ).toBe(true);
      }

      const schema = context.files.get("supabase/schema.sql")!.content;
      for (const table of expectedTables) {
        expect(
          schema,
          `${label}: generated schema must include ${table}`
        ).toContain(`create table public.${table}`);
      }

      const packageJson = JSON.parse(
        context.files.get("package.json")!.content
      ) as {
        engines?: { node?: string };
        scripts?: Record<string, string>;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      expect(packageJson.engines?.node).toBe("22.x");
      expect(packageJson.scripts?.typecheck).toBe("tsc --noEmit");
      expect(packageJson.scripts?.build).toBe("next build");
      expect(packageJson.dependencies?.mongodb).toBeDefined();
      expect(
        packageJson.devDependencies?.["@tailwindcss/postcss"]
      ).toBeDefined();

      const root = await materializeGeneratedApp(context, slug);

      await runNpm(
        [
          "install",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--prefer-offline",
        ],
        root
      );
      await runNpm(["run", "typecheck"], root);
      const build = await runNpm(["run", "build"], root);

      expect(
        build.stdout + build.stderr,
        `${label}: Next.js production build did not report successful compilation`
      ).toMatch(
        /(?:Compiled successfully|Creating an optimized production build)/i
      );
    }
  );
});
