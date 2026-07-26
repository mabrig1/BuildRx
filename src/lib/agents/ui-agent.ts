import {
  FILE_FORMAT_INSTRUCTIONS,
  canCallModel,
  fallbackReason,
  outOfTimeNote,
  parseFileBlocks,
  pause,
  runAgentCompletion,
  stepBudgetMs,
} from "@/lib/agents/llm";
import type { Agent, AppPlan, GeneratedFile } from "@/lib/agents/types";

const SYSTEM = `You are the UI Agent in an automated app-building pipeline. Given a build plan, you generate the visual layer.

Requirements:
1. FIRST generate "preview/index.html" — a complete, SELF-CONTAINED static HTML preview of the app's home page: inline <style> only (no external stylesheets, fonts, scripts, or images), modern polished design, responsive, with a nav linking the plan's pages.
2. Generate EVERY page from the plan as a Next.js App Router page (TypeScript, Tailwind classes): "/" → "src/app/page.tsx", "/about" → "src/app/about/page.tsx", etc.
3. Generate EVERY component from the plan under "src/components" (kebab-case filenames).
4. Generate "src/app/globals.css" with Tailwind directives and any custom design tokens the app needs.

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
  const nav = plan.pages
    .map((p) => `<a href="${p.path}">${p.name}</a>`)
    .join("\n      ");

  const previewHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${plan.appName}</title>
<style>
  * { margin: 0; box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #1c1917; background: #fafaf9; }
  .nav { display: flex; justify-content: space-between; align-items: center; padding: 16px 32px; background: #fff; border-bottom: 1px solid #e7e5e4; }
  .brand { font-weight: 700; font-size: 18px; }
  .nav .links { display: flex; gap: 20px; }
  .nav a { color: #57534e; text-decoration: none; font-family: system-ui, sans-serif; font-size: 14px; }
  .btn { background: #8b5cf6; color: #fff; border: 0; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-family: system-ui, sans-serif; }
  .hero { text-align: center; padding: 96px 24px 72px; background: radial-gradient(ellipse at top, rgba(139,92,246,.10), transparent 60%); }
  .hero h1 { font-size: clamp(32px, 6vw, 56px); letter-spacing: -0.02em; }
  .hero p { color: #57534e; max-width: 560px; margin: 16px auto 32px; font-size: 18px; font-family: system-ui, sans-serif; }
  .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; max-width: 960px; margin: 0 auto; padding: 0 24px 96px; }
  .card { background: #fff; border: 1px solid #e7e5e4; border-radius: 12px; padding: 24px; text-align: left; display: block; color: inherit; text-decoration: none; }
  .card h3 { margin-bottom: 8px; font-size: 16px; }
  .card p { color: #78716c; font-size: 14px; line-height: 1.5; font-family: system-ui, sans-serif; }
  footer { border-top: 1px solid #e7e5e4; padding: 24px; text-align: center; color: #a8a29e; font-size: 13px; font-family: system-ui, sans-serif; }
</style>
</head>
<body>
  <nav class="nav">
    <span class="brand">${plan.appName}</span>
    <div class="links">
      ${nav}
    </div>
    <a class="btn" href="${plan.pages[1]?.path ?? "/"}">${plan.pages[1]?.name ?? "Get started"}</a>
  </nav>
  <section class="hero">
    <h1>${plan.appName}</h1>
    <p>${plan.summary}</p>
    <a class="btn" href="${plan.pages[0]?.path ?? "/"}">Open ${plan.pages[0]?.name ?? "the app"}</a>
  </section>
  <section class="features">
    ${plan.pages
      .map(
        (page) =>
          `<a class="card" href="${page.path}"><h3>${page.name}</h3><p>${page.description}</p></a>`
      )
      .join("\n    ")}
  </section>
  <section class="features">
    ${plan.features
      .slice(0, 3)
      .map((f) => `<div class="card"><h3>${f}</h3></div>`)
      .join("\n    ")}
  </section>
  <footer>${plan.appName} · ${plan.dataModel.map((t) => t.table).join(" · ")}</footer>
</body>
</html>`;

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
          `export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">${plan.appName}</h1>
      <p className="mx-auto mt-4 max-w-xl text-zinc-600">${plan.summary}</p>
    </main>
  );
}
`
        : `export default function ${page.name.replace(/\W/g, "")}Page() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">${page.name}</h1>
      <p className="mt-3 text-zinc-600">${page.description}</p>
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

    let generated: GeneratedFile[] = [];
    let note = "";
    if (!canCallModel(context)) {
      const reason = outOfTimeNote(context);
      if (reason) note = ` — ${reason}, so the built-in scaffold was used`;
      else await pause(900);
    } else {
      try {
        const text = await runAgentCompletion({
          system: SYSTEM,
          prompt: `Build plan:\n${JSON.stringify(plan, null, 2)}${context.architecture ? `\n\nArchitecture (follow these paths and conventions):\n${context.architecture}` : ""}\n\nOriginal request: ${context.prompt}`,
          role: "codegen",
          timeoutMs: stepBudgetMs(context),
        });
        generated = parseFileBlocks(text);
        if (generated.length === 0) {
          note = " — the model returned no usable files, so the built-in scaffold was used";
        }
      } catch (error) {
        note = ` — ${fallbackReason(error)}, so the built-in scaffold was used`;
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
