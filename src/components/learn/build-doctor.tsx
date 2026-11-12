"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, ClipboardCheck, FileSearch, Info,
  RotateCcw, ShieldCheck, Wrench,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUILD_DOCTOR_MAX_CHARS, diagnoseBuildLog } from "@/lib/learn/build-doctor";

const sample = `Run npm ci ... SUCCESS
Typecheck
src/app/page.tsx(12,5): error TS2322: Type 'number' is not assignable to type 'string'.
Process completed with exit code 2.`;

export function BuildDoctor() {
  const [log, setLog] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const analysis = useMemo(() => submitted === null ? null : diagnoseBuildLog(submitted), [submitted]);

  function inspect() {
    setSubmitted(log.slice(0, BUILD_DOCTOR_MAX_CHARS));
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSearch className="size-5 text-primary" /> Explain my first build error
          </CardTitle>
          <CardDescription>
            Paste a short error excerpt from GitHub Actions, Next.js, Vercel or Cloudflare.
            This rule-based helper reads it in your browser. It does not upload your logs,
            call AI, inspect private repositories or fix production services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-300/40 p-3 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-4" /> Protect your credentials
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Before pasting, remove API keys, passwords, database connection strings,
              private customer data and personal information. Text stays in this page&apos;s
              memory; it is not deliberately saved or sent to BuildRx.
              If you accidentally disclose a live key, rotate it.
            </p>
          </div>
          <Label htmlFor="build-doctor-log">Failed job or deployment log excerpt</Label>
          <Textarea
            id="build-doctor-log"
            value={log}
            onChange={event => {
              setLog(event.target.value);
              setSubmitted(null);
            }}
            spellCheck={false}
            rows={17}
            maxLength={BUILD_DOCTOR_MAX_CHARS}
            className="min-h-56 resize-y font-mono text-xs"
            placeholder="Paste the first failed step and the first actionable error line here..."
          />
          <p className="text-xs text-muted-foreground">
            {log.length.toLocaleString()} / {BUILD_DOCTOR_MAX_CHARS.toLocaleString()} characters.
            The helper never runs commands or changes cloud settings.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={inspect} disabled={!log.trim()}>
              <Wrench className="mr-1.5 size-4" /> Explain this error
            </Button>
            <Button variant="outline" onClick={() => { setLog(sample); setSubmitted(null); }}>
              Try a safe example
            </Button>
            <Button variant="ghost" onClick={() => { setLog(""); setSubmitted(null); }}>
              <RotateCcw className="mr-1.5 size-4" /> Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="min-w-0 space-y-4" aria-label="Build Doctor findings">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardCheck className="size-5" /> Diagnostic guidance
            </CardTitle>
            <CardDescription>
              Suggestions are anchored to visible error signatures.
              A real confirmation requires the exact failing run and source files.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!analysis ? (
              <div className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">
                Enter an error excerpt or load the sample to see how the report identifies a first blocker.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={analysis.area === "Unknown" ? "outline" : "secondary"}>
                    {analysis.area}
                  </Badge>
                  <Badge variant="outline">{analysis.confidence}</Badge>
                </div>
                <h3 className="text-lg font-semibold">{analysis.title}</h3>
                <p className="text-sm leading-relaxed">{analysis.why}</p>
                {analysis.firstRelevantLine && (
                  <div className="rounded-lg border p-3">
                    <p className="mb-1 text-xs font-semibold">First matching diagnostic from your excerpt</p>
                    <pre className="whitespace-pre-wrap break-all text-xs text-muted-foreground">
                      {analysis.firstRelevantLine}
                    </pre>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Credentials recognized by this tool are redacted from displayed lines.
                      Always review original logs before sharing them.
                    </p>
                  </div>
                )}
                <div>
                  <h4 className="mb-2 font-semibold text-sm">Safest next actions</h4>
                  <ol className="ml-5 list-decimal space-y-2 text-sm leading-relaxed">
                    {analysis.nextSteps.map(step => <li key={step}>{step}</li>)}
                  </ol>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  {analysis.area === "Unknown"
                    ? <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    : <Info className="mt-0.5 size-4 shrink-0" />}
                  <span>{analysis.limitation}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">After the fix: verify the complete pathway</CardTitle>
            <CardDescription>
              A green build only proves its listed commands passed. It does not prove
              login, saved data, cross-user isolation or public hosting.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild size="sm">
              <Link href="/learn/studio">Open Project Studio <ArrowRight className="ml-1.5 size-3.5" /></Link>
            </Button>
            <Button variant="outline" asChild size="sm">
              <Link href="/guide">See the launch journey <ArrowRight className="ml-1.5 size-3.5" /></Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
