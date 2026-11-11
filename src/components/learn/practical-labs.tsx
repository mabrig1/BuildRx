"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight, CheckCircle2, ClipboardCheck, Code2, Copy,
  Download, ExternalLink, FlaskConical, FolderOpen, Loader2,
  Sparkles, TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getTrainingLab, labsForTrack, TRAINING_LABS, TRAINING_TRACKS,
  type TrainingLab, type TrainingTrackId,
} from "@/lib/learn/labs";
import { starterKitForTrack } from "@/lib/learn/starter-kits";

type LabEntry = { tasks: boolean[]; checks: boolean[] };
type Progress = Record<string, LabEntry>;
const STORAGE_KEY = "buildrx-practical-labs-v1";
const allLabIds = new Set<string>(TRAINING_LABS.map(lab => lab.id));

function safeProgress(raw: unknown): Progress {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const data = raw as Record<string, unknown>;
  const result: Progress = {};
  for (const lab of TRAINING_LABS) {
    const value = data[lab.id];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const entry = value as Record<string, unknown>;
    result[lab.id] = {
      tasks: lab.tasks.map((_, i) => Array.isArray(entry.tasks) && entry.tasks[i] === true),
      checks: lab.acceptance.map((_, i) => Array.isArray(entry.checks) && entry.checks[i] === true),
    };
  }
  return result;
}
function progressFor(lab: TrainingLab, progress: Progress): LabEntry {
  return progress[lab.id] ?? {
    tasks: lab.tasks.map(() => false),
    checks: lab.acceptance.map(() => false),
  };
}
function selfReportedDone(lab: TrainingLab, progress: Progress): boolean {
  const state = progressFor(lab, progress);
  return state.tasks.length === lab.tasks.length &&
    state.checks.length === lab.acceptance.length &&
    state.tasks.every(Boolean) && state.checks.every(Boolean);
}
function readProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? safeProgress(JSON.parse(raw)) : {};
  } catch { return {}; }
}

export function PracticalLabs({
  initialTrack,
  initialLabId,
}: {
  initialTrack?: TrainingTrackId;
  initialLabId?: string;
}) {
  const firstLab = getTrainingLab(initialLabId ?? "");
  const [trackId, setTrackId] = useState<TrainingTrackId>(
    firstLab?.trackId ?? initialTrack ?? TRAINING_TRACKS[0].id,
  );
  const [selectedId, setSelectedId] = useState(
    firstLab?.id ?? labsForTrack(initialTrack ?? TRAINING_TRACKS[0].id)[0].id,
  );
  const [progress, setProgress] = useState<Progress>({});
  const [hydrated, setHydrated] = useState(false);
  const [level, setLevel] = useState<"first-time" | "learning" | "building">("first-time");
  const [mode, setMode] = useState<"lesson" | "five-day-plan">("lesson");
  const [goal, setGoal] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  useEffect(() => {
    setProgress(readProgress());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Local progress is optional; never affects billing or certification.
    }
  }, [progress, hydrated]);

  const track = TRAINING_TRACKS.find(t => t.id === trackId) ?? TRAINING_TRACKS[0];
  const starter = starterKitForTrack(track.id);
  const lab = getTrainingLab(selectedId) ?? labsForTrack(trackId)[0];
  const labs = useMemo(() => labsForTrack(trackId), [trackId]);
  const state = progressFor(lab, progress);
  const completed = labs.filter(item => selfReportedDone(item, progress)).length;
  const totalReported = TRAINING_LABS.filter(item => selfReportedDone(item, progress)).length;
  const currentIndex = labs.findIndex(item => item.id === lab.id);

  function selectTrack(id: TrainingTrackId) {
    const chosen = labsForTrack(id)[0];
    setTrackId(id);
    setSelectedId(chosen.id);
    setGenerated(null);
    setError(null);
  }
  function selectLab(id: string) {
    if (!allLabIds.has(id)) return;
    setSelectedId(id);
    setGenerated(null);
    setError(null);
  }
  function toggle(kind: "tasks" | "checks", index: number, checked: boolean) {
    const maxLength = kind === "tasks" ? lab.tasks.length : lab.acceptance.length;
    if (index < 0 || index >= maxLength) return;
    setProgress(prev => {
      const current = progressFor(lab, prev);
      const updated = { ...current, [kind]: current[kind].map((v, i) => i === index ? checked : v) };
      return { ...prev, [lab.id]: updated };
    });
  }
  async function copyStarter(content: string, filePath: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedPath(filePath);
    } catch {
      setCopiedPath(null);
      setError("Copy was blocked by the browser. Select and copy the visible code manually.");
    }
  }

  async function generateLabMentor() {
    setGenerating(true);
    setError(null);
    setGenerated(null);
    try {
      const res = await fetch("/api/learn/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId: lab.id, level, mode, goal: goal.trim() }),
      });
      const value = await res.json().catch(() => ({}));
      if (!res.ok || value.generated !== true || value.labId !== lab.id ||
          typeof value.text !== "string" || !value.text.trim()) {
        throw new Error(typeof value.error === "string" ? value.error : "No training was generated.");
      }
      setGenerated(value.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Training request failed.");
    } finally {
      setGenerating(false);
    }
  }
  function downloadLabPlan() {
    const note = [
      `# ${track.title} — ${lab.title}`, "",
      "Self-study exercise; this file is not automated assessment or a certificate.", "",
      `Objective: ${lab.objective}`, "",
      "## Tasks",
      ...lab.tasks.map((task, index) => `${index + 1}. ${task}`),
      "", "## Expected deliverables", ...lab.deliverables.map(d => `- ${d}`),
      "", "## Acceptance checks", ...lab.acceptance.map(d => `- [ ] ${d}`),
      "", "## Safety note", lab.caution,
      ...(starter ? [
        "", "## Starter source files — inspect before use",
        ...starter.files.flatMap(file => [
          "", `### ${file.path}`, "",
          `\`\`\`${file.lang}`, file.content, "\`\`\`",
        ]),
      ] : []),
      ...(generated ? ["", "## AI-generated coaching — verify independently", generated] : []),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([note], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `buildrx-lab-${lab.id}.md`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const done = selfReportedDone(lab, progress);
  return (
    <div className="space-y-5">
      <Card className="border-primary/25">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <FlaskConical className="size-5 text-primary" />
            <CardTitle className="text-xl">Choose your engineering path</CardTitle>
            <Badge variant="secondary">{TRAINING_LABS.length} hands-on labs</Badge>
          </div>
          <CardDescription>
            Learn through practical tasks and acceptance checks. Lab completion is self-reported in this browser;
            BuildRx does not run your local code or issue certificates from these checkboxes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="Training tracks">
            {TRAINING_TRACKS.map(item => (
              <button type="button" key={item.id}
                aria-pressed={trackId === item.id}
                onClick={() => selectTrack(item.id)}
                className={`rounded-lg border p-3 text-left transition hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${trackId === item.id ? "border-primary bg-primary/5" : ""}`}>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.subtitle}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.stack.slice(0, 4).map(tool => <Badge key={tool} variant="outline" className="text-[10px]">{tool}</Badge>)}
                </div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {totalReported} / {TRAINING_LABS.length} laboratories self-reported complete across all tracks.
            This is a local learning record, not independent grading.
          </p>
        </CardContent>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,310px)_minmax(0,1fr)]">
        <aside className="space-y-3" aria-label="Track laboratories">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{track.title}</CardTitle>
              <CardDescription>{track.audience}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p>{track.outcome}</p>
              <div role="status" className="rounded-lg bg-muted/50 p-2">
                <strong>{completed} of {labs.length}</strong> labs self-reported complete
              </div>
              <p><strong>Capstone:</strong> {track.capstone}</p>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {labs.map(item => (
              <button type="button" key={item.id}
                aria-current={selectedId === item.id ? "true" : undefined}
                onClick={() => selectLab(item.id)}
                className={`flex w-full items-start gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selectedId === item.id ? "border-primary bg-primary/5" : ""}`}>
                {selfReportedDone(item, progress)
                  ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  : <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{item.sequence}</span>}
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.durationMinutes} min · Lab {item.sequence}</span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 space-y-5" aria-label="Hands-on exercise">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Lab {lab.sequence}</Badge>
                <Badge variant="outline">{lab.durationMinutes} minutes</Badge>
                {done && <Badge variant="secondary">Self-reported complete</Badge>}
              </div>
              <CardTitle className="text-xl">{lab.title}</CardTitle>
              <CardDescription>{lab.objective}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border p-3 text-sm">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <p><strong>Lab safety:</strong> {lab.caution}</p>
                </div>
              </div>

              <section className="space-y-3">
                <h3 className="font-semibold text-sm">Perform these steps</h3>
                <ol className="space-y-2">
                  {lab.tasks.map((task, index) => (
                    <li key={index}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
                        <input type="checkbox" className="mt-1" checked={state.tasks[index] === true}
                          onChange={e => toggle("tasks", index, e.target.checked)} />
                        <span className="leading-relaxed"><strong>{index + 1}.</strong> {task}</span>
                      </label>
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <h3 className="mb-2 font-semibold text-sm">Evidence to create</h3>
                <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
                  {lab.deliverables.map(item => <li key={item}>{item}</li>)}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Keep evidence in your own training repo or workspace. BuildRx does not read, assess, or upload it automatically.
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="font-semibold text-sm">Acceptance checks — confirm only after testing</h3>
                {lab.acceptance.map((check, index) => (
                  <label key={index} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
                    <input type="checkbox" className="mt-1" checked={state.checks[index] === true}
                      onChange={e => toggle("checks", index, e.target.checked)} />
                    <span>{check}</span>
                  </label>
                ))}
                <div role="status" className="rounded-lg bg-muted/40 p-3 text-xs">
                  {done
                    ? "You marked every task and check complete. This is your own report, not automated verification or a certificate."
                    : "Continue the lab and tick tasks only after you do them. A checked box is not independent proof."}
                </div>
              </section>

              {starter && (
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Open starter code kit — {starter.name}
                  </summary>
                  <div className="mt-3 space-y-4">
                    <p className="text-xs text-muted-foreground">{starter.description}</p>
                    <p className="text-xs font-semibold">Set up on your own local training workspace:</p>
                    <ol className="ml-5 list-decimal space-y-1 text-xs">
                      {starter.setup.map(step => <li key={step}>{step}</li>)}
                    </ol>
                    {starter.files.map(file => (
                      <div key={file.path} className="min-w-0 rounded-lg border p-2">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <code className="max-w-full break-all text-xs">{file.path}</code>
                          <Button size="sm" variant="outline" onClick={() => void copyStarter(file.content, file.path)}>
                            <Copy className="mr-1 size-3.5" /> {copiedPath === file.path ? "Copied" : "Copy file"}
                          </Button>
                        </div>
                        <pre className="max-h-64 max-w-full overflow-auto whitespace-pre text-xs" aria-label={`Starter code for ${file.path}`}>
                          <code>{file.content}</code>
                        </pre>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      These snippets are study scaffolds, not validated full applications.
                      BuildRx never installs packages or executes the displayed code for you.
                    </p>
                  </div>
                </details>
              )}

              <section>
                <h3 className="mb-2 font-semibold text-sm">Official reference materials</h3>
                <div className="flex flex-wrap gap-2">
                  {lab.references.map(ref => (
                    <a key={ref.url} href={ref.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs hover:bg-muted">
                      {ref.label} <ExternalLink className="size-3" />
                    </a>
                  ))}
                </div>
              </section>

              <div className="flex flex-wrap gap-2 border-t pt-3">
                <Button size="sm" variant="outline" onClick={downloadLabPlan}>
                  <Download className="mr-1.5 size-3.5" /> Download lab brief
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/learn/playground">
                    <Code2 className="mr-1.5 size-3.5" /> Open interactive coding lab
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href={"/learn/studio?track=" + track.id}>
                    <FolderOpen className="mr-1.5 size-3.5" /> Edit this track's project
                  </Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/projects"><ArrowRight className="mr-1.5 size-3.5" /> Open BuildRx projects</Link>
                </Button>
                {labs[currentIndex + 1] && (
                  <Button size="sm" variant="outline" onClick={() => selectLab(labs[currentIndex + 1].id)}>
                    Next lab <ArrowRight className="ml-1.5 size-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-4 text-primary" /> AI Lab Mentor
              </CardTitle>
              <CardDescription>
                Generate a detailed walkthrough or five-day training plan for this exact lab.
                It cannot execute code, grade your repository, or publish a mobile build.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="lab-level">My experience</Label>
                  <select id="lab-level" className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={level} onChange={e => setLevel(e.target.value as typeof level)}>
                    <option value="first-time">First-time developer</option>
                    <option value="learning">Learning fundamentals</option>
                    <option value="building">Already building software</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lab-mode">Training format</Label>
                  <select id="lab-mode" className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
                    <option value="lesson">One practical workshop</option>
                    <option value="five-day-plan">Five-day laboratory course</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="lab-goal">My training goal (optional)</Label>
                <Textarea id="lab-goal" rows={2} maxLength={160} value={goal}
                  onChange={e => setGoal(e.target.value)}
                  placeholder="Example: I want to build my first mobile inventory app." />
                <p className="text-xs text-muted-foreground">Do not paste credentials, passwords, private customer data or API tokens. AI training uses available provider capacity.</p>
              </div>
              <Button disabled={generating} onClick={() => void generateLabMentor()} className="w-full sm:w-auto">
                {generating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
                {generating ? "Creating lab training…" : "Teach me this lab"}
              </Button>
              {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">{error} Use the authored tasks above even when AI is offline.</p>}
              {generated && (
                <section aria-label="AI-generated lab mentoring" className="min-w-0 space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <ClipboardCheck className="size-4" />
                    <span className="text-sm font-semibold">AI-generated training draft</span>
                    <Badge variant="outline">Not verified</Badge>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none break-words text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{generated}</ReactMarkdown>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Verify commands against official docs. Your checkbox progress is not assessed by the AI.
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadLabPlan}>
                    <Download className="mr-1.5 size-3.5" /> Save guidance with lab brief
                  </Button>
                </section>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
