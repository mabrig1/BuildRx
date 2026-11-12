"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, SearchCheck, ShieldAlert, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  inspectPublicGithubEvidence, EVIDENCE_CHECK_TIMEOUT_MS,
  type GithubEvidenceSnapshot, type PublicEvidenceInput,
} from "@/lib/learn/public-github-evidence";
import {
  parseGithubRepository, validFullCommitSha, validGithubCiRun,
} from "@/lib/learn/capstone-evidence";

/** Unmounted/recreated whenever the submitted repo/SHA/run changes. */
export function PublicGithubEvidenceCheck({ input, blocked }: {
  input: PublicEvidenceInput;
  blocked: boolean;
}) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<GithubEvidenceSnapshot | null>(null);
  const [problem, setProblem] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => { controllerRef.current?.abort(); }, []);

  const validInput = Boolean(
    parseGithubRepository(input.repoUrl) &&
    validFullCommitSha(input.commitSha) &&
    (!input.ciRunUrl || validGithubCiRun(input.ciRunUrl, input.repoUrl)),
  );

  async function runCheck() {
    if (!consent || !validInput || blocked || busy) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setProblem("");
    setSnapshot(null);
    const timeout = window.setTimeout(() => controller.abort(), EVIDENCE_CHECK_TIMEOUT_MS);
    try {
      const outcome = await inspectPublicGithubEvidence(input, fetch, controller.signal);
      if (!controller.signal.aborted) {
        if (outcome.ok) setSnapshot(outcome.snapshot);
        else setProblem(outcome.reason);
      } else {
        setProblem("GitHub metadata check was stopped or timed out. No result is confirmed.");
      }
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setBusy(false);
      }
    }
  }

  const statuses = snapshot ? [
    {
      label: "Public repository",
      found: snapshot.repositoryPublic === "found",
      detail: snapshot.repositoryPublic === "found" ? "Accessible from GitHub" : "Unavailable or not confirmed",
    },
    {
      label: "Exact commit object",
      found: snapshot.commit === "found",
      detail: snapshot.commit === "found" ? "Full SHA matches GitHub metadata" : "Unavailable or not checked",
    },
    {
      label: "Actions run",
      found: snapshot.ciRun === "matching",
      detail: snapshot.ciRun === "not-supplied" ? "No Actions run provided" :
        snapshot.ciRun === "matching" ? "Repository and commit SHA match" :
          snapshot.ciRun === "mismatched" ? "Mismatch — do not rely on this run" : "Unavailable",
    },
  ] : [];

  return (
    <Card className="border-primary/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SearchCheck className="size-5 text-primary" /> Check public GitHub evidence
          <Badge variant="outline">Opt-in</Badge>
        </CardTitle>
        <CardDescription>
          Ask GitHub directly whether a public repository contains the claimed commit and
          whether an Actions run matches it. This is a read-only metadata check, not a
          project grade, security audit, identity verification or production test.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
          <p className="font-semibold">Privacy and connection notice</p>
          <p className="mt-1">
            When you click Check GitHub, your browser contacts api.github.com directly using
            the public repository name, exact commit SHA and optional numeric Actions run ID.
            GitHub can see your network address and those request details. No token, source
            files, project reflection or evidence notes are transferred by this check.
            GitHub limits anonymous API requests; network/privacy blockers can prevent results.
          </p>
        </div>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} className="mt-1"
            onChange={event => {
              setConsent(event.target.checked);
              if (!event.target.checked) {
                controllerRef.current?.abort();
                setSnapshot(null);
                setProblem("");
              }
            }} />
          <span>I agree to check this public GitHub reference directly with GitHub.
            I understand private repositories are not supported.
          </span>
        </label>
        <Button onClick={() => void runCheck()} disabled={!consent || !validInput || blocked || busy}
          size="sm" className="gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ClipboardCheck className="size-4" />}
          {busy ? "Checking public metadata…" : snapshot ? "Check current GitHub metadata again" : "Check GitHub evidence"}
        </Button>
        {blocked && (
          <p className="text-xs text-destructive" role="alert">
            Remove recognizable secrets from the local portfolio before requesting external metadata.
          </p>
        )}
        {!validInput && !blocked && (
          <p className="text-xs text-muted-foreground">
            Provide a valid canonical GitHub repository URL and complete 40-character SHA.
            If you include an Actions run, it must be in the same repository.
          </p>
        )}
        {problem && <p role="alert" className="rounded-md border p-3 text-sm">{problem}</p>}
        {snapshot && (
          <div className="space-y-3" role="status" aria-live="polite">
            <p className="text-xs text-muted-foreground">
              Checked {new Date(snapshot.checkedAt).toLocaleString()} · Source: {snapshot.source}
            </p>
            {statuses.map(item => (
              <div key={item.label} className="flex items-start gap-2 rounded-lg border p-2 text-sm">
                {item.found
                  ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  : <XCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            ))}
            {snapshot.ciRun === "matching" && (
              <p className="rounded-lg border p-3 text-xs">
                <strong>GitHub Actions:</strong> {snapshot.runStatus ?? "unknown"} ·
                Conclusion: {snapshot.runConclusion ?? "not yet available"}.
                {snapshot.runConclusion !== "success" && " Do not treat this check as passing CI."}
              </p>
            )}
            <div className="space-y-1.5">
              {snapshot.details.map((detail, i) => (
                <p key={i} className="text-xs text-muted-foreground">{detail}</p>
              ))}
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <p>
                GitHub metadata can confirm a public commit and report a matching workflow,
                but it does <strong>not</strong> establish learner identity, test coverage,
                real application behavior, secure code or deployment. A qualified human reviewer
                must still inspect and reproduce the submitted evidence.
                The snapshot is not stored or used to award certificates.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
