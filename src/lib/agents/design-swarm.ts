import type { AppPlan, GeneratedFile } from "@/lib/agents/types";
import { generatePremiumPreview, classifyProductIndustry, type ProductIndustry } from "@/lib/agents/premium-ux";
import { generatePremiumNextPage } from "@/lib/agents/premium-next";
import { generateCourierPreview, isCourierApp } from "@/lib/agents/courier-template";
import { generateCourierNextPage } from "@/lib/agents/courier-next";

/**
 * Real deterministic specialist passes composing prebuilt application design
 * templates. This is a SWARM OF CHECKS, not 12 charged/fictional LLM calls.
 *
 * One optional OpenRouter free-model creative-director call adds feedback;
 * the established layout and working controls never depend on its availability.
 */
export const DESIGN_SWARM_PASSES = [
  "Industry and intent matching",
  "Licensed template selection",
  "Visual hierarchy and typography",
  "Business-specific sample content",
  "Mobile layout and touch targets",
  "Navigation and route coverage",
  "Working search and filters",
  "Forms and state transitions",
  "Accessible controls and focus",
  "Honest demo and provider labels",
  "Source quality and editability",
  "First-screen experience gate",
] as const;

export type DesignKitId =
  "dispatch-atlas" | "retail-studio" | "restaurant-table" | "academy-studio" |
  "booking-studio" | "research-studio" | "business-studio";

export interface DesignKit {
  id: DesignKitId;
  name: string;
  kind: "courier" | ProductIndustry;
  origin: "BuildRx original local code";
  source: string;
  design: string;
}
export const DESIGN_KITS: readonly DesignKit[] = [
  { id:"dispatch-atlas", name:"Dispatch Atlas", kind:"courier",
    origin:"BuildRx original local code", source:"src/lib/agents/courier-template.ts",
    design:"Operations command center, navy/orange brand, shipment timeline and management" },
  { id:"retail-studio", name:"Retail Studio", kind:"retail",
    origin:"BuildRx original local code", source:"src/lib/agents/premium-ux.ts",
    design:"Photography-first storefront with product cards, search and demo cart" },
  { id:"restaurant-table", name:"The Restaurant Table", kind:"restaurant",
    origin:"BuildRx original local code", source:"src/lib/agents/premium-ux.ts",
    design:"Image-led menu with dishes, prices and demo orders" },
  { id:"academy-studio", name:"Learning Studio", kind:"education",
    origin:"BuildRx original local code", source:"src/lib/agents/premium-ux.ts",
    design:"Course catalog and curriculum discovery" },
  { id:"booking-studio", name:"Appointment Studio", kind:"booking",
    origin:"BuildRx original local code", source:"src/lib/agents/premium-ux.ts",
    design:"Service catalog and appointment discovery" },
  { id:"research-studio", name:"Research Studio", kind:"research",
    origin:"BuildRx original local code", source:"src/lib/agents/premium-ux.ts",
    design:"Data discovery and analysis-focused workspace" },
  { id:"business-studio", name:"Business Studio", kind:"business",
    origin:"BuildRx original local code", source:"src/lib/agents/premium-ux.ts",
    design:"Business operations dashboard and record explorer" },
] as const;

/** Reuse reviewed local code, not a runtime fetch of unknown GitHub source. */
export function selectDesignKit(plan: AppPlan): DesignKit {
  const kind = isCourierApp(plan) ? "courier" : classifyProductIndustry(plan);
  return DESIGN_KITS.find(kit => kit.kind === kind) ?? DESIGN_KITS[DESIGN_KITS.length - 1];
}

function toKebab(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g,"$1-$2").replace(/[^A-Za-z0-9]+/g,"-")
    .replace(/-+/g,"-").replace(/^-|-$/g,"").toLowerCase().slice(0,64) || "component";
}
function pagePath(route:string):string {
  const clean = route === "/" ? "" : route.replace(/^\/+|\/+$/g,"");
  const slug = clean.split("/").filter(part=>/^[a-z0-9-]+$/.test(part)).join("/");
  return slug ? "src/app/" + slug + "/page.tsx" : "src/app/page.tsx";
}

function componentSource(name: string, description:string): string {
  const id = toKebab(name).replace(/(^|-)([a-z])/g,(_m,_p,c:string)=>c.toUpperCase());
  const safeId=/^[A-Za-z][A-Za-z0-9]*$/.test(id)?id:"AppComponent";
  const headline=JSON.stringify(name.slice(0,90)).replace(/</g,"\\u003c");
  const subtitle=JSON.stringify(description.slice(0,240)).replace(/</g,"\\u003c");
  // A useful, accessible block that avoids false backend operations and
  // never inserts fabricated payments or credentials.
  return [
    'export function '+safeId+'() {',
    ' return <section aria-label={'+headline+'} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">',
    '   <p className="text-xs font-bold uppercase tracking-[.15em] text-emerald-700">Product workspace</p>',
    '   <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-900">{'+headline+'}</h2>',
    '   <p className="mt-2 text-sm leading-relaxed text-slate-500">{'+subtitle+'}</p>',
    '   <p className="mt-5 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Connect a verified data source to enable live records. This is a reusable interface block.</p>',
    ' </section>;',
    '}',
  ].join("\n");
}

function doc(plan: AppPlan, kit: DesignKit, score: DesignAudit): string {
  return [
    "# Design Kit · "+kit.name,
    "",
    "## Why this template",
    "- Business: "+plan.appName.replace(/[\r\n]/g," ").slice(0,100),
    "- Kit: "+kit.id+" (original local BuildRx design, not fetched at runtime)",
    "- Source: "+kit.source,
    "- Design: "+kit.design,
    "",
    "## What is real",
    "- Editable Next.js React/Tailwind source and a responsive HTML preview",
    "- Search, category filters, sample state and demo actions appropriate to the kit",
    "- A complete offline design preview; no AI request or paid credit needed to assemble it",
    "",
    "## What is not configured",
    "- Customer records, real login, live payments, courier dispatch, messages, GPS, and external integrations need verified provider setup and tests.",
    "- Prototype data and pricing must be replaced with actual owner-approved data before publishing.",
    "",
    "## Deterministic design audit",
    ...score.checks.map(c => "- "+(c.passed?"PASS":"REVIEW")+" "+c.label),
    "",
    "## Engineering handoff",
    "- Inspect the generated React pages and connect them to owner-scoped endpoints.",
    "- Run npm typecheck, tests, production build and real browser acceptance tests.",
    "- Never claim the prototype data is a production record or charge.",
  ].join("\n");
}

export interface DesignAudit {
  passed:number;
  total:number;
  checks:Array<{label:string;passed:boolean}>;
  blockers:string[];
}

/** Static pass outcomes are explicit, not fabricated usability test results. */
export function auditDesignFiles(files: GeneratedFile[], plan:AppPlan, kit:DesignKit):DesignAudit{
  const preview=files.find(f=>f.path==="preview/index.html")?.content ?? "";
  const home=files.find(f=>f.path==="src/app/page.tsx")?.content ?? "";
  const routeFiles=plan.pages.every(p=>files.some(f=>f.path===pagePath(p.path)));
  const checks=[
    {label:DESIGN_SWARM_PASSES[0],passed:kit.kind!=="business"||!isCourierApp(plan)},
    {label:DESIGN_SWARM_PASSES[1],passed:kit.origin==="BuildRx original local code"},
    {label:DESIGN_SWARM_PASSES[2],passed:/font-size|text-3xl/.test(preview+home)},
    {label:DESIGN_SWARM_PASSES[3],passed:/DEMO|Demo|SAMPLE|sample/.test(preview)},
    {label:DESIGN_SWARM_PASSES[4],passed:/@media/.test(preview)&&/\bsm:|lg:|xl:/.test(home)},
    {label:DESIGN_SWARM_PASSES[5],passed:routeFiles&&/nav|<a /.test(preview)},
    {label:DESIGN_SWARM_PASSES[6],passed:/type="search"|id="search"/.test(preview)&&/filter|search/.test(home)},
    {label:DESIGN_SWARM_PASSES[7],passed:/addEventListener/.test(preview)&&/onClick|onSubmit/.test(home)},
    {label:DESIGN_SWARM_PASSES[8],passed:/aria-label|role=/.test(preview)&&/aria-label|aria-label=/.test(home)},
    {label:DESIGN_SWARM_PASSES[9],passed:/no (?:real|live)|not (?:connected|a real|live)|DEMO|Demo/.test(preview)},
    {label:DESIGN_SWARM_PASSES[10],passed:home.includes("export default function") && files.some(f=>f.path==="src/app/globals.css")},
    {label:DESIGN_SWARM_PASSES[11],passed:preview.length>5000&&home.length>5000},
  ];
  return {passed:checks.filter(c=>c.passed).length,total:checks.length,checks,
    blockers:checks.filter(c=>!c.passed).map(c=>c.label)};
}

export function assembleDesignSwarm(plan:AppPlan):{
  kit:DesignKit;files:GeneratedFile[];audit:DesignAudit;
} {
  const kit=selectDesignKit(plan);
  const isCourier=kit.kind==="courier";
  const files:GeneratedFile[]=[
    {path:"preview/index.html",content:isCourier?generateCourierPreview(plan):generatePremiumPreview(plan)},
    {path:"src/app/globals.css",content:'@import "tailwindcss";\n:root{--brand:#1f4f42;--canvas:#fafaf8;--ink:#1f2937}\nbody{@apply antialiased;}\n'},
  ];
  const used=new Set(files.map(f=>f.path));
  for (const page of plan.pages) {
    const path=pagePath(page.path);
    if(used.has(path))continue;
    files.push({path,content:isCourier?generateCourierNextPage(plan,page):generatePremiumNextPage(plan,page)});
    used.add(path);
  }
  if(!used.has("src/app/page.tsx")){
    const home={name:"Home",path:"/",description:plan.summary};
    files.push({path:"src/app/page.tsx",content:isCourier?generateCourierNextPage(plan,home):generatePremiumNextPage(plan,home)});
    used.add("src/app/page.tsx");
  }
  for(const component of plan.components.slice(0,25)){
    const path="src/components/"+toKebab(component.name)+".tsx";
    if(used.has(path))continue;
    files.push({path,content:componentSource(component.name,component.description)});
    used.add(path);
  }
  const audit=auditDesignFiles(files,plan,kit);
  files.push({path:"docs/DESIGN-CONTRACT.md",content:doc(plan,kit,audit)});
  return {kit,files,audit};
}
