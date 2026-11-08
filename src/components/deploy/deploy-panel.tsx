"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Cloud,
  Copy,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Globe,
  Hexagon,
  Loader2,
  Rocket,
  TrainFront,
  Triangle,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn, timeAgo } from "@/lib/utils";

type Provider = "cloudflare" | "vercel" | "netlify" | "railway";

const PROVIDERS: Array<{
  id: Provider;
  name: string;
  icon: LucideIcon;
  tokenHint: string;
}> = [
  {
    id: "cloudflare",
    name: "Cloudflare",
    icon: Cloud,
    tokenHint: "Connect a GitHub repository for Workers Builds",
  },
  {
    id: "vercel",
    name: "Vercel",
    icon: Triangle,
    tokenHint: "vercel.com → Settings → Tokens",
  },
  {
    id: "netlify",
    name: "Netlify",
    icon: Hexagon,
    tokenHint: "app.netlify.com → User settings → Applications",
  },
  {
    id: "railway",
    name: "Railway",
    icon: TrainFront,
    tokenHint: "railway.com → Account → Tokens (deploys via GitHub repo)",
  },
];

interface DeploymentEntry {
  id: string;
  provider: string;
  status: string;
  url: string | null;
  logs: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  live: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  building: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  queued: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};

function HistoryItem({ deployment }: { deployment: DeploymentEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="rounded-md border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        {expanded ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        <span className="text-sm font-medium capitalize">
          {deployment.provider}
        </span>
        <Badge
          variant="outline"
          className={cn("capitalize", STATUS_STYLES[deployment.status])}
        >
          {deployment.status}
        </Badge>
        <span className="text-muted-foreground ml-auto text-xs">
          {timeAgo(deployment.createdAt)}
        </span>
      </button>
      {expanded ? (
        <div className="border-t px-2.5 py-2">
          {deployment.url ? (
            <a
              href={deployment.url}
              target="_blank"
              rel="noreferrer"
              className="text-primary flex items-center gap-1 text-xs underline-offset-4 hover:underline"
            >
              <ExternalLink className="size-3" />
              {deployment.url}
            </a>
          ) : null}
          <pre className="bg-muted/50 mt-2 max-h-40 overflow-y-auto rounded p-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
            {deployment.logs || "(no logs)"}
          </pre>
        </div>
      ) : null}
    </li>
  );
}

export function DeployPanel({
  projectId,
  open: controlledOpen,
  onOpenChange,
}: {
  projectId: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [provider, setProvider] = useState<Provider>("cloudflare");
  const [connections, setConnections] = useState<Record<Provider, boolean>>({
    cloudflare: false,
    vercel: false,
    netlify: false,
    railway: false,
  });
  const [token, setToken] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [history, setHistory] = useState<DeploymentEntry[]>([]);
  const [domain, setDomain] = useState("");
  const [cloudflareBuild, setCloudflareBuild] = useState<null | {
    state: "not_connected" | "building" | "passed" | "failed" | "unknown";
    message: string;
    checksUrl?: string | null;
    commitUrl?: string | null;
    checkCount: number;
  }>(null);
  const [checkingCloudflare, setCheckingCloudflare] = useState(false);
  const [checkingManagedHosting, setCheckingManagedHosting] = useState(false);
  const [managedHosting, setManagedHosting] = useState<null | {
    available: boolean;
    canPublish: boolean;
    blockers: string[];
  }>(null);
  const [checkingSecurity, setCheckingSecurity] = useState(false);
  const [securityPreflight, setSecurityPreflight] = useState<null | {
    status: "blocked" | "review" | "no-indicators-observed" | "incomplete";
    complete: boolean;
    checkedFiles: number;
    findings: Array<{ id: string; path: string; line: number; message: string }>;
    errors: string[];
  }>(null);
  const [cloudflareHandoff, setCloudflareHandoff] = useState<null | {
    repositoryUrl: string;
    workflowUrl: string;
    secretsUrl: string;
    dashboardUrl: string;
    workerName: string;
    branch: string;
    buildCommand: string;
    deployCommand: string;
    githubInstallationsUrl: string;
    repositoryCreated?: boolean;
    instructions: string[];
  }>(null);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  const load = useCallback(async () => {
    try {
      const [connRes, histRes] = await Promise.all([
        fetch("/api/deploy/connection"),
        fetch(`/api/deploy/history?projectId=${encodeURIComponent(projectId)}`),
      ]);
      if (connRes.ok) {
        const data = await connRes.json();
        setConnections(data.connections);
      }
      if (histRes.ok) {
        const data = await histRes.json();
        setHistory(data.deployments ?? []);
      }
    } catch {
      // keep current state
    }
  }, [projectId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [liveLog]);

  async function connect() {
    setBusy(true);
    try {
      const response = await fetch("/api/deploy/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, token }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Failed to connect");
      toast.success(`${provider} connected`);
      setToken("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect");
    } finally {
      setBusy(false);
    }
  }

  async function deploy(target: Provider = provider) {
    setProvider(target);
    setDeploying(true);
    setLiveLog([]);
    try {
      if (target === "cloudflare") {
        // This action pushes real app source and a manual deployment workflow
        // to the linked GitHub repository. It is not a production deployment.
        setCloudflareHandoff(null);
        setCloudflareBuild(null);
        const prepared = await fetch("/api/deploy/cloudflare/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        });
        const data = await prepared.json().catch(() => null);
        if (!prepared.ok || !data?.prepared) {
          throw new Error(data?.error ?? "Unable to prepare Cloudflare Workers source");
        }
        setCloudflareHandoff(data);
        setLiveLog(data.instructions ?? []);
        void checkCloudflareBuild();
        toast.info("Cloudflare files prepared in GitHub", {
          description: "Deploy in Cloudflare Workers Builds or run the manual GitHub workflow.",
        });
        return;
      }
      const response = await fetch("/api/deploy/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, provider: target }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Deployment failed to start");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "log") {
              setLiveLog((prev) => [...prev, event.line]);
            } else if (event.type === "complete") {
              if (event.status === "live") {
                toast.success("Your app is live!");
              } else if (event.status === "failed") {
                toast.error("Deployment failed — see the logs");
              } else {
                toast.info("Deployment queued");
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      }
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to launch your app"
      );
    } finally {
      setDeploying(false);
    }
  }

  async function checkCloudflareBuild() {
    setCheckingCloudflare(true);
    try {
      const response = await fetch(`/api/deploy/cloudflare/status?projectId=${encodeURIComponent(projectId)}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Unable to check Cloudflare");
      setCloudflareBuild(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to check build status");
    } finally {
      setCheckingCloudflare(false);
    }
  }

  async function checkSecurity() {
    setCheckingSecurity(true);
    setSecurityPreflight(null);
    try {
      const response = await fetch(
        `/api/projects/security-preflight?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Security scan unavailable");
      setSecurityPreflight(data.securityPreflight);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Security check could not complete");
    } finally {
      setCheckingSecurity(false);
    }
  }

  async function checkManagedHosting() {
    setCheckingManagedHosting(true);
    setManagedHosting(null);
    try {
      const response = await fetch(
        `/api/deploy/managed/preflight?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" }
      );
      if (response.status === 404) {
        setManagedHosting({ available: false, canPublish: false, blockers: [] });
        return;
      }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Managed hosting check failed");
      // The current server contract never claims managed publishing is ready.
      setManagedHosting({
        available: true,
        canPublish: data.canPublish === true,
        blockers: Array.isArray(data.blockers)
          ? data.blockers.filter((item: unknown): item is string => typeof item === "string")
          : [],
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Managed hosting check unavailable");
    } finally {
      setCheckingManagedHosting(false);
    }
  }

  async function launchApp() {
    // A connected Vercel account can publish the full Next.js app directly.
    // Cloudflare is an honest setup handoff until the owner finishes GitHub
    // authorization and the first Workers Builds configuration.
    if (connections.vercel) {
      await deploy("vercel");
    } else {
      await deploy("cloudflare");
    }
  }

  async function saveDomain() {
    setBusy(true);
    try {
      const response = await fetch("/api/deploy/domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, provider, domain }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Failed to set domain");
      toast.success(data.instructions ?? `Domain ${domain} saved`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to set domain"
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyCloudflareSetup() {
    if (!cloudflareHandoff) return;
    const settings = [
      `Worker name: ${cloudflareHandoff.workerName}`,
      `GitHub repository: ${cloudflareHandoff.repositoryUrl}`,
      `Production branch: ${cloudflareHandoff.branch}`,
      `Build command: ${cloudflareHandoff.buildCommand}`,
      `Deploy command: ${cloudflareHandoff.deployCommand}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(settings);
      toast.success("Cloudflare Workers setup copied");
    } catch {
      toast.error("Copy unavailable — select the settings shown below");
    }
  }

  const connected = provider === "cloudflare" || connections[provider];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Rocket className="size-4" />
          <span>Launch</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Rocket className="size-4" />
            Launch your app
          </SheetTitle>
          <SheetDescription>
            No commands or hosting expertise needed to start. Technical options are available only when you want them.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-4">
            {/* Nontechnical first: show one launch action, not a provider catalogue. */}
            <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div>
                <p className="text-base font-semibold">Ready to share your app?</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {connections.vercel
                    ? "Publish the verified app and receive a link to share with anyone."
                    : "We will prepare your app and guide you through a one-time hosting connection. Your app is not public until the host confirms it is live."}
                </p>
              </div>
              <Button type="button" className="w-full gap-2" disabled={deploying} onClick={() => void launchApp()}>
                {deploying ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                {deploying ? "Working on your launch…" : connections.vercel ? "Publish my app" : "Start my launch"}
              </Button>
              {history.find((entry) => entry.status === "live" && entry.url?.startsWith("https://")) && (
                <a
                  className="flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"
                  href={history.find((entry) => entry.status === "live" && entry.url?.startsWith("https://"))!.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe className="size-4" /> Open my published app <ExternalLink className="size-3.5" />
                </a>
              )}
              <div className="rounded-lg border p-3 text-xs space-y-2" aria-live="polite">
                <div className="font-medium">DevShield AI — scan before launch</div>
                <p className="text-muted-foreground">Checks suspicious code without executing it. Every real launch is checked again automatically.</p>
                <Button type="button" size="sm" variant="outline" disabled={checkingSecurity || deploying}
                  onClick={() => void checkSecurity()}>
                  {checkingSecurity ? "Checking source…" : "Check my app security"}
                </Button>
                {securityPreflight && (
                  <div className="space-y-1">
                    <p className="font-medium">
                      {securityPreflight.status === "no-indicators-observed"
                        ? `No matching indicators in ${securityPreflight.checkedFiles} inspected files.`
                        : securityPreflight.status === "incomplete"
                          ? "Security scan incomplete — launch will be blocked."
                          : "Suspicious code detected — launch will be blocked."}
                    </p>
                    {securityPreflight.findings.slice(0, 5).map((finding, index) => (
                      <p key={`${finding.id}-${index}`} className="text-destructive">
                        {finding.id} in {finding.path}:{finding.line}. {finding.message}
                      </p>
                    ))}
                    {securityPreflight.errors.map((error, index) => (
                      <p key={index} className="text-destructive">{error}</p>
                    ))}
                    <p className="text-muted-foreground">A passing static scan cannot guarantee code is safe or ready to publish.</p>
                  </div>
                )}
              </div>
              <div className="rounded-lg border p-3 text-xs space-y-2">
                <p className="font-medium">Automatic Cloudflare hosting readiness</p>
                <p className="text-muted-foreground">
                  Managed one-click publishing is being built. The existing launch button
                  prepares an app for manual Cloudflare setup until managed hosting is verified.
                </p>
                <Button type="button" variant="outline" size="sm"
                  disabled={checkingManagedHosting || deploying}
                  onClick={() => void checkManagedHosting()}>
                  {checkingManagedHosting ? "Checking readiness…" : "Check automatic hosting"}
                </Button>
                {managedHosting && (
                  <div role="status" className="space-y-1">
                    <p>
                      {managedHosting.available
                        ? managedHosting.canPublish
                          ? "Publishing prerequisites appear available; verify before using managed hosting."
                          : "Managed one-click publishing is not available yet."
                        : "Managed hosting is not activated by the operator."}
                    </p>
                    {managedHosting.blockers.length > 0 && (
                      <p className="text-muted-foreground">
                        Outstanding safeguards: {managedHosting.blockers.length}.
                        Existing guided Cloudflare setup remains available.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button type="button" disabled={checkingCloudflare} className="text-xs font-medium text-primary underline underline-offset-4 disabled:opacity-50" onClick={() => void checkCloudflareBuild()}>
                {checkingCloudflare ? "Checking Cloudflare…" : "Check my Cloudflare launch"}
              </button>
              {cloudflareBuild && (
                <div role="status" className="space-y-1 text-xs leading-5">
                  <p>{cloudflareBuild.message}</p>
                  {cloudflareBuild.checksUrl && (
                    <a className="text-primary underline underline-offset-4" href={cloudflareBuild.checksUrl} target="_blank" rel="noopener noreferrer">Open build details ↗</a>
                  )}
                </div>
              )}
              <button type="button" className="text-xs text-muted-foreground underline underline-offset-4" onClick={() => setShowAdvanced((value) => !value)}>
                {showAdvanced ? "Hide advanced hosting options" : "Advanced hosting options (optional)"}
              </button>
            </section>

            {showAdvanced && (
              <>
            {/* Provider picker */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setProvider(p.id); setCloudflareHandoff(null); }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors",
                    provider === p.id
                      ? "border-primary bg-primary/5 font-medium"
                      : "text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  <p.icon className="size-5" />
                  {p.name}
                  {p.id === "cloudflare" ? (
                    <span className="text-muted-foreground text-[10px]">GitHub handoff</span>
                  ) : connections[p.id] ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3" />
                      connected
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[10px]">
                      not connected
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Connect */}
            {provider === "cloudflare" && (
              <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 text-xs leading-5">
                <strong className="block text-sm">Cloudflare Workers — guided deployment</strong>
                <p className="mt-1 text-muted-foreground">Connect your GitHub account in the GitHub panel first. Preparing will use the linked repository or automatically create a private repository, then commit the application and its Cloudflare configuration. If you already enabled automatic Cloudflare Builds for the repository, this push may trigger a build.</p>
                <p className="mt-2">Already clicked <strong>Install</strong> in Cloudflare? That authorizes Cloudflare to see GitHub repositories; it does not sign you into GitHub inside BuildRx. After preparing, select the exact generated app repository in Cloudflare Workers Builds.</p>
                <p className="mt-2 font-medium">This step prepares deployment; it does not claim a live site or create a custom domain.</p>
              </div>
            )}
            {!connected ? (
              <div className="grid gap-2 rounded-lg border p-3">
                <Label htmlFor="deploy-token" className="text-sm">
                  {PROVIDERS.find((p) => p.id === provider)?.name} API token
                </Label>
                <Input
                  id="deploy-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your token"
                />
                <p className="text-muted-foreground text-xs">
                  {PROVIDERS.find((p) => p.id === provider)?.tokenHint}
                </p>
                <Button
                  size="sm"
                  onClick={() => void connect()}
                  disabled={busy || token.length < 8}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Check />}
                  Connect
                </Button>
              </div>
            ) : null}

            {/* Deploy */}
            <Button
              onClick={() => void deploy()}
              disabled={deploying}
              className="w-full"
            >
              {deploying ? (
                <>
                  <Loader2 className="animate-spin" />
                  {provider === "cloudflare" ? "Preparing source…" : "Deploying…"}
                </>
              ) : (
                <>
                  <Rocket />
                  {provider === "cloudflare" ? "Prepare for Cloudflare Workers" : `Deploy to ${PROVIDERS.find((p) => p.id === provider)?.name}`}
                </>
              )}
            </Button>

            </>
            )}

            {provider === "cloudflare" && cloudflareHandoff && (
              <section aria-live="polite" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3 text-sm">
                <p className="font-semibold">Your app is ready for its first launch</p>
                <p className="text-muted-foreground">BuildRx has saved your application and prepared it for hosting. Your app is <strong>not yet public</strong> until Cloudflare finishes its build.</p>
                <div className="space-y-2">
                  <p className="font-medium">One-time setup:</p>
                  <p>1. Open Cloudflare using the button below.</p>
                  <p>2. Choose GitHub and select the app repository BuildRx created.</p>
                  <p>3. Confirm the settings and choose Save and Deploy.</p>
                </div>
                <a href={cloudflareHandoff.dashboardUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                  Finish on Cloudflare <ExternalLink className="size-4" />
                </a>
                <p className="text-xs text-muted-foreground">Your saved app: <a href={cloudflareHandoff.repositoryUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">Open its GitHub repository ↗</a></p>
                <details className="rounded-md border p-3">
                  <summary className="cursor-pointer text-xs font-medium">Technical settings (only if Cloudflare asks)</summary>
                  <div className="mt-3 space-y-1.5 font-mono text-xs break-all">
                    <p>Worker: {cloudflareHandoff.workerName}</p>
                    <p>Branch: {cloudflareHandoff.branch}</p>
                    <p>Build: {cloudflareHandoff.buildCommand}</p>
                    <p>Deploy: {cloudflareHandoff.deployCommand}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="mt-3 w-full gap-2" onClick={() => void copyCloudflareSetup()}>
                    <Copy className="size-3.5" /> Copy settings
                  </Button>
                  <div className="mt-3 grid gap-2 text-xs">
                    <a className="text-primary underline" href={cloudflareHandoff.githubInstallationsUrl} target="_blank" rel="noopener noreferrer">Allow Cloudflare access to this repository ↗</a>
                    <a className="text-primary underline" href={cloudflareHandoff.workflowUrl} target="_blank" rel="noopener noreferrer">Optional GitHub deployment workflow ↗</a>
                    <a className="text-primary underline" href={cloudflareHandoff.secretsUrl} target="_blank" rel="noopener noreferrer">Optional GitHub deployment secrets ↗</a>
                  </div>
                </details>
                <div className="rounded-md border bg-background/70 p-3 space-y-2">
                  <Button type="button" variant="outline" size="sm" disabled={checkingCloudflare} className="w-full gap-2" onClick={() => void checkCloudflareBuild()}>
                    {checkingCloudflare && <Loader2 className="size-4 animate-spin" />}
                    Check my launch progress
                  </Button>
                  {cloudflareBuild && (
                    <div role="status" className="space-y-2 text-xs leading-5">
                      <Badge variant={cloudflareBuild.state === "passed" ? "default" : "outline"}>
                        {cloudflareBuild.state === "passed" ? "Build checks passed" :
                         cloudflareBuild.state === "building" ? "Building" :
                         cloudflareBuild.state === "failed" ? "Build error" : "Setup not verified"}
                      </Badge>
                      <p>{cloudflareBuild.message}</p>
                      {cloudflareBuild.checksUrl && (
                        <a href={cloudflareBuild.checksUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">View Cloudflare build details ↗</a>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">A passing build check is not yet proof your app works. Open the link provided by Cloudflare and test your app before sharing it or adding a custom domain.</p>
              </section>
            )}

            {/* Live log */}
            {liveLog.length > 0 ? (
              <pre
                ref={logRef}
                className="max-h-44 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-300"
              >
                {liveLog.join("\n")}
              </pre>
            ) : null}

            <Separator />

            {/* Custom domain */}
            {provider !== "cloudflare" ? <div className="grid gap-2">
              <Label htmlFor="custom-domain" className="flex items-center gap-1.5">
                <Globe className="size-4" />
                Custom domain
              </Label>
              <div className="flex gap-2">
                <Input
                  id="custom-domain"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="app.example.com"
                />
                <Button
                  variant="outline"
                  onClick={() => void saveDomain()}
                  disabled={busy || !domain.includes(".")}
                >
                  Save
                </Button>
              </div>
            </div> : <p className="text-xs text-muted-foreground">Set your custom domain in Cloudflare after the Worker is successfully deployed. No DNS changes are performed here.</p>}

            <Separator />

            {/* History */}
            <div className="grid gap-2">
              <p className="text-sm font-medium">Deployment history</p>
              {history.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No deployments yet.
                </p>
              ) : (
                <ul className="grid gap-1.5">
                  {history.map((deployment) => (
                    <HistoryItem key={deployment.id} deployment={deployment} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
