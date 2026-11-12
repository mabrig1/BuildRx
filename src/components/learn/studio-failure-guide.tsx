"use client";

import { useState } from "react";
import { AlertTriangle, BookOpen, CheckCircle2, RotateCcw, ScanSearch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  containsStudioLogSecret,
  diagnoseStudioLog,
  MAX_DIAGNOSTIC_LOG,
  type StudioFailureAdvice,
} from "@/lib/learn/studio-failure-guide";

/**
 * Never transmits log content to an AI provider, API or external service.
 * Input exists in local React state only; sensitive-looking pastes are
 * immediately cleared without storing or echoing them.
 */
export function StudioFailureGuide() {
  const [log, setLog] = useState("");
  const [advice, setAdvice] = useState<StudioFailureAdvice | null>(null);

  function setSafeLog(next: string) {
    if (containsStudioLogSecret(next)) {
      setLog("");
      setAdvice(diagnoseStudioLog(next));
      return;
    }
    setLog(next.slice(0, MAX_DIAGNOSTIC_LOG));
    setAdvice(null);
  }

  function clear() {
    setLog("");
    setAdvice(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanSearch className="size-4" />
          Understand your build error
          <Badge variant="outline">Offline guidance</Badge>
        </CardTitle>
        <CardDescription>
          Paste the first failing command and nearby error lines from your own terminal,
          GitHub Action, Vercel or Cloudflare build. The diagnostic happens in your browser.
          It does not contact a service, execute commands or change your project.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label htmlFor="studio-error-log">Sanitized error excerpt</Label>
        <textarea
          id="studio-error-log"
          className="min-h-32 w-full resize-y rounded-lg border bg-background p-3 font-mono text-sm"
          maxLength={MAX_DIAGNOSTIC_LOG}
          spellCheck={false}
          value={log}
          onChange={event => setSafeLog(event.target.value)}
          placeholder={"Example: npm error Cannot read properties of null (reading 'edgesOut')"}
          aria-describedby="studio-log-disclaimer"
          rows={5}
        />
        <p id="studio-log-disclaimer" className="text-xs text-muted-foreground">
          Do not paste real passwords, tokens, connection strings or customer information.
          Recognizable credentials are discarded immediately. Nothing is saved to browser storage
          or sent to BuildRx servers. Use the earliest meaningful error, not the whole log.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAdvice(diagnoseStudioLog(log))} disabled={!log.trim()} size="sm">
            <BookOpen className="mr-1.5 size-4" /> Explain first blocker
          </Button>
          <Button variant="outline" onClick={clear} size="sm">
            <RotateCcw className="mr-1.5 size-4" /> Clear
          </Button>
        </div>

        {advice && (
          <section className="space-y-3 rounded-lg border p-3" role="status" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              {advice.sensitive
                ? <AlertTriangle className="size-4 shrink-0 text-destructive" />
                : <CheckCircle2 className="size-4 shrink-0 text-primary" />}
              <h3 className="text-sm font-semibold">{advice.title}</h3>
              <Badge variant="outline">{advice.recognized ? "Suggested category" : "Needs review"}</Badge>
            </div>
            <p className="text-sm">{advice.likelyCause}</p>
            <h4 className="text-xs font-semibold">Safe next steps</h4>
            <ol className="ml-5 list-decimal space-y-1 text-sm">
              {advice.steps.map(step => <li key={step}>{step}</li>)}
            </ol>
            <p className="text-xs text-muted-foreground">{advice.note}</p>
            <p className="text-xs text-muted-foreground">
              This is deterministic guidance, not a verified diagnosis of your actual accounts,
              code or provider deployment.
            </p>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
