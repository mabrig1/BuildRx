"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CheckCircle2, ClipboardList, Download, ExternalLink,
  FileCheck2, FileText, FolderGit2, GraduationCap, RotateCcw,
  ShieldAlert, Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TRAINING_TRACKS, type TrainingTrackId } from "@/lib/learn/labs";
import {
  CAPSTONE_MAX_STORAGE_CHARS, CAPSTONE_NOTE_LIMIT, CAPSTONE_REFLECTION_LIMIT,
  CAPSTONE_RUBRICS, CAPSTONE_STORAGE_KEY, CAPSTONE_TITLE_LIMIT,
  CAPSTONE_URL_LIMIT, capstoneEvidenceReview, capstoneReviewMarkdown,
  containsCapstoneSensitiveText, newCapstoneRecord, parseCapstoneRecord,
  parseCapstoneStore, parseGithubRepository, validFullCommitSha,
  validGithubCiRun, validPublicDemoUrl,
  type CapstoneRecord, type CapstoneStore,
} from "@/lib/learn/capstone-evidence";

function saveDownload(filename: string, data: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CapstonePortfolio({ initialTrack }: { initialTrack?: TrainingTrackId }) {
  const [trackId, setTrackId] = useState<TrainingTrackId>(initialTrack ?? TRAINING_TRACKS[0].id);
  const [portfolio, setPortfolio] = useState<CapstoneStore>({});
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CAPSTONE_STORAGE_KEY);
      if (raw && raw.length <= CAPSTONE_MAX_STORAGE_CHARS) {
        setPortfolio(parseCapstoneStore(JSON.parse(raw)));
      }
    } catch {
      // Storage is optional. There is no server-backed student record.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (Object.values(portfolio).some(item => item && containsCapstoneSensitiveText(item))) return;
    const timeout = window.setTimeout(() => {
      try {
        const serialized = JSON.stringify(portfolio);
        if (serialized.length > CAPSTONE_MAX_STORAGE_CHARS) {
          setError("The browser evidence journal is full. Download a local packet before adding more notes.");
          return;
        }
        window.localStorage.setItem(CAPSTONE_STORAGE_KEY, serialized);
      } catch {
        setError("Browser storage is unavailable. Download the review packet to preserve your notes.");
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [portfolio, hydrated]);

  const record = portfolio[trackId] ?? newCapstoneRecord(trackId);
  const review = useMemo(() => capstoneEvidenceReview(record), [record]);
  const rubric = CAPSTONE_RUBRICS[trackId];
  const track = TRAINING_TRACKS.find(item => item.id === trackId) ?? TRAINING_TRACKS[0];
  const repo = parseGithubRepository(record.repoUrl);
  const commitUrl = repo && validFullCommitSha(record.commitSha)
    ? repo.url + "/commit/" + record.commitSha : null;
  const ciUrl = validGithubCiRun(record.ciRunUrl, record.repoUrl) ? record.ciRunUrl : null;
  const demoUrl = validPublicDemoUrl(record.demoUrl) ? record.demoUrl : null;
  const possibleSecret = containsCapstoneSensitiveText(record);

  function update(patch: Partial<CapstoneRecord>) {
    setMessage("");
    setError("");
    setPortfolio(previous => ({
      ...previous,
      [trackId]: { ...(previous[trackId] ?? newCapstoneRecord(trackId)), ...patch },
    }));
  }
  function setEvidence(id: string, note: string) {
    if (!rubric.some(item => item.id === id)) return;
    update({ evidence: { ...record.evidence, [id]: note } });
  }
  function exportPacket(format: "json" | "md") {
    const checked = parseCapstoneRecord(record, trackId);
    if (!checked.ok) {
      setError(checked.reason);
      return;
    }
    setError("");
    const name = "buildrx-capstone-" + trackId;
    if (format === "json") {
      saveDownload(name + ".json", JSON.stringify(checked.record, null, 2), "application/json;charset=utf-8");
    } else {
      saveDownload(name + "-review.md", capstoneReviewMarkdown(checked.record), "text/markdown;charset=utf-8");
    }
    setMessage("Downloaded a self-reported review packet. No repository, test, CI run or deployment has been inspected by BuildRx.");
  }

  async function importPacket(file?: File) {
    if (!file) return;
    setMessage("");
    setError("");
    if (!file.name.endsWith(".json") || file.size > 24_000) {
      setError("Choose a BuildRx capstone JSON file smaller than 24 KB.");
      return;
    }
    try {
      const parsed = parseCapstoneRecord(JSON.parse(await file.text()), trackId);
      if (!parsed.ok) {
        setError(parsed.reason);
        return;
      }
      if (!window.confirm("Replace this pathway's local capstone notes with the selected packet?")) return;
      updateRecord(parsed.record);
      setMessage("Restored this pathway's local evidence notes. Nothing has been submitted for grading.");
    } catch {
      setError("This file is not a valid capstone JSON packet.");
    }
  }

  function updateRecord(next: CapstoneRecord) {
    setPortfolio(previous => ({ ...previous, [trackId]: next }));
  }
  function clearRecord() {
    if (!window.confirm("Clear this pathway's capstone evidence notes from this browser?")) return;
    updateRecord(newCapstoneRecord(trackId));
    setError("");
    setMessage("The local draft has been reset. No GitHub repository was changed.");
  }

  return (
    <div className="space-y-5">
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <GraduationCap className="size-5 text-primary" /> Capstone Evidence Portfolio
            <Badge variant="outline">Self-reported draft</Badge>
          </CardTitle>
          <CardDescription>
            Prepare a clear, structured project review request linked to a specific GitHub
            repository and commit. Your information stays in this browser unless you explicitly
            download or share the packet. No source, CI result, URL or identity is independently verified.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {TRAINING_TRACKS.map(item => (
            <button key={item.id} type="button" onClick={() => { setTrackId(item.id); setError(""); setMessage(""); }}
              aria-pressed={trackId === item.id}
              className={"rounded-lg border p-3 text-left hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (trackId === item.id ? "border-primary bg-primary/5" : "")}>
              <span className="block text-sm font-semibold">{item.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{item.capstone}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-5" aria-label="Capstone evidence editor">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderGit2 className="size-5" /> Project and source revision
              </CardTitle>
              <CardDescription>
                Record references for an independent reviewer. These are validated as link
                formats only; BuildRx does not fetch, authenticate or inspect them.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cap-title">Capstone project title</Label>
                <Input id="cap-title" maxLength={CAPSTONE_TITLE_LIMIT} value={record.projectTitle}
                  onChange={event => update({ projectTitle: event.target.value })}
                  placeholder="Example: Secure appointment booking platform" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-repo">GitHub repository HTTPS URL</Label>
                <Input id="cap-repo" maxLength={CAPSTONE_URL_LIMIT} value={record.repoUrl}
                  onChange={event => update({ repoUrl: event.target.value })}
                  placeholder="https://github.com/owner/repository" />
                <p className="text-xs text-muted-foreground">
                  Only canonical github.com repository links are accepted for review reference.
                  A repository URL does not mean BuildRx has access to private code.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-commit">Full 40-character Git commit SHA</Label>
                <Input id="cap-commit" value={record.commitSha} maxLength={40}
                  onChange={event => update({ commitSha: event.target.value })}
                  placeholder="Use the exact commit that was tested" className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-ci">GitHub Actions run URL (optional)</Label>
                <Input id="cap-ci" value={record.ciRunUrl} maxLength={CAPSTONE_URL_LIMIT}
                  onChange={event => update({ ciRunUrl: event.target.value })}
                  placeholder="https://github.com/owner/repository/actions/runs/123456" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-demo">Public HTTPS demo URL (optional)</Label>
                <Input id="cap-demo" value={record.demoUrl} maxLength={CAPSTONE_URL_LIMIT}
                  onChange={event => update({ demoUrl: event.target.value })}
                  placeholder="https://your-test-app.example.com" />
                <p className="text-xs text-muted-foreground">
                  A supplied address does not prove the site serves the submitted commit.
                </p>
              </div>

              {(repo || commitUrl || ciUrl || demoUrl) && (
                <div className="flex flex-wrap gap-2">
                  {repo && (
                    <a href={repo.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
                      Inspect repository <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  {commitUrl && (
                    <a href={commitUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
                      Inspect commit <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  {ciUrl && (
                    <a href={ciUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
                      Inspect CI run <ExternalLink className="size-3.5" />
                    </a>
                  )}
                  {demoUrl && (
                    <a href={demoUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted">
                      Open external demo <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="size-5" /> Track-specific evidence checklist
              </CardTitle>
              <CardDescription>
                Describe where a reviewer can find evidence for each requirement.
                Descriptions are self-reported and may be incomplete or inaccurate.
                They are not marks, verified tests or a certificate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rubric.map((criterion, index) => (
                <div className="space-y-2 rounded-lg border p-3" key={criterion.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{index + 1}. {criterion.title}</span>
                    {record.evidence[criterion.id].trim() ? (
                      <Badge variant="secondary" className="ml-auto">Documented</Badge>
                    ) : (
                      <Badge variant="outline" className="ml-auto">Not documented</Badge>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong>Evidence requested:</strong> {criterion.requestedEvidence}
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong>Reviewer action:</strong> {criterion.reviewerCheck}
                  </p>
                  <Label htmlFor={"cap-note-" + criterion.id} className="text-xs">
                    Evidence description (file path, command or test observation)
                  </Label>
                  <Textarea id={"cap-note-" + criterion.id} rows={2}
                    maxLength={CAPSTONE_NOTE_LIMIT} value={record.evidence[criterion.id]}
                    onChange={event => setEvidence(criterion.id, event.target.value)}
                    placeholder="Example: tests/ownership.test.ts — User B denied; verify using commit-linked test run." />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="cap-reflection">What did you learn and what remains unverified?</Label>
                <Textarea id="cap-reflection" rows={4} maxLength={CAPSTONE_REFLECTION_LIMIT}
                  value={record.reflection} onChange={event => update({ reflection: event.target.value })}
                  placeholder="Describe one difficult bug, what you changed, and the remaining limitations." />
              </div>
            </CardContent>
          </Card>
        </section>

        <aside className="min-w-0 space-y-5" aria-label="Capstone preparation status">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileCheck2 className="size-5" /> Review packet completeness
              </CardTitle>
              <CardDescription>
                Documented evidence count is not an independently assessed project score.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div role="status" className="rounded-lg bg-muted/50 p-4">
                <p className="text-2xl font-semibold tabular-nums">{review.documented} / {review.required}</p>
                <p className="text-xs text-muted-foreground">Criteria with learner-written evidence notes</p>
              </div>
              <div className="space-y-2">
                {review.missing.map(item => (
                  <p key={item} className="text-xs text-muted-foreground">Not yet documented: {item}</p>
                ))}
                {review.errors.map(item => (
                  <p key={item} className="rounded-md border p-2 text-xs">{item}</p>
                ))}
              </div>
              {review.hasReviewableReferences && (
                <div className="flex items-start gap-2 rounded-lg border p-3 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <p>All reference fields and evidence notes are present in the draft.
                    This is ready to <strong>request independent review</strong>,
                    not proof that the evidence is genuine or that the project passed.
                  </p>
                </div>
              )}
              <p className="rounded-lg border p-3 text-xs text-muted-foreground">
                <ShieldAlert className="mr-1 inline size-3.5" />
                {review.description}
              </p>
              {possibleSecret && (
                <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
                  Possible credential detected. Browser autosave and export are disabled;
                  remove private keys, access tokens and connection strings immediately.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="size-4" /> Portable review packet
              </CardTitle>
              <CardDescription>
                Export a draft for a mentor or institution to verify independently.
                No data is submitted to BuildRx servers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button disabled={possibleSecret} onClick={() => exportPacket("md")} size="sm">
                  <FileText className="mr-1.5 size-3.5" /> Download review brief
                </Button>
                <Button disabled={possibleSecret} variant="outline" size="sm"
                  onClick={() => exportPacket("json")}>Backup JSON</Button>
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  <Upload className="mr-1.5 size-3.5" /> Restore JSON
                </Button>
              </div>
              <input type="file" accept=".json,application/json" ref={fileInput}
                className="sr-only" aria-label="Restore capstone review packet"
                onChange={event => {
                  void importPacket(event.target.files?.[0]);
                  event.target.value = "";
                }} />
              <Button variant="ghost" size="sm" onClick={clearRecord}>
                <RotateCcw className="mr-1.5 size-3.5" /> Reset this track&apos;s draft
              </Button>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {message && <p role="status" className="text-xs text-muted-foreground">{message}</p>}
              <p className="text-xs text-muted-foreground">
                Exported notes are self-reported. Reviewers should confirm ownership,
                commit provenance, real test execution, security boundaries and actual
                app behavior before issuing an independent evaluation.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Learn, build, then document</CardTitle>
              <CardDescription>{track.capstone}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href={"/learn/labs?track=" + trackId}>
                  Return to workshops <ArrowRight className="ml-1.5 size-3.5" />
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={"/learn/studio?track=" + trackId}>Open Project Studio</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/learn/doctor">Inspect a build error</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
