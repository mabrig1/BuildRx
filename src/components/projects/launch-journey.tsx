"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleHelp,
  Cloud,
  ExternalLink,
  GitBranch,
  Loader2,
  RefreshCw,
  Rocket,
  Triangle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  evaluateLaunchJourney,
  safeRepositoryName,
  validHttpsUrl,
  type DataNeed,
  type LaunchHost,
  type LaunchPreferences,
  type LaunchSignals,
} from "@/lib/projects/launch-journey";

const DEFAULT_CHOICES: LaunchPreferences = {
  host: "cloudflare",
  dataNeed: "unsure",
  databaseConfigured: false,
  liveUrl: "",
  liveTestsConfirmed: false,
};

type Deployment = LaunchSignals["deployments"][number];

function isDeployment(value: unknown): value is Deployment {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.provider === "string" && typeof row.status === "string" &&
    (row.url === null || typeof row.url === "string");
}

function restoreChoice(value: unknown): LaunchPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_CHOICES };
  const x = value as Record<string, unknown>;
  return {
    host: x.host === "vercel" ? "vercel" : "cloudflare",
    dataNeed: ["unsure", "none", "mongodb", "supabase"].includes(String(x.dataNeed))
      ? x.dataNeed as DataNeed : "unsure",
    databaseConfigured: x.databaseConfigured === true,
    liveUrl: typeof x.liveUrl === "string" && x.liveUrl.length <= 300 ? x.liveUrl : "",
    liveTestsConfirmed: x.liveTestsConfirmed === true,
  };
}

export function LaunchJourney({
  projectId,
  projectStatus,
  onOpenGithub,
  onOpenDeploy,
}: {
  projectId: string;
  projectStatus: string;
  onOpenGithub: () => void;
  onOpenDeploy: (host: LaunchHost) => void;
}) {
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<LaunchPreferences>(DEFAULT_CHOICES);
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [signals, setSignals] = useState<LaunchSignals>({
    projectStatus, githubConnected: null, githubRepo: null,
    githubSimulated: false, deployments: [], cloudflareCheck: null,
  });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`buildrx-journey:${projectId}`);
      if (raw) setChoices(restoreChoice(JSON.parse(raw)));
    } catch {
      // In private browsing mode the launch guide remains usable without persistence.
    }
    setHydrated(true);
  }, [projectId]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(`buildrx-journey:${projectId}`, JSON.stringify(choices));
    } catch {
      // Nothing secret is saved; browser storage is an optional convenience.
    }
  }, [choices, hydrated, projectId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const encoded = encodeURIComponent(projectId);
    try {
      const [git, history, cloudflare] = await Promise.allSettled([
        fetch(`/api/github/connection?projectId=${encoded}`, { cache: "no-store" }),
        fetch(`/api/deploy/history?projectId=${encoded}`, { cache: "no-store" }),
        choices.host === "cloudflare"
          ? fetch(`/api/deploy/cloudflare/status?projectId=${encoded}`, { cache: "no-store" })
          : Promise.resolve(null),
      ]);

      const gh = git.status === "fulfilled" && git.value.ok
        ? await git.value.json().catch(() => null) : null;
      const hist = history.status === "fulfilled" && history.value.ok
        ? await history.value.json().catch(() => null) : null;
      const cf = cloudflare.status === "fulfilled" && cloudflare.value?.ok
        ? await cloudflare.value.json().catch(() => null) : null;

      const states = ["not_connected", "building", "passed", "failed", "unknown"];
      setSignals({
        projectStatus,
        githubConnected: typeof gh?.connected === "boolean" ? gh.connected : null,
        githubRepo: typeof gh?.repo === "string" ? gh.repo : null,
        githubSimulated: gh?.simulated === true,
        deployments: Array.isArray(hist?.deployments)
          ? hist.deployments.filter(isDeployment).slice(0, 20) : [],
        cloudflareCheck: states.includes(cf?.state) ? cf.state : null,
      });
    } finally {
      setRefreshing(false);
    }
  }, [projectId, projectStatus, choices.host]);

  useEffect(() => {
    setSignals((s) => ({ ...s, projectStatus }));
  }, [projectStatus]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const journey = useMemo(() => evaluateLaunchJourney(signals, choices), [signals, choices]);
  const completed = journey.steps.filter(s => s.state === "done" || s.state === "self-reported").length;
  const repo = safeRepositoryName(signals.githubRepo);
  const latestVercel = signals.deployments.find(
    d => d.provider === "vercel" && d.status === "live" && !!d.url && validHttpsUrl(d.url),
  );
  const dataOptions: Array<{ id: DataNeed; label: string }> = [
    { id: "unsure", label: "Help me decide" },
    { id: "none", label: "No saved data" },
    { id: "mongodb", label: "MongoDB Atlas" },
    { id: "supabase", label: "Supabase" },
  ];

  function launchPanel(which: "github" | "deploy") {
    setOpen(false);
    if (which === "github") onOpenGithub();
    else onOpenDeploy(choices.host);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="default" className="gap-1.5" aria-label="What next? Guided app launch">
          <Rocket className="size-4" />
          <span>What next?</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Rocket className="size-4" /> Launch your app, one step at a time
          </SheetTitle>
          <SheetDescription>
            From AI-built code → GitHub → database (if needed) → Vercel or Cloudflare → working public app.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 px-4 py-4">
            <div role="status" className="rounded-lg border bg-muted/40 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">Your next move</p>
                <Badge variant="outline">{completed} / {journey.steps.length} milestones</Badge>
              </div>
              <p className="text-sm">{journey.next}</p>
              {journey.readyToReview ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Checklist completed as reported by you. BuildRx has not independently tested the public app.
                </p>
              ) : null}
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => void refresh()} disabled={refreshing}>
                {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Recheck actual status
              </Button>
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-semibold">1. Where do you want to publish?</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={choices.host === "cloudflare" ? "default" : "outline"}
                  className="justify-start gap-2"
                  onClick={() => setChoices(c => ({ ...c, host: "cloudflare", liveTestsConfirmed: false, liveUrl: "" }))}
                >
                  <Cloud className="size-4" /> Cloudflare
                </Button>
                <Button
                  variant={choices.host === "vercel" ? "default" : "outline"}
                  className="justify-start gap-2"
                  onClick={() => setChoices(c => ({ ...c, host: "vercel", liveTestsConfirmed: false, liveUrl: "" }))}
                >
                  <Triangle className="size-4" /> Vercel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {choices.host === "cloudflare"
                  ? "Cloudflare is a GitHub-to-Workers handoff today; it is not automatic one-click BuildRx hosting."
                  : "Vercel can host the generated Next.js app. A preview-only HTML page is not a complete deployment."}
              </p>
            </div>

            <div className="grid gap-3">
              <p className="text-sm font-semibold">2. Follow these steps</p>
              <ol className="flex flex-col gap-2">
                {journey.steps.map((step, index) => (
                  <li key={step.id} className="rounded-lg border p-3">
                    <div className="flex items-start gap-2">
                      {step.state === "done"
                        ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        : step.state === "self-reported"
                          ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          : <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{index + 1}</span>}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{step.title}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {step.state === "done" ? "Reported by BuildRx" : step.state === "self-reported"
                              ? "You marked this" : step.state === "waiting" ? "Checks, not live proof" : "Next action"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>

                        {step.id === "github" ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="outline" onClick={() => launchPanel("github")}>
                              <GitBranch className="mr-1.5 size-3.5" /> Open GitHub
                            </Button>
                            {repo ? (
                              <a className="text-xs underline" target="_blank" rel="noreferrer" href={`https://github.com/${repo}`}>
                                Inspect linked repo <ExternalLink className="inline size-3" />
                              </a>
                            ) : null}
                          </div>
                        ) : null}

                        {step.id === "database" ? (
                          <div className="mt-3 grid gap-2">
                            <div className="flex flex-wrap gap-1.5">
                              {dataOptions.map(option => (
                                <Button
                                  key={option.id}
                                  size="sm"
                                  variant={choices.dataNeed === option.id ? "default" : "outline"}
                                  onClick={() => setChoices(c => ({ ...c, dataNeed: option.id, databaseConfigured: false, liveTestsConfirmed: false }))}
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </div>
                            {choices.dataNeed === "unsure" && (
                              <p className="text-xs">If your app has login, bookings, customers or saved records, it needs real persistence. Choose a backend used by the generated code—not a new database just for the sake of it.</p>
                            )}
                            {(choices.dataNeed === "mongodb" || choices.dataNeed === "supabase") && (
                              <div className="rounded-md bg-muted/40 p-3 text-xs">
                                <p className="font-medium">Setup checklist</p>
                                <p className="mt-1">
                                  {choices.dataNeed === "mongodb"
                                    ? "Create an Atlas cluster, database user and secure network access. For server-only usage, configure MONGODB_URI (and MONGODB_DATABASE if the app expects it)."
                                    : "Configure project URL, publishable/anon key and Row Level Security for each exposed table. Add only necessary server-only keys."}
                                </p>
                                <p className="mt-1">Read the generated <code>.env.example</code>; your app may need different variables. Add secret values only in your host&apos;s encrypted environment settings. Never paste secrets here or use NEXT_PUBLIC_ for private credentials.</p>
                                {choices.host === "cloudflare" && choices.dataNeed === "mongodb" ? (
                                  <p className="mt-2 font-medium">Important: test MongoDB driver and network compatibility on Cloudflare Workers before publishing. A connection that works on Vercel might not work unchanged on Workers.</p>
                                ) : null}
                                <a className="mt-2 inline-flex items-center gap-1 underline" target="_blank" rel="noreferrer"
                                  href={choices.dataNeed === "mongodb" ? "https://cloud.mongodb.com/" : "https://supabase.com/dashboard"}>
                                  Open {choices.dataNeed === "mongodb" ? "MongoDB Atlas" : "Supabase"} <ExternalLink className="size-3" />
                                </a>
                                <label className="mt-3 flex cursor-pointer items-start gap-2">
                                  <input type="checkbox" checked={choices.databaseConfigured}
                                    onChange={e => setChoices(c => ({ ...c, databaseConfigured: e.target.checked, liveTestsConfirmed: false }))}
                                    className="mt-0.5" />
                                  <span>I added the required configuration in my hosting provider and tested real data writes (self-reported).</span>
                                </label>
                              </div>
                            )}
                          </div>
                        ) : null}

                        {step.id === "publish" ? (
                          <div className="mt-3 grid gap-2">
                            <Button size="sm" variant="outline" className="w-fit" onClick={() => launchPanel("deploy")}>
                              Open Deploy <ArrowRight className="ml-1.5 size-3.5" />
                            </Button>
                            {choices.host === "cloudflare" ? (
                              <p className="text-xs">After Prepare: open the exact generated app repository, grant Cloudflare GitHub App access, and select that repository in Workers Builds. Importing the BuildRx builder repository itself is incorrect. <a href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer" className="underline">Cloudflare dashboard</a></p>
                            ) : (
                              <p className="text-xs">Set up the generated app on Vercel and add your app&apos;s environment variables before releasing it. <a href="https://vercel.com/new" target="_blank" rel="noreferrer" className="underline">Vercel import</a></p>
                            )}
                            {latestVercel && choices.host === "vercel" ? (
                              <a className="text-xs underline" href={latestVercel.url!} target="_blank" rel="noreferrer">Open recorded deployment <ExternalLink className="inline size-3" /></a>
                            ) : null}
                          </div>
                        ) : null}

                        {step.id === "verify" && (
                          <div className="mt-3 grid gap-2">
                            {choices.host === "cloudflare" && (
                              <>
                                <Label htmlFor="launch-public-url" className="text-xs">Your published HTTPS Worker URL (never an API token)</Label>
                                <Input id="launch-public-url" type="url" placeholder="https://your-app.workers.dev"
                                  value={choices.liveUrl}
                                  onChange={e => setChoices(c => ({ ...c, liveUrl: e.target.value.slice(0, 300), liveTestsConfirmed: false }))} />
                                {choices.liveUrl && !validHttpsUrl(choices.liveUrl) && <p className="text-xs text-destructive">Enter a valid HTTPS URL.</p>}
                              </>
                            )}
                            <label className="flex cursor-pointer items-start gap-2 text-xs">
                              <input type="checkbox" className="mt-0.5" checked={choices.liveTestsConfirmed}
                                onChange={e => setChoices(c => ({ ...c, liveTestsConfirmed: e.target.checked }))} />
                              <span>I personally tested the public app on mobile, including login and actual saved-data actions where applicable. This is my confirmation, not an automated BuildRx test.</span>
                            </label>
                            {choices.host === "cloudflare" && validHttpsUrl(choices.liveUrl) ? (
                              <a target="_blank" rel="noreferrer" className="text-xs underline" href={choices.liveUrl}>Open your entered URL <ExternalLink className="inline size-3" /></a>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              <CircleHelp className="mr-1 inline size-3.5" />
              BuildRx never asks you to paste MongoDB passwords, GitHub tokens or Cloudflare tokens into this guide. A connected GitHub repo, passed CI check, or personal checkbox never equals an independently tested live app.
            </div>
            <p className="text-xs text-muted-foreground">
              Choices and checkboxes are stored only in this browser for this project. Platform statuses are fetched from your authenticated BuildRx account.
            </p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
