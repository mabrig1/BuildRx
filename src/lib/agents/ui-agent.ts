import {
  FILE_FORMAT_INSTRUCTIONS,
  canCallModel,
  degradedEvent,
  diagnoseModelFailure,
  emptyOutputFailure,
  outOfTimeNote,
  parseFileBlocks,
  pause,
  runAgentCompletion,
  stepBudgetMs,
} from "@/lib/agents/llm";
import type { Agent, AppPlan, GeneratedFile } from "@/lib/agents/types";
import { generatePremiumPreview } from "@/lib/agents/premium-ux";

/**
 * Two prompts, run as two concurrent calls, because one call could not
 * do both jobs.
 *
 * The prototype is a single large file; the pages are many small ones.
 * Asked for together — with the prototype first — the prototype consumed
 * the entire token ceiling and was cut off mid-file, so a build emitted
 * one truncated preview and scaffolded all eleven pages behind it.
 * Splitting gives each job its own ceiling and its own truncation
 * boundary, and running them concurrently means neither loses wall-clock
 * time to the other.
 */
const PREVIEW_SYSTEM = `You are the UI Agent in an automated app-building pipeline. Your ONLY job in this call is to produce "preview/index.html".

It must be a distinctive SELF-CONTAINED, WORKING PROTOTYPE of the user's exact business or application, not a generic statistics dashboard, bare CRUD list, landing page or Hello World. Use an industry-appropriate presentation: supermarkets and restaurants need rich product or menu photos, curated cards, prices, categories, working search and a clearly simulated cart; schools need student and course interfaces; booking apps need services and appointments; research apps need rich data workspaces. Build a professional product cockpit that demonstrates at least two complete primary workflows. Show real domain controls such as upload/import, validated forms, tables, filters, status, details, analysis/editor panels, results, and export actions as appropriate. Seed 3-5 realistic records and make the prototype RESPOND to interaction: inline <script> so buttons, forms, filters, tabs and controls work against in-memory preview data. Show loading, empty, validation, error, success, and disabled states where they matter. Inline <style> and <script> only — no external stylesheets, fonts, scripts, or images. Apply a deliberate visual system with coherent typography, spacing, rich imagery where appropriate, refined cards, mobile navigation, clear action hierarchy, useful status/empty/error states and keyboard focus. Include nav matching the plan pages. Mark all preview/sample content DEMO; payment, stored data, delivery and appointments are NOT real. Images may use stable HTTPS image URLs with CSS fallbacks but never external scripts or fonts. Never invent a completed result when the user has not supplied data.

Emit exactly ONE file block and nothing else. Budget it: finish the whole page rather than perfecting any one section, and stay under ~400 lines.

${FILE_FORMAT_INSTRUCTIONS}`;

const PAGES_SYSTEM = `You are the UI Agent in an automated app-building pipeline. Given a build plan, you generate the application's page layer.

Requirements:
1. Generate EVERY page from the plan as a Next.js App Router page (TypeScript, Tailwind classes): "/" → "src/app/page.tsx", "/about" → "src/app/about/page.tsx", etc.
2. Generate EVERY component from the plan under "src/components" (kebab-case filenames).
3. Generate "src/app/globals.css" with Tailwind directives and any custom design tokens the app needs.

Pages must be operational, visually differentiated industry-specific product experiences, not a heading, generic templates or three stat cards. Use a domain-specific layout, cohesive brand tokens, product photography with accessible fallbacks where relevant, responsive spacing, clear typography, realistic DEMO items and descriptive headings. A grocery app should look like a real populated store; a restaurant like an online menu; a school like a student/school portal; a business app like its actual workflow. The home page must provide workflow entry points and useful status. Collection pages need search/filter/table/empty states; create or edit flows need validated inputs and submission states; result pages need provenance and export actions. Use the plan's domain language and realistic copy. Fetch from the generated API routes for persistent records, and provide explicit loading/error/retry behavior.

Create a compelling first viewport for mobile and desktop. Buttons must have working handlers or real links; no decorative nonfunctional controls. Clearly label DEMO catalog items, unknown integrations and unverified payments. Do NOT fabricate successful payments or live database operations.\n\nDo NOT generate "preview/index.html" — another call is producing it.

You are on a strict time budget: keep every file focused and under ~120 lines, emit no commentary between blocks, and finish the whole set rather than perfecting any one file.

${FILE_FORMAT_INSTRUCTIONS}`;

function toKebab(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function pagePath(routePath: string) {
  return routePath === "/"
    ? "src/app/page.tsx"
    : `src/app${routePath}/page.tsx`;
}

function mockFiles(plan: AppPlan): GeneratedFile[] {
  const previewHtml = generatePremiumPreview(plan);

  const files: GeneratedFile[] = [
    { path: "preview/index.html", content: previewHtml },
    {
      path: "src/app/globals.css",
      content: `@import "tailwindcss";

:root {
  --brand: #8b5cf6;
}

body {
  @apply antialiased;
}
`,
    },
  ];

  // A page file for every page in the plan.
  for (const page of plan.pages) {
    const isHome = page.path === "/";
    files.push({
      path: pagePath(page.path),
      content: isHome
        ? // Self-contained on purpose: this file may be filling a gap in
          // a partly-generated app, where any component it imported
          // might not exist.
          `const metrics = ["Active records", "Ready for review", "Updated this week"];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-950">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-medium text-violet-700">Product workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">${plan.appName}</h1><p className="mt-2 max-w-2xl text-zinc-600">${plan.summary}</p></div>
          <button className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white">Create record</button>
        </div>
        <section className="mt-8 grid gap-4 md:grid-cols-3">{metrics.map((metric, index) => <article key={metric} className="rounded-xl border border-zinc-200 bg-white p-5"><p className="text-sm text-zinc-500">{metric}</p><strong className="mt-2 block text-2xl">{[12, 4, 7][index]}</strong></article>)}</section>
        <section className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white"><div className="flex items-center justify-between border-b border-zinc-200 p-5"><div><h2 className="font-semibold">Recent work</h2><p className="text-sm text-zinc-500">Search, review, and continue your records.</p></div><input aria-label="Search records" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" placeholder="Search…" /></div><div className="divide-y divide-zinc-100">{["Quarterly review", "Customer discovery", "Launch readiness"].map((name, index) => <div key={name} className="flex items-center justify-between gap-4 p-5"><div><p className="font-medium">{name}</p><p className="text-sm text-zinc-500">Updated {index + 1} day{index ? "s" : ""} ago</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Ready</span></div>)}</div></section>
      </div>
    </main>
  );
}
`
        : `export default function ${page.name.replace(/\W/g, "")}Page() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <section className="mx-auto max-w-5xl rounded-xl border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">${page.name}</h1><p className="mt-2 max-w-2xl text-zinc-600">${page.description}</p></div><button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white">New ${page.name.replace(/s$/, "")}</button></div>
        <div className="mt-8 grid gap-3"><input aria-label="Search" className="rounded-lg border border-zinc-300 px-3 py-2" placeholder="Search and filter…" />{["Ready for review", "In progress", "Recently updated"].map((label, index) => <article key={label} className="flex items-center justify-between rounded-lg border border-zinc-200 p-4"><div><h2 className="font-medium">{label}</h2><p className="text-sm text-zinc-500">Record {index + 1} · owned by you</p></div><button className="text-sm font-semibold text-violet-700">Open →</button></article>)}</div>
      </section>
    </main>
  );
}
`,
    });
  }

  // A component file for every component in the plan.
  for (const component of plan.components) {
    files.push({
      path: `src/components/${toKebab(component.name)}.tsx`,
      content: `/** ${component.description} */
export function ${component.name}() {
  return (
    <section className="px-6 py-16 text-center">
      <h2 className="text-2xl font-semibold tracking-tight">${component.name}</h2>
      <p className="mx-auto mt-3 max-w-xl text-zinc-600">${component.description}</p>
    </section>
  );
}
`,
    });
  }

  return files;
}

export const uiAgent: Agent = {
  name: "ui",
  async run(context, emit) {
    emit({
      type: "agent_start",
      agent: "ui",
      message: "Generating pages and components…",
    });
    const plan = context.plan!;

    const generated: GeneratedFile[] = [];
    let note = "";
    if (!canCallModel(context)) {
      const reason = outOfTimeNote(context);
      if (reason) {
        note = ` — ${reason}, so the built-in scaffold was used`;
        emit(
          degradedEvent(
            "ui",
            "Your pages are the built-in scaffold, not generated from your description.",
            diagnoseModelFailure(
              new Error(
                "The build budget ran out before this step could start a model call."
              )
            )
          )
        );
      } else await pause(900);
    } else {
      const prompt = `Build plan:\n${JSON.stringify(plan, null, 2)}${context.architecture ? `\n\nArchitecture (follow these paths and conventions):\n${context.architecture}` : ""}\n\nOriginal request: ${context.prompt}`;
      const timeoutMs = stepBudgetMs(context);

      // Concurrent, not sequential: both jobs then get the step's whole
      // slice instead of half of it, and one failing leaves the other's
      // files intact.
      const [preview, pages] = await Promise.allSettled([
        runAgentCompletion({
          system: PREVIEW_SYSTEM,
          maxTokens: 16000,
          prompt,
          role: "codegen",
          timeoutMs,
        }),
        runAgentCompletion({
          system: PAGES_SYSTEM,
          maxTokens: 16000,
          prompt,
          role: "codegen",
          timeoutMs,
        }),
      ]);

      for (const outcome of [preview, pages]) {
        if (outcome.status === "fulfilled") {
          generated.push(...parseFileBlocks(outcome.value));
        }
      }

      if (generated.length === 0) {
        // Both halves came back empty. Report the real error when there
        // was one; otherwise this is a model that answered without
        // following the format.
        const rejected = [preview, pages].find(
          (outcome) => outcome.status === "rejected"
        ) as PromiseRejectedResult | undefined;
        const failure = rejected
          ? diagnoseModelFailure(rejected.reason)
          : emptyOutputFailure(
              "Neither the prototype nor the pages call produced a ===FILE:…===/===END=== block."
            );
        note = ` — ${failure.summary}, so the built-in scaffold was used`;
        emit(
          degradedEvent(
            "ui",
            "Your pages are the built-in scaffold, not generated from your description.",
            failure
          )
        );
      }
    }

    // The scaffold fills whatever the model didn't produce (a truncated
    // or failed generation still has to leave a previewable app): the
    // preview page, the stylesheet, and any planned page or component
    // missing from the output.
    const byPath = new Map(generated.map((file) => [file.path, file]));
    let scaffolded = 0;
    for (const file of mockFiles(plan)) {
      if (byPath.has(file.path)) continue;
      byPath.set(file.path, file);
      scaffolded++;
    }

    for (const file of byPath.values()) {
      context.files.set(file.path, file);
      emit({ type: "file", agent: "ui", path: file.path });
    }
    if (!note && scaffolded > 0) {
      note = ` — ${scaffolded} scaffolded from the plan`;
    }
    emit({
      type: "agent_complete",
      agent: "ui",
      message: `Generated ${byPath.size} UI files${note}`,
    });
  },
};
