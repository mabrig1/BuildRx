"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardCopy, ExternalLink, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { TemplateGuide } from "@/lib/projects/template-guides";

const KEYS = ["source", "security", "readme", "dependencies", "local", "github", "cloudflare", "vercel"] as const;
type Key = (typeof KEYS)[number];
const LABELS: Record<Key, string> = {
  source: "I reviewed the exact source, license and attribution",
  security: "I understand the scan cannot guarantee security; this remains a private Draft",
  readme: "I opened the README and setup instructions",
  dependencies: "I inspected package versions and dependency advisories",
  local: "I ran the app and tested its primary workflow locally",
  github: "I inspected relevant GitHub Actions run results",
  cloudflare: "I reviewed Cloudflare readiness (no deployment performed)",
  vercel: "I reviewed Vercel readiness (no deployment performed)",
};

type Progress = {
  name: string;
  audience: string;
  rollback: string;
  githubRun: string;
  projectId: string;
  completed: Partial<Record<Key, boolean>>;
};

const empty = (): Progress => ({
  name: "", audience: "", rollback: "", githubRun: "", projectId: "", completed: {},
});
const STORAGE_PREFIX = "buildrx:guided-clone:v1:";
const validGitHubRun = (value: string) =>
  value === "" || /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/runs\/[0-9]+$/.test(value);

function loadProgress(id: string): Progress {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (!raw) return empty();
    const value = JSON.parse(raw) as Partial<Progress>;
    if (!value || typeof value !== "object") return empty();
    const completed: Partial<Record<Key, boolean>> = {};
    for (const k of KEYS) if (value.completed?.[k] === true) completed[k] = true;
    return {
      name: typeof value.name === "string" ? value.name.slice(0, 80) : "",
      audience: typeof value.audience === "string" ? value.audience.slice(0, 100) : "",
      rollback: typeof value.rollback === "string" ? value.rollback.slice(0, 300) : "",
      githubRun: typeof value.githubRun === "string" && validGitHubRun(value.githubRun) ? value.githubRun : "",
      projectId: typeof value.projectId === "string" && /^[a-f\d-]{36}$/i.test(value.projectId) ? value.projectId : "",
      completed,
    };
  } catch {
    return empty();
  }
}

/** Guided progress is local-only. Do not accept/retain credentials or claim remote readiness. */
export function GuidedClonePanel({ template, onClose }: { template: TemplateGuide; onClose: () => void }) {
  const [progress, setProgress] = useState<Progress>(empty);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  useEffect(() => {
    setProgress(loadProgress(template.id));
    setLoaded(true);
  }, [template.id]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_PREFIX + template.id, JSON.stringify(progress));
    } catch {
      setStorageAvailable(false);
    }
  }, [loaded, progress, template.id]);

  const change = (field: "name" | "audience" | "rollback" | "githubRun", value: string) => {
    const max = field === "rollback" ? 300 : field === "githubRun" ? 180 : 100;
    // Explicitly block credential-looking strings from the browser-side notes.
    if (/(sk-(?:live|test)-|ghp_|gho_|github_pat_|eyJhbGciOi|-----BEGIN .*PRIVATE KEY-----)/i.test(value)) {
      toast.error("Do not paste keys or credentials into this guide.");
      return;
    }
    setProgress(p => ({ ...p, [field]: value.slice(0, max) }));
  };
  const toggle = (key: Key) => setProgress(p => ({
    ...p, completed: { ...p.completed, [key]: !p.completed[key] },
  }));
  const ready = template.state === "source-reviewed" &&
    progress.completed.source === true && progress.completed.security === true;

  async function clone() {
    if (!ready || saving || progress.projectId) return;
    setSaving(true);
    try {
      // Only the allowlisted catalog ID is transmitted. Configuration notes,
      // status claims, credentials and repository URLs never reach this API.
      const response = await fetch("/api/projects/import-github-starter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });
      const result: { projectId?: unknown; error?: unknown; imported?: unknown; deployed?: unknown; verified?: unknown } =
        await response.json().catch(() => ({}));
      if (response.status === 401) {
        toast.error("Sign in to save a private Draft. Your local checklist remains on this device.");
        return;
      }
      if (!response.ok || result.imported !== true || typeof result.projectId !== "string" ||
          result.deployed !== false || result.verified !== false ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.projectId)) {
        throw new Error(typeof result.error === "string" ? result.error : "Import was not confirmed.");
      }
      setProgress(p => ({ ...p, projectId: result.projectId as string }));
      toast.success("Private Draft saved. It has not been deployed or certified.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Clone failed safely.");
    } finally {
      setSaving(false);
    }
  }

  const brief = [
    "Customize approved starter: " + template.name,
    "Working title: " + (progress.name || template.name),
    "Audience: " + (progress.audience || "Not specified"),
    "Editable features: " + template.editable.join(", "),
    "Source: " + (template.sourceUrl || "Not approved"),
    "Required services: " + template.services.join(", "),
    "Environment variable NAMES (not values): " + (template.envKeys.join(", ") || "None"),
    "Build only in a private Draft. Verify functionality, authorization, and preview; never claim deployment or external notifications.",
  ].join("\n");

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(brief);
      toast.success("Customization brief copied. Paste it into the project AI chat after cloning.");
    } catch {
      toast.error("Clipboard unavailable; select and copy the text manually.");
    }
  }

  function reset() {
    if (progress.projectId) {
      toast.error("Clearing notes does not delete a saved project. Open Projects to manage your Draft.");
    }
    try {
      window.localStorage.removeItem(STORAGE_PREFIX + template.id);
    } catch {
      setStorageAvailable(false);
    }
    setProgress(empty());
  }

  return (
    <section className="rounded-2xl border-2 border-primary/30 bg-background p-4 shadow-sm sm:p-6"
      aria-label={"Guided clone workflow for " + template.name}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Guided safe-start</p>
          <h2 className="mt-1 text-xl font-bold">{template.name}</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Browser-only checklist and configuration notes. Clone saves real source as a private Draft.
          </p>
        </div>
        <Button variant="outline" size="sm" type="button" onClick={onClose}>Close</Button>
      </div>
      {!storageAvailable && <p role="alert" className="mb-3 rounded-md bg-amber-500/10 p-2 text-sm">
        Local storage is unavailable. Notes may be lost on refresh.
      </p>}
      <div className="mb-5 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border p-3">
          <strong className="block">Source evidence</strong>
          <span>{template.state === "source-reviewed" ? "Source reviewed — not runtime-certified" : "Planned — no approved source"}</span>
        </div>
        <div className="rounded-lg border p-3">
          <strong className="block">Deployment status</strong><span>Not verified / not deployed here</span>
        </div>
        <div className="rounded-lg border p-3">
          <strong className="block">Safety boundary</strong><span>Allowlist only · private Draft · no execution on import</span>
        </div>
      </div>
      {template.sourceUrl ? <a className="mb-4 inline-flex items-center gap-1 text-sm text-primary underline"
          href={template.sourceUrl} target="_blank" rel="noopener noreferrer">
        Inspect exact source <ExternalLink className="size-3" />
      </a> : <p className="mb-4 text-sm text-amber-700 dark:text-amber-300">
        No safe clone is offered: the source and licensing have not been approved.
      </p>}
      <p className="mb-5 rounded-md border border-dashed p-3 text-xs text-muted-foreground"><strong>Source evidence:</strong> {template.sourceNote}</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="font-semibold">1. Plan your customization</h3>
          <label className="block text-sm">Project working name
            <Input className="mt-1" maxLength={80} value={progress.name}
              onChange={e => change("name", e.target.value)} placeholder="e.g. Nsukka Bookings" />
          </label>
          <label className="block text-sm">Who will use it?
            <Input className="mt-1" maxLength={100} value={progress.audience}
              onChange={e => change("audience", e.target.value)} placeholder="e.g. local businesses" />
          </label>
          <div>
            <h4 className="text-sm font-medium">Assumptions — not verified</h4>
            <p className="text-muted-foreground mt-1 text-sm">{template.assumptions.join(" · ")}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium">Editable features</h4>
            <p className="text-muted-foreground mt-1 text-sm">{template.editable.join(" · ")}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium">Required services (not automatically configured)</h4>
            <p className="text-muted-foreground mt-1 text-sm">{template.services.join(" · ")}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium">Environment variable placeholders — names only</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {template.envKeys.length ? template.envKeys.map(key => <code key={key}
                className="break-all rounded bg-muted px-2 py-1 text-xs">{key}=YOUR_VALUE_IN_PRIVATE_SETTINGS</code>) :
                <span className="text-muted-foreground text-sm">None needed for initial demo.</span>}
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Do not put actual secret values in this page or client-side environment variables.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium">Setup steps</h4>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {template.setup.map(s => <li key={s}>{s}</li>)}
            </ol>
          </div>
          <div><h4 className="text-sm font-medium">Safe-start checklist — guidance, not test results</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{template.safeStart.map(item => <li key={item}>{item}</li>)}</ul>
          </div>
          <p className="rounded-md bg-muted/50 p-3 text-sm"><strong>Smallest next action:</strong> {template.nextAction}</p>
        </div>
        <div className="space-y-4">
          <h3 className="font-semibold">2. Record checks without pretending they ran</h3>
          <div className="space-y-2">
            {KEYS.map(key => <label key={key} className="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-sm">
              <input className="mt-1 size-4 shrink-0 accent-primary" type="checkbox"
                checked={progress.completed[key] === true} onChange={() => toggle(key)} />
              <span>{LABELS[key]}<span className="text-muted-foreground block text-xs">
                {progress.completed[key] ? "Self-reported complete; not independently verified" : "Not checked"}
              </span></span>
            </label>)}
          </div>
          <label className="block text-sm">GitHub workflow run URL (optional, self-reported)
            <Input className="mt-1" maxLength={180} value={progress.githubRun}
              onChange={e => change("githubRun", e.target.value)}
              placeholder="https://github.com/owner/repo/actions/runs/123" />
          </label>
          {progress.githubRun && !validGitHubRun(progress.githubRun) &&
            <p className="text-sm text-destructive">Use an exact GitHub Actions run URL or leave blank.</p>}
          <p className="text-muted-foreground text-xs">
            GitHub checks, Cloudflare readiness and Vercel readiness are not queried automatically.
            Ticking them is your own record, not a verified green build or deployment.
          </p>
          <label className="block text-sm">Rollback notes (do not include credentials)
            <Textarea className="mt-1" rows={3} maxLength={300}
              value={progress.rollback} onChange={e => change("rollback", e.target.value)}
              placeholder={template.rollback} />
          </label>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-5">
        {template.state === "planned" ? <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          Planned only. Cloning disabled pending source review.
        </p> : progress.projectId ? <>
          <span className="inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-4" /> Private Draft created; not deployed.
          </span>
          <Button asChild><Link href={"/projects/" + encodeURIComponent(progress.projectId)}>
            Open code workspace <ArrowRight className="size-4" />
          </Link></Button>
        </> : <Button type="button" disabled={!ready || saving || !validGitHubRun(progress.githubRun)}
            onClick={() => void clone()}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          {saving ? "Importing approved source..." : "Create private Draft from approved source"}
        </Button>}
        <Button variant="outline" type="button" onClick={() => void copyBrief()}>
          <ClipboardCopy className="size-4" /> Copy customization brief
        </Button>
        <Button variant="ghost" type="button" onClick={reset}>
          <RotateCcw className="size-4" /> Clear local notes
        </Button>
      </div>
      {!ready && template.state === "source-reviewed" &&
        <p className="text-muted-foreground mt-2 text-xs">Before cloning, review the origin and accept the security/Draft boundary in step 2.</p>}
      <p className="text-muted-foreground mt-3 text-xs">
        This guide saves non-secret notes only in this device&apos;s browser, not in your BuildRx project.
        The copy API receives only the fixed template ID. Browser data can be cleared; the private Draft
        can be managed separately in Projects. No token, deployment or provider settings are created.
      </p>
    </section>
  );
}
