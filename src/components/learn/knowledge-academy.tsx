"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  GraduationCap,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_LESSONS,
  getKnowledgeLesson,
  type KnowledgeLesson,
} from "@/lib/learn/lessons";

type CoachMode = "lesson" | "five-day-plan";
type LearnerLevel = "first-time" | "learning" | "building";

function readCompletedLessons(): string[] {
  try {
    const value = window.localStorage.getItem("buildrx-learn-completed-v1");
    const parsed: unknown = value ? JSON.parse(value) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string =>
      typeof id === "string" && Boolean(getKnowledgeLesson(id)),
    );
  } catch {
    return [];
  }
}

export function KnowledgeAcademy({ initialLessonId }: { initialLessonId?: string }) {
  const [selectedId, setSelectedId] = useState(
    getKnowledgeLesson(initialLessonId ?? "")?.id ?? KNOWLEDGE_LESSONS[0].id,
  );
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof KNOWLEDGE_CATEGORIES)[number]>("All");
  const [completed, setCompleted] = useState<string[]>([]);
  const [answer, setAnswer] = useState<number | null>(null);
  const [level, setLevel] = useState<LearnerLevel>("first-time");
  const [mode, setMode] = useState<CoachMode>("lesson");
  const [goal, setGoal] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCompleted(readCompletedLessons());
  }, []);

  const lesson = getKnowledgeLesson(selectedId) ?? KNOWLEDGE_LESSONS[0];
  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return KNOWLEDGE_LESSONS.filter((item) =>
      (category === "All" || item.category === category) &&
      (!q || [item.title, item.summary, item.category, item.explain]
        .some(value => value.toLocaleLowerCase().includes(q))),
    );
  }, [query, category]);

  function choose(item: KnowledgeLesson) {
    setSelectedId(item.id);
    setAnswer(null);
    setGenerated(null);
    setProvider(null);
    setError(null);
  }

  function recordAnswer(index: number) {
    setAnswer(index);
    if (index !== lesson.quiz.answer || completed.includes(lesson.id)) return;
    const next = [...completed, lesson.id];
    setCompleted(next);
    try {
      window.localStorage.setItem("buildrx-learn-completed-v1", JSON.stringify(next));
    } catch {
      // Browser storage is optional. There is no server-side certification.
    }
  }

  function downloadTraining() {
    if (!generated) return;
    // A Markdown file is a study artifact, never a deploy command or credential.
    const markdown = [
      `# ${lesson.title} — ${mode === "lesson" ? "AI guided lesson" : "AI five-day mini-course"}`,
      "",
      "> AI-generated educational draft. Verify steps against official documentation.",
      "",
      generated,
    ].join("\n");
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `buildrx-training-${lesson.id}.md`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function createTraining() {
    setGenerating(true);
    setError(null);
    setGenerated(null);
    setProvider(null);
    try {
      const response = await fetch("/api/learn/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lesson.id,
          level,
          mode,
          goal: goal.trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The training request failed.");
      if (!result.generated || typeof result.text !== "string" || !result.text.trim()) {
        throw new Error("The AI tutor did not return training content.");
      }
      setGenerated(result.text);
      setProvider(typeof result.provider === "string" ? result.provider : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI training is unavailable.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <aside aria-label="Learning topics" className="min-w-0 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="size-4" /> Knowledge library
            </CardTitle>
            <CardDescription>10 beginner lessons, free to read. No AI key required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="learn-search" className="sr-only">Search lessons</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                id="learn-search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Search GitHub, Cloudflare, MongoDB…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="Lesson categories">
              {KNOWLEDGE_CATEGORIES.map(item => (
                <Button
                  key={item}
                  size="sm"
                  variant={category === item ? "default" : "outline"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setCategory(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs" role="status">
              {completed.length} of {KNOWLEDGE_LESSONS.length} quiz checkpoints passed
              (saved in this browser, not an official certification).
            </p>
          </CardContent>
        </Card>
        <div className="space-y-2">
          {visible.length === 0 ? (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">
              No lessons match this search. Try another term.
            </p>
          ) : visible.map(item => (
            <button
              type="button"
              key={item.id}
              aria-current={item.id === lesson.id ? "true" : undefined}
              onClick={() => choose(item)}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${item.id === lesson.id ? "border-primary bg-primary/5" : ""}`}
            >
              {completed.includes(item.id)
                ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                : <BookOpen className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{item.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{item.category} · {item.minutes} min</span>
              </span>
              <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </aside>

      <section className="min-w-0 space-y-5" aria-label="Selected beginner lesson">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{lesson.category}</Badge>
              <Badge variant="outline">{lesson.minutes} minute read</Badge>
              {completed.includes(lesson.id) ? <Badge variant="outline">Checkpoint passed</Badge> : null}
            </div>
            <CardTitle className="text-2xl">{lesson.title}</CardTitle>
            <CardDescription className="text-sm">{lesson.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-sm">
            <section>
              <h3 className="mb-2 font-semibold">How it works</h3>
              <p className="leading-relaxed">{lesson.explain}</p>
              <p className="mt-3 rounded-lg bg-muted/60 p-3 leading-relaxed">
                <strong>Think of it like this: </strong>{lesson.analogy}
              </p>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Follow these steps</h3>
              <ol className="ml-5 list-decimal space-y-2 leading-relaxed">
                {lesson.steps.map(step => <li key={step}>{step}</li>)}
              </ol>
            </section>
            <section className="rounded-lg border p-3">
              <h3 className="mb-2 font-semibold">Try it yourself</h3>
              <p className="leading-relaxed">{lesson.exercise}</p>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Mistakes to avoid</h3>
              <ul className="ml-5 list-disc space-y-2 text-muted-foreground">
                {lesson.pitfalls.map(pitfall => <li key={pitfall}>{pitfall}</li>)}
              </ul>
            </section>
            <section>
              <h3 className="mb-2 font-semibold">Learn more from the official source</h3>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {lesson.docs.map(doc => (
                  doc.url.startsWith("/") ? (
                    <Link key={doc.url} href={doc.url} className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                      {doc.label} <ChevronRight className="size-3.5" />
                    </Link>
                  ) : (
                    <a key={doc.url} href={doc.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                      {doc.label} <ExternalLink className="size-3.5" />
                    </a>
                  )
                ))}
              </div>
            </section>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Knowledge checkpoint</CardTitle>
            <CardDescription>{lesson.quiz.question}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              {lesson.quiz.options.map((option, index) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => recordAnswer(index)}
                  aria-pressed={answer === index}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${answer === index ? "border-primary bg-primary/5" : ""}`}
                >
                  <span className="mr-2 font-medium">{String.fromCharCode(65 + index)}.</span>{option}
                </button>
              ))}
            </div>
            {answer !== null && (
              <div role="status" className="rounded-lg border bg-muted/50 p-3 text-sm">
                <p className="font-semibold">
                  {answer === lesson.quiz.answer ? "Correct — checkpoint passed!" : "Not yet — try another answer."}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {answer === lesson.quiz.answer
                    ? lesson.quiz.explanation
                    : "Review the lesson above. You can try again without losing previous progress."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/25">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-5" />
              <Badge>Optional AI tutor</Badge>
            </div>
            <CardTitle className="text-xl">Create training just for you</CardTitle>
            <CardDescription>
              Ask AI to explain this subject at your level or generate a five-day practical mini-course.
              Only request training, never upload credentials. AI output is not verified proof of your deployment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="learn-level">My experience</Label>
                <select
                  id="learn-level"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={level}
                  onChange={event => setLevel(event.target.value as LearnerLevel)}
                >
                  <option value="first-time">Completely new</option>
                  <option value="learning">I have tried a few things</option>
                  <option value="building">I already build apps</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="learn-format">Training format</Label>
                <select
                  id="learn-format"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={mode}
                  onChange={event => setMode(event.target.value as CoachMode)}
                >
                  <option value="lesson">One guided lesson</option>
                  <option value="five-day-plan">Five-day course with labs</option>
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="learn-goal">What are you trying to build? (optional)</Label>
              <Textarea
                id="learn-goal"
                placeholder="Example: I want to put my school booking app on Cloudflare."
                value={goal}
                maxLength={160}
                onChange={event => setGoal(event.target.value)}
                rows={3}
              />
              <p className="text-muted-foreground text-xs">Do not type passwords, API keys or database URLs. Your request is sent to the configured AI provider.</p>
            </div>
            <Button onClick={() => void createTraining()} disabled={generating} className="w-full sm:w-auto">
              {generating ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
              {generating ? "Creating training…" : mode === "lesson" ? "Teach me this topic" : "Generate my five-day course"}
            </Button>
            {error && (
              <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                {error} The structured lesson above works without AI.
              </div>
            )}
            {generated && (
              <section aria-label="AI-generated training" className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <GraduationCap className="size-4" />
                  <p className="text-sm font-semibold">Your AI training draft</p>
                  <Badge variant="outline">Not independently verified</Badge>
                  {provider && <span className="text-xs text-muted-foreground">{provider}</span>}
                  <Button size="sm" variant="outline" className="sm:ml-auto" onClick={downloadTraining}>
                    <Download className="mr-1.5 size-3.5" /> Save as Markdown
                  </Button>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none break-words text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{generated}</ReactMarkdown>
                </div>
                <p className="text-xs text-muted-foreground">
                  Always verify commands and settings against official documentation and test in a nonproduction project first.
                </p>
              </section>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
