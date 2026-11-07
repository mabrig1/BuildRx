"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, GitCompareArrows, Search, ShieldCheck, Sparkles } from "lucide-react";

import { GuidedClonePanel } from "@/components/projects/guided-clone-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TEMPLATE_GUIDES, type TemplateCategory, type TemplateGuide,
} from "@/lib/projects/template-guides";

const categories = [
  "All categories", "Business apps", "Education", "E-commerce",
  "Inventory", "Booking", "Dashboards", "AI tools",
] as const;
type CategoryFilter = "All categories" | TemplateCategory;
type StateFilter = "All sources" | "Approved code" | "Planned";
type DifficultyFilter = "All levels" | TemplateGuide["difficulty"];

export function StarterVault() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All categories");
  const [source, setSource] = useState<StateFilter>("All sources");
  const [level, setLevel] = useState<DifficultyFilter>("All levels");
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);

  // Remember only an approved catalog ID, never a source URL or credential.
  useEffect(() => {
    try {
      const id = window.localStorage.getItem("buildrx:guided-clone:active");
      if (id && TEMPLATE_GUIDES.some(t => t.id === id)) setSelected(id);
    } catch { /* Storage may be disabled; browsing still works. */ }
  }, []);

  function selectGuide(id: string | null) {
    setSelected(id);
    try {
      if (id) window.localStorage.setItem("buildrx:guided-clone:active", id);
      else window.localStorage.removeItem("buildrx:guided-clone:active");
    } catch { /* Local persistence is optional. */ }
  }

  const filtered = useMemo(() => TEMPLATE_GUIDES.filter(t => {
    const text = [t.name, t.description, t.category, t.origin, t.nextAction, ...t.services]
      .join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase()) &&
      (category === "All categories" || t.category === category) &&
      (source === "All sources" ||
        (source === "Approved code" && t.state === "source-reviewed") ||
        (source === "Planned" && t.state === "planned")) &&
      (level === "All levels" || level === t.difficulty);
  }), [query, category, source, level]);

  const selectedGuide = TEMPLATE_GUIDES.find(t => t.id === selected);
  const compared = compare.map(id => TEMPLATE_GUIDES.find(t => t.id === id))
    .filter((t): t is TemplateGuide => Boolean(t));

  function toggleCompare(id: string) {
    setCompare(prev => prev.includes(id) ? prev.filter(v => v !== id) :
      prev.length < 3 ? [...prev, id] : prev);
  }

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-blue-500/5 p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
        BUILD RX · VERIFIED-SOURCE FIRST
        <span className="rounded-full border bg-background px-2 py-1 text-muted-foreground">Fail closed</span>
      </div>
      <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
        Find your starting point. Build with evidence.
      </h2>
      <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-6">
        Explore real, editable BuildRx code and commit-pinned official GitHub examples.
        Compare what works in a local demo with what still needs a database, security review,
        tests or deployment. Planned ideas cannot be cloned.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-background/80 p-4">
          <strong className="text-2xl">{TEMPLATE_GUIDES.filter(t => t.state === "source-reviewed").length}</strong>
          <p className="text-muted-foreground text-xs">Approved, source-reviewed clone IDs</p>
        </div>
        <div className="rounded-xl border bg-background/80 p-4">
          <strong className="text-2xl">{TEMPLATE_GUIDES.filter(t => t.state === "planned").length}</strong>
          <p className="text-muted-foreground text-xs">Future concepts, no source available</p>
        </div>
        <div className="rounded-xl border bg-background/80 p-4">
          <strong className="text-2xl">0 claimed</strong>
          <p className="text-muted-foreground text-xs">Verified live deployments from this catalog</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Reviewed source is not proof of safe dependencies, app correctness, working integrations,
        green CI or an accessible live URL. Nothing executes or deploys when imported.
      </p>
    </section>

    {selectedGuide && <div id="guided-clone">
      <GuidedClonePanel key={selectedGuide.id} template={selectedGuide} onClose={() => selectGuide(null)} />
    </div>}

    <section aria-label="Template catalog filters" className="rounded-2xl border p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold">Explore templates</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="relative block lg:col-span-1">
          <span className="sr-only">Search templates</span>
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-2.5 size-4" />
          <Input value={query} onChange={e => setQuery(e.target.value)} className="pl-9"
            placeholder="Search apps and services" />
        </label>
        <label>
          <span className="sr-only">Filter template category</span>
          <select value={category} onChange={e => setCategory(e.target.value as CategoryFilter)}
            className="bg-background h-9 w-full rounded-md border px-3 text-sm">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter template availability</span>
          <select value={source} onChange={e => setSource(e.target.value as StateFilter)}
            className="bg-background h-9 w-full rounded-md border px-3 text-sm">
            {(["All sources", "Approved code", "Planned"] as const).map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter difficulty</span>
          <select value={level} onChange={e => setLevel(e.target.value as DifficultyFilter)}
            className="bg-background h-9 w-full rounded-md border px-3 text-sm">
            {(["All levels", "Beginner", "Intermediate"] as const).map(s => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <p role="status" className="text-muted-foreground mt-3 text-xs">
        Showing {filtered.length} of {TEMPLATE_GUIDES.length} entries. Select up to 3 to compare.
      </p>
    </section>

    {compared.length > 0 && <section aria-label="Template comparison" className="space-y-3 rounded-2xl border p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <GitCompareArrows className="size-4" /> Compare ({compared.length}/3)
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setCompare([])}>Clear</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left text-sm">
          <caption className="sr-only">Side-by-side source, services and next steps</caption>
          <thead><tr className="border-b">
            <th scope="col" className="p-2">Evidence</th>
            {compared.map(t => <th key={t.id} scope="col" className="p-2">{t.name}</th>)}
          </tr></thead>
          <tbody>
            {([
              ["Category", (t: TemplateGuide) => t.category],
              ["Difficulty", (t: TemplateGuide) => t.difficulty],
              ["Source", (t: TemplateGuide) => t.origin + " · " + (t.state === "planned" ? "not approved" : "pinned/reviewed")],
              ["Deployment", (t: TemplateGuide) => t.deployed],
              ["Services", (t: TemplateGuide) => t.services.join("; ")],
              ["Assumptions", (t: TemplateGuide) => t.assumptions.join("; ")],
              ["Smallest next step", (t: TemplateGuide) => t.nextAction],
            ] as Array<[string, (t: TemplateGuide) => string]>).map(([label, getter]) =>
              <tr key={label} className="border-b align-top">
                <th scope="row" className="p-2 font-medium">{label}</th>
                {compared.map(t => <td key={t.id} className="min-w-[165px] p-2 text-muted-foreground">
                  {getter(t)}
                </td>)}
              </tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        Source provenance is reviewed; environment readiness and deployment are not automatically checked.
      </p>
    </section>}

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map(t => <article key={t.id} className="flex flex-col rounded-2xl border bg-background p-5 shadow-sm">
        <div className="flex flex-wrap gap-2 text-[11px] font-medium">
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{t.category}</span>
          <span className="rounded-full bg-muted px-2.5 py-1">{t.difficulty}</span>
          <span className={t.state === "source-reviewed"
            ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300"
            : "rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300"}>
            {t.state === "source-reviewed" ? "Source reviewed" : "Planned only"}
          </span>
        </div>
        <h3 className="mt-4 text-lg font-semibold">{t.name}</h3>
        <p className="text-muted-foreground mt-2 flex-1 text-sm leading-6">{t.description}</p>
        <dl className="mt-4 space-y-2 rounded-lg bg-muted/40 p-3 text-xs">
          <div><dt className="font-semibold">Repository</dt>
            <dd className="text-muted-foreground">{t.sourceUrl ? t.origin : "None approved"}</dd></div>
          <div><dt className="font-semibold">Deployment</dt>
            <dd className="text-muted-foreground">{t.deployed}</dd></div>
          <div><dt className="font-semibold">Requires</dt>
            <dd className="text-muted-foreground">{t.services.join(", ")}</dd></div>
          <div><dt className="font-semibold">Assumption (not checked)</dt>
            <dd className="text-muted-foreground">{t.assumptions.join("; ")}</dd></div>
          <div><dt className="font-semibold">Next action</dt>
            <dd className="text-muted-foreground">{t.nextAction}</dd></div>
        </dl>
        {t.sourceUrl && <a href={t.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4">
          View source evidence <ExternalLink className="size-3" />
        </a>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="flex-1" onClick={() => {
            selectGuide(t.id);
            window.requestAnimationFrame(() =>
              document.getElementById("guided-clone")?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }}>
            {t.state === "planned" ? "View plan" : "Guided clone"}
          </Button>
          <Button variant={compare.includes(t.id) ? "secondary" : "outline"} type="button"
            disabled={!compare.includes(t.id) && compare.length >= 3}
            aria-pressed={compare.includes(t.id)}
            aria-label={(compare.includes(t.id) ? "Remove " : "Compare ") + t.name}
            onClick={() => toggleCompare(t.id)}>
            {compare.includes(t.id) ? <Check className="size-4" /> : <GitCompareArrows className="size-4" />}
          </Button>
        </div>
      </article>)}
    </div>
    {filtered.length === 0 && <p className="text-muted-foreground rounded-xl border p-6 text-sm">
      No matching templates. Clear the search or choose another category.
    </p>}
    <section className="rounded-xl border p-4 text-sm">
      <h2 className="font-semibold">Preview reported HTTP 404?</h2>
      <p className="text-muted-foreground mt-2 leading-6">
        The earlier BuildRx checker fetched an owner-protected preview using a separate
        server-to-server request, which could return 404 without the signed-in user context.
        A merged fix verifies the saved HTML through the owner-scoped handler instead
        and adds a Repair path for saved builds. This is not proof that your deployed
        instance has picked up the fix or that the generated application can run.
      </p>
      <a className="mt-2 inline-flex items-center gap-1 text-primary underline"
        href="https://github.com/mabrig1/BuildRx/pull/51"
        target="_blank" rel="noopener noreferrer">
        Read merged preview fix PR #51 <ExternalLink className="size-3" />
      </a>
      <p className="text-muted-foreground mt-2">
        In an existing project, open the code workspace and enter <strong>Repair</strong>
        after the latest BuildRx version is available. Check the saved preview file,
        RLS access and browser iframe behavior before declaring the app verified.
      </p>
    </section>
  </div>;
}
