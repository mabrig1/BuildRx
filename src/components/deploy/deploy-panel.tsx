"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
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

type Provider = "vercel" | "netlify" | "railway";

const PROVIDERS: Array<{
  id: Provider;
  name: string;
  icon: LucideIcon;
  tokenHint: string;
}> = [
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

export function DeployPanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<Provider>("vercel");
  const [connections, setConnections] = useState<Record<Provider, boolean>>({
    vercel: false,
    netlify: false,
    railway: false,
  });
  const [token, setToken] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [liveLog, setLiveLog] = useState<string[]>([]);
  const [history, setHistory] = useState<DeploymentEntry[]>([]);
  const [domain, setDomain] = useState("");
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

  async function deploy() {
    setDeploying(true);
    setLiveLog([]);
    try {
      const response = await fetch("/api/deploy/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, provider }),
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
                toast.success(`Deployed to ${provider}`);
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
        error instanceof Error ? error.message : "Deployment failed"
      );
    } finally {
      setDeploying(false);
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

  const connected = connections[provider];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Rocket className="size-4" />
          <span className="hidden sm:inline">Deploy</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Rocket className="size-4" />
            One-click deployment
          </SheetTitle>
          <SheetDescription>
            Ship your generated app to Vercel, Netlify, or Railway.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-4">
            {/* Provider picker */}
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm transition-colors",
                    provider === p.id
                      ? "border-primary bg-primary/5 font-medium"
                      : "text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  <p.icon className="size-5" />
                  {p.name}
                  {connections[p.id] ? (
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
                  Deploying…
                </>
              ) : (
                <>
                  <Rocket />
                  Deploy to {PROVIDERS.find((p) => p.id === provider)?.name}
                </>
              )}
            </Button>

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
            <div className="grid gap-2">
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
            </div>

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
