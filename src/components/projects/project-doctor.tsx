"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, FileSearch,
  Loader2, RefreshCw, ShieldAlert, Stethoscope, Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { ProjectDoctorReport } from "@/lib/projects/app-doctor";

interface DoctorResponse {
  doctor?: ProjectDoctorReport;
  generatedAt?: string;
  error?: string;
  autoRepairPerformed?: boolean;
  deployed?: boolean;
}

/**
 * Opens a real owner-scoped source inspection, rather than asking users to
 * paste their files or assuming a green project status means it is working.
 * Only a separate deliberate action opens the existing AI repair agent.
 */
export function ProjectDoctor({
  projectId,
  filesRefreshKey,
  onRepair,
  onNext,
  onPreview,
}: {
  projectId: string;
  filesRefreshKey: number;
  onRepair: () => void;
  onNext: () => void;
  onPreview: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ProjectDoctorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/doctor", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = await response.json().catch(() => null) as DoctorResponse | null;
      if (!response.ok || !data?.doctor) {
        throw new Error(data?.error ?? "Could not inspect this saved project");
      }
      setReport(data.doctor);
      setLastChecked(data.generatedAt ?? null);
    } catch (reason) {
      setReport(null);
      setError(reason instanceof Error ? reason.message : "Inspection unavailable");
    } finally {
      setBusy(false);
    }
  }, [projectId]);

  // Scan only when explicitly opened or after a build changes saved files.
  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh, filesRefreshKey]);

  function requestRepair() {
    setOpen(false);
    onRepair();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" aria-label="Diagnose saved app">
          <Stethoscope className="size-4" /> <span className="hidden sm:inline">App Doctor</span><span className="sm:hidden">Fix</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base"><Stethoscope className="size-4" /> App Doctor</SheetTitle>
          <SheetDescription>Inspect saved source, identify the first likely blocker, and choose a safe next step. No changes happen during this scan.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs">{lastChecked
                ? "Last inspected: " + new Date(lastChecked).toLocaleTimeString()
                : "Project source preflight"}</p>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void refresh()}>
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Recheck
              </Button>
            </div>

            {busy && !report ? <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" /> Inspecting saved files…</p> : null}
            {error ? <div role="alert" className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
              <p className="font-semibold text-sm">Could not complete diagnosis</p>
              <p className="text-sm">{error}</p>
              <p className="text-muted-foreground text-xs">No repair or deployment was attempted.</p>
            </div> : null}

            {report ? <>
              <div role="status" className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Your recommended next move</h3>
                  <Badge variant="outline">{report.blockers} blockers · {report.warnings} warnings</Badge>
                </div>
                <p className="text-sm font-medium">{report.nextTitle}</p>
                <p className="text-muted-foreground text-sm">{report.nextExplanation}</p>
                {report.nextAction === "build" ? (
                  <Button size="sm" onClick={requestRepair}><Wrench className="size-4" /> Open Build app</Button>
                ) : report.nextAction === "repair" ? (
                  <Button size="sm" onClick={requestRepair}><Wrench className="size-4" /> Review AI repair</Button>
                ) : report.nextAction === "security" ? (
                  <Button variant="outline" size="sm" asChild><Link href="/learn/doctor"><ShieldAlert className="size-4" /> Security & log guidance</Link></Button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => { setOpen(false); onPreview(); }}>
                      <FileSearch className="size-4" /> Open Preview
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setOpen(false); onNext(); }}>
                      What next? <ArrowRight className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">What BuildRx checked</p>
                {report.checks.map(item => <div className="flex items-start gap-2 rounded-lg border p-3" key={item.label}>
                  {item.result === "pass" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    : item.result === "fail" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-600" />
                    : <ClipboardCheck className="mt-0.5 size-4 shrink-0 text-amber-600" />}
                  <div><p className="text-sm font-medium">{item.label}</p><p className="text-muted-foreground text-xs">{item.detail}</p></div>
                </div>)}
              </div>

              {report.findings.length ? <div className="space-y-2">
                <p className="text-sm font-semibold">First findings</p>
                {report.findings.map((finding, index) => <div className="rounded-lg border p-3" key={index}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{finding.title}</p>
                    <Badge variant={finding.severity === "blocker" ? "destructive" : "outline"}>{finding.severity}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">{finding.explanation}</p>
                  {finding.location ? <code className="mt-2 block break-all text-xs">{finding.location}</code> : null}
                </div>)}
              </div> : <p className="text-sm text-muted-foreground">No supported blocking source signature found. This is not a runtime or deployment certificate.</p>}
              <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs leading-relaxed">{report.limitations}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => { setOpen(false); onNext(); }}>
                  Open guided launch <ArrowRight className="size-3.5" />
                </Button>
                <Button size="sm" variant="outline" asChild><Link href="/support">Ask for support</Link></Button>
              </div>
            </> : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
