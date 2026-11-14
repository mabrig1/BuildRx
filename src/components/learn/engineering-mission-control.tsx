"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BookOpenCheck, CheckCircle2, Code2, Download, FileCheck2,
  FlaskConical, FolderOpen, Lightbulb, LockKeyhole, RotateCcw, ShieldCheck,
} from "lucide-react";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  ENGINEERING_MISSIONS, ENGINEERING_PROGRESS_KEY, ENGINEERING_STAGES,
  engineeringPrompt, missionById, nextEngineeringStep, passedEngineeringSteps,
  safeEngineeringProgress, type EngineeringProgress,
} from "@/lib/learn/engineering-missions";

type Attempt = { missionId: string; stage: number; choice: number };

export function EngineeringMissionControl({ initialMission }: { initialMission?: string }) {
  const [missionId, setMissionId] = useState(initialMission ?? ENGINEERING_MISSIONS[0].id);
  const [progress, setProgress] = useState<EngineeringProgress>({});
  const [hydrated, setHydrated] = useState(false);
  const [stage, setStage] = useState(0);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [goal, setGoal] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ENGINEERING_PROGRESS_KEY);
      if (raw && raw.length <= 8_000) setProgress(safeEngineeringProgress(JSON.parse(raw)));
    } catch {
      // Browser-only learning practice is optional; no server-side assessment.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(ENGINEERING_PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      // Denied localStorage never unlocks credentials, billing or a certificate.
    }
  }, [hydrated, progress]);

  const mission = missionById(missionId) ?? ENGINEERING_MISSIONS[0];
  const correctCount = passedEngineeringSteps(mission, progress);
  const nextStep = nextEngineeringStep(mission, progress);
  const completed = correctCount === ENGINEERING_STAGES.length;
  const unlockedStage = completed ? ENGINEERING_STAGES.length - 1 : nextStep;
  const question = mission.decisions[stage];
  const correctlyAnswered = progress[mission.id]?.[stage] === question.correctIndex;
  const answerAttempt = attempt?.missionId === mission.id && attempt.stage === stage ? attempt : null;
  const totalPassed = ENGINEERING_MISSIONS.reduce((sum, item) => sum + passedEngineeringSteps(item, progress), 0);
  const completionPercent = Math.round(100 * totalPassed / (ENGINEERING_MISSIONS.length * ENGINEERING_STAGES.length));
  const prompt = useMemo(() => engineeringPrompt(mission, goal), [mission, goal]);

  function chooseMission(nextId: string) {
    const item = missionById(nextId);
    if (!item) return;
    setMissionId(item.id);
    setStage(nextEngineeringStep(item, progress));
    setAttempt(null);
    setGoal("");
    setNotice("");
  }
  function answer(choice: number) {
    if (stage > unlockedStage) return;
    setAttempt({ missionId: mission.id, stage, choice });
    if (choice !== question.correctIndex) return;
    setProgress(previous => {
      const prior = previous[mission.id] ?? [];
      return {
        ...previous,
        [mission.id]: mission.decisions.map((q, i) =>
          i === stage ? q.correctIndex : prior[i] === q.correctIndex ? q.correctIndex : -1
        ),
      };
    });
  }
  function reset() {
    setProgress(previous => {
      const next = { ...previous };
      delete next[mission.id];
      return next;
    });
    setStage(0);
    setAttempt(null);
    setNotice("This scenario's browser-local knowledge answers have been reset.");
  }
  function downloadBrief() {
    const markdown = [
      "# " + mission.title, "",
      "BuildRx Software Engineering Academy — self-study brief, not certification.", "",
      "## Problem", mission.problem, "",
      "## User story", mission.userStory, "",
      "## Suggested stack", mission.stack.join(", "), "",
      "## Requirements", ...mission.requirements.map(item => "- " + item), "",
      "## Acceptance criteria", ...mission.acceptance.map(item => "- [ ] " + item), "",
      "## Learning progress",
      "Correct knowledge checkpoints: " + correctCount + "/" + ENGINEERING_STAGES.length,
      "These are local practice responses; no working code, deployment or certificate has been verified.", "",
      "## Suggested AI build prompt", prompt, "",
      "## Release evidence to collect",
      "- Exact GitHub commit and source README",
      "- Test logs plus missing/failed scenario notes",
      "- Working preview, deployment checks and rollback procedure",
      "- Human review of functional, security and privacy limits",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "buildrx-engineering-" + mission.id + ".md";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Practice brief exported. No source code or test run has been certified.");
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-2xl">Build, test and explain your engineering decisions</CardTitle>
          <CardDescription>
            Each scenario has five decisions with immediate feedback. Choose the right response to unlock the next engineering stage,
            then practise real code in the existing isolated Coding Playground and generate an editable project through BuildRx.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">Knowledge practice: {totalPassed} of 20 correct across all scenarios</span>
            <Badge variant="secondary">{completionPercent}% correct</Badge>
          </div>
          <Progress value={completionPercent} />
          <p className="text-xs text-muted-foreground">Practice answers are saved on this browser only. They are not verified app builds, official grades, tutor feedback or certificates. Clearing browser storage resets them.</p>
        </CardContent>
      </Card>

      <section aria-label="Choose engineering scenario" className="grid gap-3 md:grid-cols-2">
        {ENGINEERING_MISSIONS.map(item => {
          const count = passedEngineeringSteps(item, progress);
          return (
            <button
              type="button" key={item.id} aria-pressed={mission.id === item.id}
              onClick={() => chooseMission(item.id)}
              className={"rounded-xl border p-4 text-left transition hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (mission.id === item.id ? "border-primary bg-primary/5" : "")}
            >
              <div className="flex items-center justify-between gap-3">
                <Badge variant="outline">{item.duration}</Badge>
                <span className="text-xs text-muted-foreground">{count}/5 decisions</span>
              </div>
              <p className="mt-2 font-semibold">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.outcome}</p>
            </button>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{mission.title}</CardTitle>
              <CardDescription>{mission.audience} · Realistic case-study exercise</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm"><strong>Problem:</strong> {mission.problem}</p>
              <p className="text-sm"><strong>User story:</strong> {mission.userStory}</p>
              <div className="flex flex-wrap gap-1.5">
                {mission.stack.map(item => <Badge variant="secondary" key={item}>{item}</Badge>)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BookOpenCheck className="size-5 text-primary" /> Guided engineering checkpoints</CardTitle>
              <CardDescription>Correct choices unlock subsequent stages. Select any completed stage to revisit its explanation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Engineering checkpoints">
                {ENGINEERING_STAGES.map((item, index) => {
                  const correct = progress[mission.id]?.[index] === mission.decisions[index].correctIndex;
                  const locked = index > unlockedStage;
                  return (
                    <button
                      key={item.id} type="button" disabled={locked} aria-current={index === stage ? "step" : undefined}
                      onClick={() => { setStage(index); setAttempt(null); }}
                      className={"rounded-lg border p-2 text-left text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                        (index === stage ? "border-primary bg-primary/5" : "") +
                        (locked ? " cursor-not-allowed opacity-50" : " hover:bg-muted/40")}
                    >
                      <span className="flex items-center gap-1 font-semibold">
                        {correct ? <CheckCircle2 className="size-4 text-emerald-600" /> :
                          locked ? <LockKeyhole className="size-4" /> : <span>{index + 1}.</span>}
                        {item.title}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-3 rounded-xl border p-4">
                <Badge variant="secondary">Stage {stage + 1} of {ENGINEERING_STAGES.length}</Badge>
                <h3 className="text-lg font-semibold">{ENGINEERING_STAGES[stage].title}</h3>
                <p className="text-sm text-muted-foreground">{ENGINEERING_STAGES[stage].skill}</p>
                <p className="font-medium">{question.question}</p>
                <div className="grid gap-2">
                  {question.choices.map((choice, i) => (
                    <button
                      type="button" key={choice}
                      disabled={correctlyAnswered}
                      aria-pressed={answerAttempt?.choice === i || (correctlyAnswered && question.correctIndex === i)}
                      onClick={() => answer(i)}
                      className={"rounded-lg border p-3 text-left text-sm transition hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                        ((answerAttempt?.choice === i || (correctlyAnswered && question.correctIndex === i))
                          ? "border-primary bg-primary/5" : "")}
                    >
                      <span className="mr-2 font-semibold">{String.fromCharCode(65 + i)}.</span>{choice}
                    </button>
                  ))}
                </div>
                {correctlyAnswered ? (
                  <div className="rounded-lg border p-3 text-sm" role="status">
                    <p className="flex items-center gap-1 font-semibold text-emerald-600"><CheckCircle2 className="size-4" /> Correct engineering decision</p>
                    <p className="mt-1">{question.explanation}</p>
                    {stage < ENGINEERING_STAGES.length - 1 && (
                      <Button className="mt-3" size="sm" onClick={() => { setStage(stage + 1); setAttempt(null); }}>
                        Continue to next stage <ArrowRight className="ml-1 size-4" />
                      </Button>
                    )}
                  </div>
                ) : answerAttempt ? (
                  <div className="rounded-lg border p-3 text-sm" role="alert">
                    <p className="flex items-center gap-1 font-medium"><Lightbulb className="size-4" /> Try another approach</p>
                    <p className="mt-1">{question.retryHint}</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Choose an answer to receive immediate feedback. Wrong answers can be retried.</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{correctCount}/5 scenario knowledge checks passed</Badge>
                {completed ? <Badge>Scenario questions completed locally</Badge> : null}
                <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="mr-1 size-4" /> Reset answers</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="size-5" /> Requirements and acceptance</CardTitle><CardDescription>Use these to assess generated code. No automated execution is claimed here.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Requirements</h3>
                <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">{mission.requirements.map(v => <li key={v}>{v}</li>)}</ul>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Acceptance checks</h3>
                <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">{mission.acceptance.map(v => <li key={v}>{v}</li>)}</ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Code2 className="size-5 text-primary" /> Build this app with AI</CardTitle>
              <CardDescription>Start a real editable BuildRx app project from this training specification. You can review and edit the prefilled prompt before creating anything.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label htmlFor="engineering-goal">Optional extra feature to explore</Label>
              <Input id="engineering-goal" value={goal} maxLength={180} onChange={event => setGoal(event.target.value)}
                placeholder="Example: add a staff dashboard" />
              <p className="text-xs text-muted-foreground">Do not enter API keys or private customer data. This field is not saved in browser progress.</p>
              <CreateProjectDialog
                key={mission.id}
                defaultValues={{ name: "Engineering Mission - " + mission.title,
                  description: mission.problem.slice(0, 300), prompt }}
                trigger={<Button className="w-full"><Code2 className="mr-1 size-4" /> Create app in BuildRx <ArrowRight className="ml-1 size-4" /></Button>}
              />
              <Button variant="outline" className="w-full" onClick={downloadBrief}>
                <Download className="mr-1 size-4" /> Export mission brief
              </Button>
              <p className="text-xs text-muted-foreground">The app builder uses its existing authentication, project quota and AI access. This button does not deploy or change external accounts.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="size-5" /> Continue in real training tools</CardTitle>
              <CardDescription>These links open functioning training screens, not placeholder lessons.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" asChild><Link href={"/learn/labs?lab=" + mission.labId + "&track=" + mission.trackId}>
                <FlaskConical className="mr-2 size-4" /> Open guided lab <ArrowRight className="ml-auto size-4" />
              </Link></Button>
              <Button variant="outline" asChild><Link href={"/learn/playground?exercise=" + mission.exerciseId}>
                <Code2 className="mr-2 size-4" /> Run coding challenge <ArrowRight className="ml-auto size-4" />
              </Link></Button>
              <Button variant="outline" asChild><Link href={"/learn/studio?track=" + mission.trackId}>
                <FolderOpen className="mr-2 size-4" /> Edit multi-file project <ArrowRight className="ml-auto size-4" />
              </Link></Button>
              <Button variant="outline" asChild><Link href="/learn/doctor">
                <Lightbulb className="mr-2 size-4" /> Debug a build failure <ArrowRight className="ml-auto size-4" />
              </Link></Button>
              <Button variant="outline" asChild><Link href="/learn/capstone">
                <ShieldCheck className="mr-2 size-4" /> Prepare human review evidence <ArrowRight className="ml-auto size-4" />
              </Link></Button>
            </CardContent>
          </Card>
          {notice ? <p className="text-xs text-muted-foreground" role="status">{notice}</p> : null}
        </div>
      </div>
    </div>
  );
}
