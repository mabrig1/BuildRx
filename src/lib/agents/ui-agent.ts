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

const SYSTEM = `You are the UI Agent in an automated app-building pipeline. Given a build plan, you generate the visual layer.

Requirements:
1. FIRST generate "preview/index.html" — a SELF-CONTAINED, WORKING PROTOTYPE of the app, not a landing page. It must show the app's primary interface (the board, list, dashboard, editor or form the app is actually for), seeded with 3-5 realistic sample records, and it must RESPOND to interaction: inline <script> so buttons, forms, filters, checkboxes and tabs actually work against in-memory data. Inline <style> and <script> only — no external stylesheets, fonts, scripts, or images. Modern, polished, responsive. Include a nav linking the plan's pages.
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

  // The scaffold preview is a working prototype, not a poster. When a
  // model is unavailable this is the whole app the user sees, and a
  // static hero page reads as "nothing was built" — so it renders the
  // plan's primary table as a real list with working add/toggle/delete
  // against in-memory sample rows.
  const table = plan.dataModel[0];
  const labelColumn =
    table?.columns.find((c) => /title|name|label|subject/.test(c.name))?.name ??
    table?.columns.find((c) => c.type === "text" && c.name !== "id")?.name ??
    "title";
  const statusColumn = table?.columns.find(
    (c) => c.type === "boolean" || /status|state|done|complete/.test(c.name)
  )?.name;
  const samples = [
    `First ${table?.table ?? "item"}`,
    `Second ${table?.table ?? "item"}`,
    `Third ${table?.table ?? "item"}`,
  ];

  const appScript = `
  const rows = ${JSON.stringify(
    samples.map((value, index) => ({ id: index + 1, label: value, done: index === 0 }))
  )};
  let nextId = rows.length + 1;
  const list = document.getElementById("rows");
  const input = document.getElementById("new-item");
  const empty = document.getElementById("empty");

  function render() {
    list.innerHTML = "";
    empty.hidden = rows.length > 0;
    for (const row of rows) {
      const li = document.createElement("li");
      li.className = "row" + (row.done ? " done" : "");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = row.done;
      check.addEventListener("change", () => { row.done = check.checked; render(); });
      const span = document.createElement("span");
      span.textContent = row.label;
      const del = document.createElement("button");
      del.className = "del";
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        rows.splice(rows.indexOf(row), 1);
        render();
      });
      ${statusColumn ? "li.append(check, span, del);" : "li.append(span, del);"}
      list.append(li);
    }
    document.getElementById("count").textContent =
      rows.length + " ${table?.table ?? "item"}" + (rows.length === 1 ? "" : "s");
  }

  document.getElementById("add").addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;
    rows.push({ id: nextId++, label: value, done: false });
    input.value = "";
    render();
  });

  render();`;

  const previewHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${plan.appName}</title>
<style>
  * { margin: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; color: #18181b; background: #fafafa; }
  .nav { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; background: #fff; border-bottom: 1px solid #e4e4e7; position: sticky; top: 0; }
  .brand { font-weight: 700; }
  .nav .links { display: flex; gap: 18px; }
  .nav a { color: #52525b; text-decoration: none; font-size: 14px; }
  .nav a:hover { color: #18181b; }
  main { max-width: 720px; margin: 0 auto; padding: 32px 24px 64px; }
  h1 { font-size: 26px; letter-spacing: -0.02em; }
  .sub { color: #71717a; margin-top: 6px; font-size: 15px; }
  form { display: flex; gap: 8px; margin: 24px 0 16px; }
  input[type=text] { flex: 1; padding: 10px 12px; border: 1px solid #d4d4d8; border-radius: 8px; font-size: 14px; }
  button { border: 0; border-radius: 8px; padding: 10px 16px; font-weight: 600; font-size: 14px; cursor: pointer; }
  #add button { background: #6d28d9; color: #fff; }
  ul { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #e4e4e7; border-radius: 10px; padding: 12px 14px; }
  .row span { flex: 1; font-size: 14px; }
  .row.done span { text-decoration: line-through; color: #a1a1aa; }
  .del { background: transparent; color: #a1a1aa; font-size: 13px; padding: 4px 8px; }
  .del:hover { color: #dc2626; }
  #count { color: #71717a; font-size: 13px; }
  #empty { color: #a1a1aa; font-size: 14px; padding: 24px; text-align: center; border: 1px dashed #d4d4d8; border-radius: 10px; }
  footer { border-top: 1px solid #e4e4e7; padding: 20px 24px; text-align: center; color: #a1a1aa; font-size: 13px; }
</style>
</head>
<body>
  <nav class="nav">
    <span class="brand">${plan.appName}</span>
    <div class="links">
      ${nav}
    </div>
  </nav>
  <main>
    <h1>${plan.pages[0]?.name ?? "Home"}</h1>
    <p class="sub">${plan.summary}</p>
    <form id="add">
      <input id="new-item" type="text" placeholder="Add ${labelColumn}…" aria-label="Add ${labelColumn}" />
      <button type="submit">Add</button>
    </form>
    <p id="count"></p>
    <ul id="rows"></ul>
    <p id="empty" hidden>Nothing yet — add your first ${labelColumn}.</p>
  </main>
  <footer>${plan.appName} · ${plan.features.slice(0, 3).join(" · ")}</footer>
  <script>${appScript}</script>
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
      try {
        const text = await runAgentCompletion({
          system: SYSTEM,
          prompt: `Build plan:\n${JSON.stringify(plan, null, 2)}${context.architecture ? `\n\nArchitecture (follow these paths and conventions):\n${context.architecture}` : ""}\n\nOriginal request: ${context.prompt}`,
          role: "codegen",
          timeoutMs: stepBudgetMs(context),
        });
        generated = parseFileBlocks(text);
        if (generated.length === 0) {
          const failure = emptyOutputFailure(
            "The model's response contained no ===FILE:…===/===END=== blocks, so no page could be read out of it."
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
      } catch (error) {
        const failure = diagnoseModelFailure(error);
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
