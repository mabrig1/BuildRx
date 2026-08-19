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

It must be a SELF-CONTAINED, WORKING PROTOTYPE of the app, not a landing page, card gallery, or decorative dashboard. Build a professional product cockpit that demonstrates at least two complete primary workflows. Show real domain controls such as upload/import, validated forms, tables, filters, status, details, analysis/editor panels, results, and export actions as appropriate. Seed 3-5 realistic records and make the prototype RESPOND to interaction: inline <script> so buttons, forms, filters, tabs and controls work against in-memory preview data. Show loading, empty, validation, error, success, and disabled states where they matter. Inline <style> and <script> only — no external stylesheets, fonts, scripts, or images. Modern, dense but readable, responsive, keyboard accessible. Include a nav linking the plan's pages. Never invent a completed result when the user has not supplied data.

Emit exactly ONE file block and nothing else. Budget it: finish the whole page rather than perfecting any one section, and stay under ~400 lines.

${FILE_FORMAT_INSTRUCTIONS}`;

const PAGES_SYSTEM = `You are the UI Agent in an automated app-building pipeline. Given a build plan, you generate the application's page layer.

Requirements:
1. Generate EVERY page from the plan as a Next.js App Router page (TypeScript, Tailwind classes): "/" → "src/app/page.tsx", "/about" → "src/app/about/page.tsx", etc.
2. Generate EVERY component from the plan under "src/components" (kebab-case filenames).
3. Generate "src/app/globals.css" with Tailwind directives and any custom design tokens the app needs.

Pages must be operational product screens, not a heading plus description. The home page must provide workflow entry points and useful status. Collection pages need search/filter/table/empty states; create or edit flows need validated inputs and submission states; result pages need provenance and export actions. Use the plan's domain language and realistic copy. Fetch from the generated API routes for persistent records, and provide explicit loading/error/retry behavior.

Do NOT generate "preview/index.html" — another call is producing it.

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

function statisticsPreview(plan: AppPlan): string {
  const nav = plan.pages
    .map((page, index) => `<button class="nav-item${index === 0 ? " active" : ""}" data-view="${page.name}">${page.name}</button>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${plan.appName}</title>
<style>
:root{--bg:#f4f7fb;--panel:#fff;--ink:#182230;--muted:#667085;--line:#e4e7ec;--brand:#5b4de3;--brand2:#ebe9ff;--good:#087a55;--warn:#b54708;--bad:#b42318}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 Inter,ui-sans-serif,system-ui,sans-serif}.app{display:grid;grid-template-columns:244px 1fr;min-height:100vh}.side{background:#111827;color:#d1d5db;padding:20px 14px;display:flex;flex-direction:column;gap:20px}.brand{display:flex;align-items:center;gap:10px;padding:4px 8px;color:#fff;font-size:18px;font-weight:750}.logo{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,#8b5cf6,#4f46e5)}.nav{display:grid;gap:4px}.nav-item{border:0;background:transparent;color:#aeb7c5;text-align:left;padding:10px 12px;border-radius:8px;cursor:pointer;font-weight:600}.nav-item:hover,.nav-item.active{background:#263142;color:#fff}.side-note{margin-top:auto;padding:12px;background:#1f2937;border:1px solid #354052;border-radius:10px}.side-note strong{display:block;color:#fff;margin-bottom:4px}.side-note small{color:#9ca3af}.main{min-width:0}.top{height:68px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 28px}.crumb{color:var(--muted)}.project{font-weight:700;color:var(--ink)}.top-actions{display:flex;gap:8px;align-items:center}.avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#d1fae5;color:#065f46;font-weight:800}.content{padding:26px 28px 40px;max-width:1440px;margin:auto}.heading{display:flex;justify-content:space-between;gap:18px;align-items:start;margin-bottom:22px}.heading h1{margin:0;font-size:25px;letter-spacing:-.025em}.heading p{margin:5px 0 0;color:var(--muted)}button,.button{font:inherit}.btn{border:1px solid var(--line);background:#fff;color:var(--ink);padding:9px 13px;border-radius:8px;font-weight:650;cursor:pointer}.btn:hover{border-color:#a9a1ff}.btn.primary{background:var(--brand);border-color:var(--brand);color:#fff}.btn:disabled{opacity:.45;cursor:not-allowed}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.metric,.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:0 1px 2px #1018280a}.metric{padding:16px}.metric span{color:var(--muted);font-size:12px}.metric strong{display:block;font-size:24px;margin-top:5px}.metric em{font-style:normal;color:var(--good);font-size:12px}.workspace{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(310px,.7fr);gap:16px}.panel-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line)}.panel-head h2{font-size:15px;margin:0}.panel-body{padding:18px}.drop{border:1.5px dashed #a9a1ff;background:#fafaff;border-radius:10px;text-align:center;padding:22px}.drop.drag{background:var(--brand2)}.drop strong{display:block;margin:7px}.drop p{margin:0 0 12px;color:var(--muted);font-size:12px}.file-input{display:none}.notice{margin-top:12px;padding:10px 12px;border-radius:8px;background:#ecfdf3;color:#067647;display:none}.notice.show{display:block}.toolbar{display:flex;gap:8px;align-items:center;margin:16px 0 10px}.search,select{border:1px solid var(--line);border-radius:8px;background:#fff;padding:8px 10px;color:var(--ink)}.search{flex:1}.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:9px}table{width:100%;border-collapse:collapse;min-width:620px}th,td{text-align:left;padding:11px 12px;border-bottom:1px solid var(--line);font-size:12px}th{background:#f9fafb;color:var(--muted);font-weight:700}tr:last-child td{border-bottom:0}.pill{display:inline-flex;padding:3px 7px;border-radius:999px;background:#ecfdf3;color:#067647;font-weight:700;font-size:11px}.pill.warn{background:#fffaeb;color:#b54708}.studio{display:grid;gap:14px}.field label{display:block;font-size:12px;font-weight:700;margin-bottom:5px}.field select{width:100%}.assumptions{display:grid;gap:8px}.check{display:flex;align-items:center;gap:8px;padding:9px;border:1px solid var(--line);border-radius:8px}.check b{margin-left:auto;color:var(--good);font-size:11px}.result{display:none;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}.result.show{display:block}.bars{height:118px;display:flex;align-items:end;gap:9px;padding:12px;background:#f9fafb;border-radius:8px}.bar{flex:1;background:linear-gradient(#7567ec,#5b4de3);border-radius:4px 4px 0 0;min-width:14px}.result-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.stat{padding:8px;background:#f8fafc;border-radius:7px}.stat small{color:var(--muted);display:block}.toast{position:fixed;right:24px;bottom:24px;background:#101828;color:#fff;padding:12px 15px;border-radius:9px;transform:translateY(90px);transition:.2s}.toast.show{transform:none}.empty{display:none;text-align:center;padding:28px;color:var(--muted)}@media(max-width:1000px){.app{grid-template-columns:78px 1fr}.brand span,.nav-item,.side-note{font-size:0}.nav-item:before{content:'•';font-size:18px}.grid{grid-template-columns:repeat(2,1fr)}.workspace{grid-template-columns:1fr}}@media(max-width:650px){.app{display:block}.side{display:none}.content{padding:20px 14px}.top{padding:0 14px}.grid{grid-template-columns:1fr 1fr}.heading{display:block}.heading .btn{margin-top:12px}.result-grid{grid-template-columns:1fr}}
</style>
</head>
<body><div class="app"><aside class="side"><div class="brand"><span class="logo">Σ</span><span>${plan.appName}</span></div><nav class="nav">${nav}</nav><div class="side-note"><strong>Dataset health</strong><small>24 variables checked · 2 warnings</small></div></aside><main class="main"><header class="top"><div class="crumb">Projects / <span class="project">Customer retention study</span></div><div class="top-actions"><button class="btn" id="export">Export report</button><span class="avatar">AR</span></div></header><section class="content"><div class="heading"><div><h1>Analysis workspace</h1><p>Import clean data, check assumptions, and produce reproducible findings.</p></div><button class="btn primary" id="new-analysis">+ New analysis</button></div><div class="grid"><article class="metric"><span>Observations</span><strong id="row-count">1,248</strong><em>100% imported</em></article><article class="metric"><span>Variables</span><strong>24</strong><em>20 analysis-ready</em></article><article class="metric"><span>Saved analyses</span><strong id="analysis-count">6</strong><em>2 this week</em></article><article class="metric"><span>Data quality</span><strong>96%</strong><em style="color:var(--warn)">2 warnings</em></article></div><div class="workspace"><article class="panel"><div class="panel-head"><h2>Dataset · retention_q2.csv</h2><span class="pill">Validated</span></div><div class="panel-body"><label class="drop" id="drop"><input class="file-input" id="file" type="file" accept=".csv" /><span>⇧</span><strong>Drop a CSV to replace this dataset</strong><p>CSV up to 25 MB. Types and missing values are checked before saving.</p><button class="btn" id="browse">Choose file</button></label><div class="notice" id="notice">Dataset validated and ready. 1,248 rows · 24 variables · 2 warnings.</div><div class="toolbar"><input class="search" id="search" placeholder="Search variables…" /><select id="type"><option>All types</option><option>Numeric</option><option>Categorical</option></select></div><div class="table-wrap"><table><thead><tr><th>Variable</th><th>Type</th><th>Measure</th><th>Missing</th><th>Status</th></tr></thead><tbody id="variables"><tr data-type="Categorical"><td>plan_type</td><td>Categorical</td><td>Nominal</td><td>0.0%</td><td><span class="pill">Ready</span></td></tr><tr data-type="Numeric"><td>monthly_spend</td><td>Numeric</td><td>Scale</td><td>0.3%</td><td><span class="pill">Ready</span></td></tr><tr data-type="Numeric"><td>support_contacts</td><td>Numeric</td><td>Scale</td><td>3.1%</td><td><span class="pill warn">Review</span></td></tr><tr data-type="Categorical"><td>churned</td><td>Categorical</td><td>Binary</td><td>0.0%</td><td><span class="pill">Ready</span></td></tr></tbody></table><div class="empty" id="empty">No variables match these filters.</div></div></div></article><aside class="panel"><div class="panel-head"><h2>Analysis setup</h2><span class="pill warn" id="state">Draft</span></div><div class="panel-body studio"><div class="field"><label for="method">Method</label><select id="method"><option value="">Choose a method</option><option>Logistic regression</option><option>Independent t-test</option><option>One-way ANOVA</option><option>Pearson correlation</option></select></div><div class="field"><label for="outcome">Outcome variable</label><select id="outcome"><option value="">Select outcome</option><option>churned</option><option>monthly_spend</option></select></div><div class="field"><label for="predictor">Predictor</label><select id="predictor"><option value="">Select predictor</option><option>monthly_spend</option><option>support_contacts</option><option>plan_type</option></select></div><div class="assumptions"><div class="check">✓ Sample size <b>PASS</b></div><div class="check">✓ Missingness <b>PASS</b></div><div class="check">! Outliers <b style="color:var(--warn)">REVIEW</b></div></div><button class="btn primary" id="run" disabled>Run analysis</button><div class="result" id="result"><strong>Logistic regression complete</strong><p style="color:var(--muted);font-size:12px">Generated from the current dataset and configuration.</p><div class="bars"><i class="bar" style="height:38%"></i><i class="bar" style="height:62%"></i><i class="bar" style="height:48%"></i><i class="bar" style="height:84%"></i><i class="bar" style="height:70%"></i></div><div class="result-grid"><div class="stat"><small>McFadden R²</small><strong>.31</strong></div><div class="stat"><small>Odds ratio</small><strong>1.84</strong></div><div class="stat"><small>p-value</small><strong>&lt;.001</strong></div></div></div></div></aside></div></section></main></div><div class="toast" id="toast"></div>
<script>
const toast=(message)=>{const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2200)};document.querySelectorAll('.nav-item').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(item=>item.classList.remove('active'));button.classList.add('active');toast(button.dataset.view+' workspace selected')}));const file=document.getElementById('file'),drop=document.getElementById('drop');document.getElementById('browse').onclick=()=>file.click();['dragenter','dragover'].forEach(name=>drop.addEventListener(name,event=>{event.preventDefault();drop.classList.add('drag')}));['dragleave','drop'].forEach(name=>drop.addEventListener(name,event=>{event.preventDefault();drop.classList.remove('drag')}));drop.addEventListener('drop',event=>load(event.dataTransfer.files[0]));file.onchange=()=>load(file.files[0]);function load(selected){if(!selected)return;if(!selected.name.endsWith('.csv')){toast('Please choose a CSV file');return}document.getElementById('notice').classList.add('show');document.getElementById('row-count').textContent='1,248';toast(selected.name+' validated')};const controls=['method','outcome','predictor'].map(id=>document.getElementById(id));controls.forEach(control=>control.onchange=()=>{document.getElementById('run').disabled=!controls.every(item=>item.value);document.getElementById('state').textContent=controls.every(item=>item.value)?'Ready':'Draft'});document.getElementById('run').onclick=()=>{const button=document.getElementById('run');button.disabled=true;button.textContent='Running checks…';setTimeout(()=>{button.textContent='Run again';button.disabled=false;document.getElementById('result').classList.add('show');document.getElementById('state').textContent='Complete';document.getElementById('analysis-count').textContent='7';toast('Analysis saved to this project')},650)};document.getElementById('new-analysis').onclick=()=>{controls.forEach(item=>item.value='');document.getElementById('result').classList.remove('show');document.getElementById('run').disabled=true;document.getElementById('state').textContent='Draft';toast('New analysis started')};document.getElementById('export').onclick=()=>toast('Report prepared for export');function filter(){const query=document.getElementById('search').value.toLowerCase(),type=document.getElementById('type').value;let visible=0;document.querySelectorAll('#variables tr').forEach(row=>{const show=row.textContent.toLowerCase().includes(query)&&(type==='All types'||row.dataset.type===type);row.hidden=!show;if(show)visible++});document.getElementById('empty').style.display=visible?'none':'block'}document.getElementById('search').oninput=filter;document.getElementById('type').onchange=filter;
</script></body></html>`;
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

  const previewHtml = plan.dataModel.some((table) =>
    ["datasets", "analyses", "results"].includes(table.table)
  ) ? statisticsPreview(plan) : `<!doctype html>
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
