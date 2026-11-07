"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ExternalLink, Loader2, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BEGINNER_CODE_TEMPLATES } from "@/lib/projects/beginner-catalog";
import { GITHUB_APP_TEMPLATES } from "@/lib/projects/github-app-templates";

type Source = "All" | "BuildRx original" | "Pinned GitHub";
type Level = "All" | "Beginner" | "Intermediate";

const catalog = [
  ...BEGINNER_CODE_TEMPLATES.map(template => ({
    ...template,
    origin: "BuildRx original" as const,
    sourceUrl: null as string | null,
    requiresExternalService: false,
    setupNote: template.nextStep,
  })),
  ...GITHUB_APP_TEMPLATES.map(template => ({
    ...template,
    origin: "Pinned GitHub" as const,
    sourceUrl: template.sourceUrl as string | null,
    storage: undefined as string | undefined,
  })),
];

export function StarterVault() {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source>("All");
  const [level, setLevel] = useState<Level>("All");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => catalog.filter(template => {
    const matchesQuery = [
      template.name, template.description, template.category, template.setupNote,
    ].join(" ").toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (source === "All" || template.origin === source) &&
      (level === "All" || template.difficulty === level);
  }), [query, source, level]);

  async function clone(templateId: string) {
    if (busy) return;
    setBusy(templateId);
    try {
      const response = await fetch("/api/projects/import-github-starter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 401) {
        toast.error("Sign in to save a private template clone.");
        window.location.assign("/login?next=/templates");
        return;
      }
      if (!response.ok || typeof body.projectId !== "string") {
        throw new Error(typeof body.error === "string" ? body.error : "Could not copy this starter.");
      }
      toast.success("Starter cloned as a private draft. Customize and verify before publishing.");
      window.location.assign("/projects/" + encodeURIComponent(body.projectId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Clone failed.");
    } finally {
      setBusy(null);
    }
  }

  return <div className="space-y-6">
    <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
        Safe-start cloning vault
      </div>
      <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
        Pick a real code starter. BuildRx copies the code into your own private draft,
        checks it for suspicious patterns and preserves license and origin information.
        You do not need a GitHub token for these approved public examples.
      </p>
      <p className="text-muted-foreground mt-2 text-xs">
        A security scan is not a guarantee of safety. No dependencies are installed, no code is
        executed during cloning, and nothing is automatically deployed.
      </p>
    </div>

    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute left-3 top-2.5 size-4" aria-hidden="true" />
        <Input aria-label="Search starter templates" placeholder="Search websites, tasks, stock, blogs, login..."
          value={query} onChange={event => setQuery(event.target.value)} className="pl-9" />
      </div>
      <select aria-label="Filter template source" value={source}
        onChange={event => setSource(event.target.value as Source)}
        className="bg-background h-9 rounded-md border px-3 text-sm">
        <option value="All">All sources</option>
        <option value="BuildRx original">BuildRx originals</option>
        <option value="Pinned GitHub">Pinned GitHub</option>
      </select>
      <select aria-label="Filter beginner level" value={level}
        onChange={event => setLevel(event.target.value as Level)}
        className="bg-background h-9 rounded-md border px-3 text-sm">
        <option value="All">All levels</option>
        <option value="Beginner">Beginner</option>
        <option value="Intermediate">Intermediate</option>
      </select>
    </div>
    <p className="text-muted-foreground text-xs" role="status">
      Showing {filtered.length} of {catalog.length} real-code starter templates.
    </p>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {filtered.map(template => <article key={template.id}
        className="flex h-full flex-col gap-3 rounded-xl border bg-background p-4">
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded bg-primary/10 px-2 py-1 text-primary">{template.category}</span>
          <span className="rounded bg-muted px-2 py-1">{template.difficulty}</span>
          <span className="rounded bg-muted px-2 py-1">{template.origin}</span>
        </div>
        <h2 className="text-base font-semibold">{template.name}</h2>
        <p className="text-muted-foreground flex-1 text-sm leading-6">{template.description}</p>
        <div className="rounded-lg bg-muted/30 p-3 text-xs leading-5">
          <strong>First step:</strong> {template.setupNote}
          {template.storage === "Browser only" && <p className="mt-2 text-amber-700 dark:text-amber-300">
            Local demo data only; not for sensitive customer records.
          </p>}
          {template.requiresExternalService && <p className="mt-2 text-amber-700 dark:text-amber-300">
            Requires a separately configured account or database.
          </p>}
        </div>
        {template.sourceUrl && <a href={template.sourceUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-4">
          View original pinned GitHub source <ExternalLink className="size-3" />
        </a>}
        <Button type="button" onClick={() => void clone(template.id)} disabled={busy !== null}
          aria-label={"Clone " + template.name + " to a private project"}>
          {busy === template.id ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
          {busy === template.id ? "Copying source..." : "Clone to my project"}
        </Button>
      </article>)}
    </div>
    {filtered.length === 0 && <p className="text-muted-foreground rounded-xl border p-6 text-sm">
      No matching starters. Try a different search or filter.
    </p>}
    <p className="text-muted-foreground text-sm leading-6">
      Every clone opens as a Draft, not a published or certified app.
      Review the included README and source attribution, test the main workflow,
      and check dependencies before hosting it.
    </p>
  </div>;
}
