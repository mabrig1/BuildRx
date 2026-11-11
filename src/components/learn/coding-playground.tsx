"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FlaskConical,
  Lightbulb,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  ISOLATED_JS_RUNNER_DOCUMENT,
  MAX_PRACTICE_CODE_CHARS,
  PRACTICE_TIMEOUT_MS,
  staticPracticeChecks,
  validPracticeCode,
  visualPracticePreview,
  type PracticeCheck,
} from "@/lib/learn/browser-practice-runner";
import {
  PLAYGROUND_EXERCISES,
  getPlaygroundExercise,
  type PlaygroundExercise,
} from "@/lib/learn/playground-exercises";

type Feedback = {
  mode: "isolated-javascript" | "structural";
  checks: PracticeCheck[];
  error: string | null;
};
type CurrentRun = {
  id: string;
  exerciseId: string;
  code: string;
  functionName: string;
  tests: NonNullable<PlaygroundExercise["tests"]>;
};
const STORAGE_PREFIX = "buildrx-practice-draft-v1:";
const MAX_FEEDBACK_ITEMS = 8;

function storedDraft(exercise: PlaygroundExercise): string {
  try {
    const value = window.localStorage.getItem(STORAGE_PREFIX + exercise.id);
    return value !== null && value.length <= MAX_PRACTICE_CODE_CHARS ? value : exercise.start;
  } catch {
    return exercise.start;
  }
}

function looksLikeCredential(text: string): boolean {
  return /(?:github_pat_|ghp_[a-z\d]{12,}|mongodb(?:\+srv)?:\/\/|(?:sk-|nvapi-)[a-z\d_-]{12,}|\bBearer\s+[a-z\d_-]{12,})/i.test(text);
}

function safeFeedback(raw: unknown): PracticeCheck[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_FEEDBACK_ITEMS).flatMap(value => {
    if (!value || typeof value !== "object") return [];
    const obj = value as Record<string, unknown>;
    if (typeof obj.label !== "string" || typeof obj.pass !== "boolean") return [];
    return [{
      label: obj.label.slice(0, 100),
      pass: obj.pass,
      actual: typeof obj.actual === "string" ? obj.actual.slice(0, 160) : undefined,
    }];
  });
}

function downloadCode(exercise: PlaygroundExercise, source: string) {
  const ext = exercise.kind === "javascript" ? "js" : exercise.kind;
  const url = URL.createObjectURL(new Blob([source], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `buildrx-practice-${exercise.id}.${ext}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CodingPlayground({ initialExercise }: { initialExercise?: string }) {
  const initial = getPlaygroundExercise(initialExercise ?? "") ?? PLAYGROUND_EXERCISES[0];
  const [selectedId, setSelectedId] = useState(initial.id);
  const [source, setSource] = useState(initial.start);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [run, setRun] = useState<CurrentRun | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintIndex, setHintIndex] = useState(-1);
  const [notice, setNotice] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const runNumberRef = useRef(0);

  const exercise = getPlaygroundExercise(selectedId) ?? PLAYGROUND_EXERCISES[0];
  const isJs = exercise.kind === "javascript";
  const preview = !isJs ? visualPracticePreview(exercise, source) : null;
  const count = feedback?.checks.filter(item => item.pass).length ?? 0;
  const total = feedback?.checks.length ?? 0;

  useEffect(() => {
    const item = getPlaygroundExercise(selectedId) ?? PLAYGROUND_EXERCISES[0];
    setSource(storedDraft(item));
    setLoadedFor(item.id);
  }, [selectedId]);

  useEffect(() => {
    if (loadedFor !== selectedId) return;
    // Avoid storing likely credentials inside browser drafts.
    if (looksLikeCredential(source)) return;
    const timer = window.setTimeout(() => {
      try { window.localStorage.setItem(STORAGE_PREFIX + selectedId, source); }
      catch { /* Private browsing restrictions are nonfatal. */ }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [loadedFor, selectedId, source]);

  useEffect(() => {
    if (!run) return;
    const active = run;
    const handle = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data: unknown = event.data;
      if (!data || typeof data !== "object") return;
      const payload = data as Record<string, unknown>;
      if (payload.type !== "buildrx.practice.result" || payload.runId !== active.id) return;
      setFeedback({
        mode: "isolated-javascript",
        checks: safeFeedback(payload.cases),
        error: typeof payload.error === "string" ? payload.error.slice(0, 240) : null,
      });
      setRun(null);
    };
    window.addEventListener("message", handle);
    const timeout = window.setTimeout(() => {
      setFeedback({
        mode: "isolated-javascript",
        checks: [],
        error: "The isolated runner did not respond. It has been stopped. Try shorter code or another browser.",
      });
      setRun(null);
    }, PRACTICE_TIMEOUT_MS);

    return () => {
      window.removeEventListener("message", handle);
      window.clearTimeout(timeout);
    };
  }, [run]);

  function choose(id: string) {
    if (!getPlaygroundExercise(id)) return;
    setRun(null);
    setFeedback(null);
    setNotice("");
    setHintIndex(-1);
    setLoadedFor(null);
    setSelectedId(id);
  }

  function resetStarter() {
    setRun(null);
    setSource(exercise.start);
    setFeedback(null);
    setHintIndex(-1);
    setNotice("Restored the starter code. Your previous draft is replaced in this browser.");
  }

  function runChecks() {
    setNotice("");
    setRun(null);
    setFeedback(null);

    if (!validPracticeCode(source)) {
      setNotice(`Enter 1–${MAX_PRACTICE_CODE_CHARS.toLocaleString()} characters of code to run.`);
      return;
    }
    if (looksLikeCredential(source)) {
      setNotice("Remove API tokens, passwords and database connection strings. Never enter real credentials into training code.");
      return;
    }
    if (!isJs) {
      setFeedback({
        mode: "structural",
        checks: staticPracticeChecks(exercise, source),
        error: null,
      });
      return;
    }

    if (!exercise.functionName || !exercise.tests) {
      setNotice("This exercise does not have runnable tests.");
      return;
    }
    runNumberRef.current += 1;
    setRun({
      id: `${selectedId}:${runNumberRef.current}`,
      exerciseId: selectedId,
      code: source,
      functionName: exercise.functionName,
      tests: exercise.tests,
    });
  }

  function startIsolatedRunner() {
    if (!run || run.exerciseId !== selectedId) return;
    iframeRef.current?.contentWindow?.postMessage({
      type: "buildrx.practice.run",
      runId: run.id,
      code: run.code,
      functionName: run.functionName,
      tests: run.tests,
    }, "*"); // Opaque sandbox origin has no addressable targetOrigin.
  }

  return (
    <div className="space-y-5">
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <FlaskConical className="size-5 text-primary" />
            Interactive browser coding laboratory
            <Badge variant="outline">Practice only</Badge>
          </CardTitle>
          <CardDescription>
            Write code, run isolated JavaScript checks or inspect HTML/CSS in a script-disabled preview.
            Nothing is sent to BuildRx servers for execution. Results are formative—not graded certificates
            or proof that an application has been deployed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PLAYGROUND_EXERCISES.map(item => (
            <button key={item.id} type="button" onClick={() => choose(item.id)}
              aria-pressed={item.id === exercise.id}
              className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${item.id === exercise.id ? "border-primary bg-primary/5" : ""}`}>
              <span className="block text-sm font-semibold">{item.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {item.kind.toUpperCase()} · {item.minutes} min · {item.level}
              </span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-4" aria-label="Code editor">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{exercise.trackId.replace(/-/g, " ")}</Badge>
                <Badge variant="outline">{exercise.level}</Badge>
              </div>
              <CardTitle className="text-xl">{exercise.title}</CardTitle>
              <CardDescription>{exercise.objective}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed">{exercise.instructions}</p>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="practice-editor" className="font-semibold">
                  Edit {isJs ? "JavaScript" : exercise.kind.toUpperCase()} source
                </Label>
                <Badge variant="outline">{source.length.toLocaleString()} / {MAX_PRACTICE_CODE_CHARS.toLocaleString()}</Badge>
              </div>
              <textarea
                id="practice-editor"
                value={source}
                onChange={event => { setSource(event.target.value); setFeedback(null); setNotice(""); setRun(null); }}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                autoComplete="off"
                rows={16}
                maxLength={MAX_PRACTICE_CODE_CHARS + 1}
                className="w-full min-w-0 resize-y rounded-lg border bg-slate-950 p-3 font-mono text-base leading-6 text-slate-100 shadow-inner focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm"
                aria-describedby="practice-editor-help"
              />
              <p id="practice-editor-help" className="text-xs text-muted-foreground">
                Autosaved to this browser after edits. Avoid real credentials or private customer data.
                The isolated JS runner cannot access your signed-in BuildRx session.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={runChecks} disabled={!!run} className="gap-2">
                  {run ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                  {run ? "Running safely…" : isJs ? "Run code & tests" : "Check structure"}
                </Button>
                <Button variant="outline" onClick={resetStarter} className="gap-1.5">
                  <RotateCcw className="size-4" /> Reset starter
                </Button>
                <Button variant="outline" onClick={() => downloadCode(exercise, source)}
                  className="gap-1.5" disabled={!source.length}>
                  <Download className="size-4" /> Save file
                </Button>
              </div>
              {notice && <p role="alert" className="rounded-lg border bg-muted/60 p-3 text-sm">{notice}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="size-4" /> Need help?
              </CardTitle>
              <CardDescription>Hints reveal a direction, not a fake test result.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Button variant="outline" size="sm"
                onClick={() => setHintIndex(current => Math.min(exercise.hints.length - 1, current + 1))}>
                {hintIndex < 0 ? "Show a hint" : "Next hint"}
              </Button>
              {hintIndex >= 0 && <p className="rounded-lg bg-muted/60 p-3">{exercise.hints[hintIndex]}</p>}
              <p className="text-muted-foreground">{exercise.explanation}</p>
              <Link href={`/learn/labs?lab=${exercise.lesson}`}
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-2 hover:underline">
                Open full workshop <ArrowRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        </section>

        <section className="min-w-0 space-y-4" aria-label="Preview and practice feedback">
          {!isJs && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mobile-sized visual preview</CardTitle>
                <CardDescription>Scripts, network connections, form submissions and same-origin access are blocked.</CardDescription>
              </CardHeader>
              <CardContent>
                <iframe
                  title="Untrusted visual practice preview"
                  sandbox=""
                  referrerPolicy="no-referrer"
                  srcDoc={preview ?? ""}
                  className="h-80 w-full rounded-lg border bg-white"
                />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4" /> Practice checks
              </CardTitle>
              <CardDescription>
                {isJs
                  ? "Small predefined cases run in an opaque-origin iframe and disposable browser worker."
                  : "Introductory structural patterns only; they do not perform a full accessibility or browser audit."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!feedback && !run && <p className="text-sm text-muted-foreground">
                Run the checks after editing. You will see which cases work and which need a correction.
              </p>}
              {run && <p role="status" className="text-sm">Running the practice tests with a strict timeout…</p>}
              {feedback && (
                <div className="space-y-3" role="status" aria-live="polite">
                  <div className="rounded-lg bg-muted/60 p-3 text-sm">
                    <strong>{count} / {total} checks passing</strong>
                    {feedback.error ? <span className="mt-1 block text-destructive">{feedback.error}</span> : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {feedback.mode === "isolated-javascript" ? "Browser-executed learning tests" : "Heuristic markup checks"}—not an official qualification or proof of production readiness.
                    </p>
                  </div>
                  {feedback.checks.map((item, index) => (
                    <div key={`${item.label}:${index}`} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                      {item.pass
                        ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                        : <XCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />}
                      <span className="min-w-0">
                        <span className="block font-medium">{item.label}</span>
                        {!item.pass && item.actual && <span className="mt-1 block break-all font-mono text-xs text-muted-foreground">Actual: {item.actual}</span>}
                      </span>
                    </div>
                  ))}
                  {total > 0 && count === total && !feedback.error && (
                    <p className="text-sm font-semibold">All introductory cases pass. Try extending your code and retesting it.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">
            This practice mode does not run npm, build Next.js or Expo, deploy apps,
            access GitHub credentials, grade submissions, or issue certificates.
          </p>
        </section>
      </div>

      {run && isJs && (
        <iframe key={run.id} ref={iframeRef} sandbox="allow-scripts"
          referrerPolicy="no-referrer" srcDoc={ISOLATED_JS_RUNNER_DOCUMENT}
          onLoad={startIsolatedRunner}
          title="Opaque-origin isolated practice runner"
          aria-hidden="true" tabIndex={-1}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}
    </div>
  );
}
