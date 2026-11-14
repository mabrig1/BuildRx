"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, BookOpenCheck, CheckCircle2, CircleHelp, Code2, GraduationCap,
  RotateCcw, ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  checksForLab, gradeLabKnowledge, nextLabForTrack, prerequisitesForLab,
  type KnowledgeGrade,
} from "@/lib/learn/lab-mastery";
import {
  containsLikelyPrivateValue, emptyLabMasteryRecord,
  LAB_EVIDENCE_NOTE_LIMIT, LAB_REFLECTION_LIMIT,
  passedKnowledgeCheck, recordKnowledgeAttempt,
  type LabMasteryProgress, type LabMasteryRecord,
} from "@/lib/learn/lab-mastery-progress";
import { labsForTrack, type TrainingLab, type TrainingTrackId } from "@/lib/learn/labs";
import { PLAYGROUND_EXERCISES } from "@/lib/learn/playground-exercises";

export type LabLearningMode = "guided" | "explore";

export function LabLearningJourney({
  trackId, selectedLabId, doneLabIds, mastery, mode, setMode, selectLab,
}: {
  trackId: TrainingTrackId;
  selectedLabId: string;
  doneLabIds: ReadonlySet<string>;
  mastery: LabMasteryProgress;
  mode: LabLearningMode;
  setMode: (value: LabLearningMode) => void;
  selectLab: (id: string) => void;
}) {
  const labs = useMemo(() => labsForTrack(trackId), [trackId]);
  const suggested = nextLabForTrack(trackId, doneLabIds);
  const passedQuizzes = labs.filter(lab => passedKnowledgeCheck(lab.id, mastery[lab.id])).length;
  const done = labs.filter(lab => doneLabIds.has(lab.id)).length;
  return (
    <Card className="border-primary/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <GraduationCap className="size-5 text-primary" /> Guided skills roadmap
        </CardTitle>
        <CardDescription>
          Follow the recommended five-workshop progression or explore any lab freely.
          Completion checkboxes and knowledge questions are self-reported or locally scored practice,
          not instructor-assessed certifications.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={mode === "guided" ? "default" : "outline"}
            aria-pressed={mode === "guided"} onClick={() => setMode("guided")}>
            Guided sequence
          </Button>
          <Button size="sm" variant={mode === "explore" ? "default" : "outline"}
            aria-pressed={mode === "explore"} onClick={() => setMode("explore")}>
            Open practice
          </Button>
          <span className="text-xs text-muted-foreground">
            {done}/{labs.length} workshop checklists · {passedQuizzes}/{labs.length} knowledge checks passed locally
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {labs.map(lab => {
            const prereqs = prerequisitesForLab(lab.id);
            const priorComplete = prereqs.every(id => doneLabIds.has(id));
            const selected = lab.id === selectedLabId;
            const checklistDone = doneLabIds.has(lab.id);
            const quizPassed = passedKnowledgeCheck(lab.id, mastery[lab.id]);
            return (
              <button key={lab.id} type="button" onClick={() => selectLab(lab.id)}
                aria-current={selected ? "step" : undefined}
                className={"rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                  (selected ? "border-primary bg-primary/5" : "")}>
                <span className="flex items-center gap-1.5 text-xs font-semibold">
                  {checklistDone ? <CheckCircle2 className="size-4 text-emerald-600" /> : <span>Lab {lab.sequence}</span>}
                  {quizPassed && <BookOpenCheck className="size-4 text-primary" />}
                </span>
                <span className="mt-1 block text-xs font-medium leading-relaxed">{lab.title}</span>
                <span className="mt-2 block text-[11px] text-muted-foreground">
                  {mode === "guided" && !priorComplete ? "Recommended: finish earlier lab first" :
                    checklistDone ? "Checklist self-reported complete" : "Practice available"}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={"/learn/capstone?track=" + trackId}>
              <GraduationCap className="mr-1.5 size-3.5" />
              Prepare capstone evidence
              <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
          <span className="text-xs text-muted-foreground">
            A mentor must independently inspect the project before awarding any qualification.
          </span>
        </div>
        {suggested ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/50 p-3">
            <p className="min-w-0 flex-1 text-xs">
              <strong>Suggested next workshop:</strong> {labs.find(lab => lab.id === suggested)?.title}
              {mode === "explore" && " — practice remains available in any order."}
            </p>
            <Button size="sm" variant="outline" onClick={() => selectLab(suggested)}>
              Go to suggested lab <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            All workshop checklists have been self-reported complete. Review your knowledge checks
            and capstone evidence before asking a qualified mentor for independent assessment.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function LabMasteryReview({
  lab, record, onChange,
}: {
  lab: TrainingLab;
  record: LabMasteryRecord;
  onChange: (next: LabMasteryRecord) => void;
}) {
  const questions = useMemo(() => checksForLab(lab.id), [lab.id]);
  const codingChallenges = PLAYGROUND_EXERCISES.filter(exercise => exercise.lesson === lab.id);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [report, setReport] = useState<KnowledgeGrade | null>(null);
  const [reflection, setReflection] = useState(record.reflection);
  const [evidenceNote, setEvidenceNote] = useState(record.evidenceNote);
  const [note, setNote] = useState("");

  useEffect(() => {
    setAnswers({});
    setReport(null);
    setReflection(record.reflection);
    setEvidenceNote(record.evidenceNote);
    setNote("");
    // Switching labs resets editor fields to that lab's saved local notes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lab.id]);

  function submit() {
    const result = gradeLabKnowledge(lab.id, answers);
    if (result.answered !== result.total) {
      setNote("Answer every question before checking your understanding.");
      return;
    }
    setNote("");
    setReport(result);
    onChange(recordKnowledgeAttempt(lab.id, record, answers));
  }

  function saveReflection() {
    if (containsLikelyPrivateValue(reflection + "\n" + evidenceNote)) {
      setNote("Possible secret detected. Remove passwords, keys, connection strings and private records; do not save or share them.");
      return;
    }
    onChange({
      ...record,
      reflection: reflection.trim().slice(0, LAB_REFLECTION_LIMIT),
      evidenceNote: evidenceNote.trim().slice(0, LAB_EVIDENCE_NOTE_LIMIT),
    });
    setNote("Saved your notes locally in this browser. Evidence has not been uploaded or externally reviewed.");
  }

  const passed = passedKnowledgeCheck(lab.id, record);
  return (
    <Card className="border-primary/25">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpenCheck className="size-5 text-primary" /> Practice assessment and evidence journal
        </CardTitle>
        <CardDescription>
          Two concept questions, guided reflections and a reminder of what to demonstrate
          in your own repository. Knowledge scores are local practice only; they do not
          grade your source, validate your submissions or award certificates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Attempts: {record.attempts}</Badge>
          <Badge variant="outline">Best: {record.bestCorrect}/{questions.length}</Badge>
          {passed && <Badge variant="secondary">Knowledge check passed locally</Badge>}
        </div>
        <div className="space-y-4">
          {questions.map((q, qi) => {
            const detail = report?.details.find(row => row.questionId === q.id);
            return (
              <fieldset key={q.id} className="space-y-2 rounded-lg border p-3">
                <legend className="px-1 text-sm font-semibold">{qi + 1}. {q.prompt}</legend>
                <div className="grid gap-2">
                  {q.choices.map((choice, index) => (
                    <label key={index}
                      className="flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm hover:bg-muted/50">
                      <input type="radio" className="mt-1" name={"knowledge-" + q.id}
                        checked={answers[q.id] === index}
                        onChange={() => { setAnswers(previous => ({ ...previous, [q.id]: index })); setReport(null); }}
                      />
                      <span>{choice}</span>
                    </label>
                  ))}
                </div>
                {detail && (
                  <p className={"rounded-md p-2 text-xs " +
                    (detail.isCorrect ? "bg-emerald-500/10" : "bg-amber-500/10")}>
                    <strong>{detail.isCorrect ? "Correct." : "Review this concept."}</strong> {q.explanation}
                  </p>
                )}
              </fieldset>
            );
          })}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={submit}>
              <CircleHelp className="mr-1.5 size-4" /> Check my answers
            </Button>
            <Button variant="outline" onClick={() => { setAnswers({}); setReport(null); setNote(""); }}>
              <RotateCcw className="mr-1.5 size-4" /> Try again
            </Button>
            {report && (
              <span role="status" className="text-sm font-medium">
                {report.correct}/{report.total} correct. {report.passed ? "All concept checks passed." : "Review the explanations and retry."}
              </span>
            )}
          </div>
        </div>
        {codingChallenges.length > 0 && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Code2 className="size-4" /> Put this concept into code
            </h3>
            <p className="text-xs text-muted-foreground">
              Run the following isolated practice exercises before preparing real project evidence.
              Their passing checks do not certify the complete workshop.
            </p>
            <div className="flex flex-wrap gap-2">
              {codingChallenges.map(exercise => (
                <Button key={exercise.id} size="sm" variant="outline" asChild>
                  <Link href={"/learn/playground?exercise=" + exercise.id}>
                    {exercise.title} <ArrowRight className="ml-1.5 size-3.5" />
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3 border-t pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="size-4" /> Evidence and reflection journal — private, self-reported
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor={"lab-reflection-" + lab.id}>What did you build or learn, and what failed the first time?</Label>
            <Textarea id={"lab-reflection-" + lab.id} rows={3} maxLength={LAB_REFLECTION_LIMIT}
              value={reflection} onChange={event => setReflection(event.target.value)}
              placeholder="Describe the task, your first error and how you tested your correction." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={"lab-evidence-" + lab.id}>Evidence note (file names or test summary; do not paste secrets)</Label>
            <Textarea id={"lab-evidence-" + lab.id} rows={2} maxLength={LAB_EVIDENCE_NOTE_LIMIT}
              value={evidenceNote} onChange={event => setEvidenceNote(event.target.value)}
              placeholder="Example: src/lib/issues.test.ts — 4 tests pass locally; commit SHA recorded in my own repo." />
          </div>
          <Button variant="outline" onClick={saveReflection}>Save private reflection</Button>
          {note && <p role="status" className="text-xs text-muted-foreground">{note}</p>}
          <p className="text-xs text-muted-foreground">
            Keep credentials and personal information out of these notes. Notes stay in this
            browser and are not evidence that tests, external repositories or deployments passed.
            A mentor must independently verify your work before any formal assessment.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
