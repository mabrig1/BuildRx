"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Archive, ArrowRight, CheckCircle2, Code2, Download, FileCode2, FilePlus2, FileSearch,
  FileText, FolderOpen, GraduationCap, HardDriveDownload, Loader2, Play, RotateCcw,
  ShieldAlert, Square, Trash2, Upload, Wrench,
} from "lucide-react";
import { useTheme } from "next-themes";

import { setupMonaco, monacoLanguageFor } from "@/components/editor/monaco-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  TRAINING_TRACKS, labsForTrack, type TrainingTrackId,
} from "@/lib/learn/labs";
import { starterKitForTrack } from "@/lib/learn/starter-kits";
import { buildStudioExport } from "@/lib/learn/studio-export-kit";
import {
  prepareReactDemoPreview, REACT_DEMO_APP, REACT_DEMO_CSS,
  REACT_DEMO_ENTRY, REACT_DEMO_STYLE, type ReactDemoFiles,
} from "@/lib/learn/studio-react-demo";
import {
  containsStudioSecret, inspectStudioWorkspace, isStudioTrack,
  newStudioWorkspace, parseStudioWorkspace, removeStudioFile, setStudioFile,
  STUDIO_MAX_BACKUP_BYTES, STUDIO_MAX_FILE_CHARS, validStudioPath,
  type StudioWorkspace,
} from "@/lib/learn/studio-workspace";

const MonacoEditor = dynamic(
  async () => {
    await setupMonaco();
    return (await import("@monaco-editor/react")).default;
  },
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-64 items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading local code editor…
      </div>
    ),
  },
);

const ReactPracticeSandbox = dynamic(
  () => import("@/components/learn/react-practice-sandbox").then(mod => mod.ReactPracticeSandbox),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-52 items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading isolated React preview…
      </div>
    ),
  },
);

const STORAGE_PREFIX = "buildrx-project-studio-v1:";
function storageKey(trackId: TrainingTrackId): string { return STORAGE_PREFIX + trackId; }

function loadLocal(trackId: TrainingTrackId): StudioWorkspace {
  const starter = newStudioWorkspace(trackId);
  try {
    const raw = window.localStorage.getItem(storageKey(trackId));
    if (!raw || raw.length > STUDIO_MAX_BACKUP_BYTES) return starter;
    const checked = parseStudioWorkspace(JSON.parse(raw), trackId);
    return checked.ok ? checked.workspace : starter;
  } catch {
    return starter;
  }
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProjectStudio({ initialTrack }: { initialTrack?: TrainingTrackId }) {
  const first = initialTrack && isStudioTrack(initialTrack) ? initialTrack : TRAINING_TRACKS[0].id;
  const [trackId, setTrackId] = useState<TrainingTrackId>(first);
  const [workspace, setWorkspace] = useState<StudioWorkspace>(() => newStudioWorkspace(first));
  const [loadedFor, setLoadedFor] = useState<TrainingTrackId | null>(null);
  const [activePath, setActivePath] = useState(Object.keys(newStudioWorkspace(first).files)[0]);
  const [newPath, setNewPath] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [showChecks, setShowChecks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [reactPreviewConsent, setReactPreviewConsent] = useState(false);
  const [reactPreview, setReactPreview] = useState<{ files: ReactDemoFiles; revision: number } | null>(null);
  const [reactPreviewMessage, setReactPreviewMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { resolvedTheme } = useTheme();
  const kit = starterKitForTrack(trackId);
  const checks = useMemo(() => inspectStudioWorkspace(workspace), [workspace]);
  const paths = useMemo(() => Object.keys(workspace.files).sort(), [workspace]);
  const active = Object.prototype.hasOwnProperty.call(workspace.files, activePath)
    ? activePath : paths[0];
  const contents = workspace.files[active] ?? "";
  const containsSecrets = Object.values(workspace.files).some(containsStudioSecret);
  const nextLab = labsForTrack(trackId)[0]?.id;
  const fileCount = paths.length;
  const totalChars = Object.values(workspace.files).reduce((sum, source) => sum + source.length, 0);
  const presentCount = checks.filter(item => item.status === "present").length;
  const exportPackage = useMemo(() => buildStudioExport(workspace), [workspace]);
  const reactPreviewStatus = useMemo(
    () => prepareReactDemoPreview({ trackId, files: workspace.files, containsSecrets }),
    [trackId, workspace.files, containsSecrets],
  );
  const reactPreviewStale = reactPreview !== null && reactPreviewStatus.ok &&
    (reactPreview.files["/App.js"] !== reactPreviewStatus.files["/App.js"] ||
     reactPreview.files["/styles.css"] !== reactPreviewStatus.files["/styles.css"]);

  useEffect(() => {
    const loaded = loadLocal(trackId);
    setWorkspace(loaded);
    setActivePath(Object.keys(loaded.files)[0]);
    setLoadedFor(trackId);
    setMessage("");
    setImportError("");
    setReactPreviewConsent(false);
    setReactPreview(null);
    setReactPreviewMessage("");
  }, [trackId]);

  useEffect(() => {
    if (loadedFor !== trackId || containsSecrets) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey(trackId), JSON.stringify(workspace));
      } catch {
        setMessage("Browser storage is unavailable or full. Export a backup to preserve your work.");
      }
    }, 600);
    return () => window.clearTimeout(id);
  }, [trackId, loadedFor, workspace, containsSecrets]);

  function chooseTrack(next: TrainingTrackId) {
    if (!isStudioTrack(next)) return;
    setLoadedFor(null);
    setTrackId(next);
  }

  function updateCode(next: string) {
    const response = setStudioFile(workspace, active, next);
    if (!response.ok) {
      setMessage(response.reason);
      return;
    }
    setWorkspace(response.workspace);
    setMessage("");
  }

  function addFile() {
    const name = newPath.trim();
    if (!validStudioPath(name)) {
      setMessage("Use a safe relative file such as src/components/Booking.tsx. Dotfiles and secrets are blocked.");
      return;
    }
    if (Object.prototype.hasOwnProperty.call(workspace.files, name)) {
      setActivePath(name);
      setNewPath("");
      return;
    }
    const result = setStudioFile(workspace, name, "");
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    setWorkspace(result.workspace);
    setActivePath(name);
    setNewPath("");
    setMessage("New local file created. It has not been built, tested, or pushed to GitHub.");
  }

  function removeFile() {
    if (paths.length <= 1) {
      setMessage("Keep at least one source file in the learning workspace.");
      return;
    }
    if (!window.confirm("Delete " + active + " from this local learning workspace?")) return;
    const next = removeStudioFile(workspace, active);
    setWorkspace(next);
    setActivePath(Object.keys(next.files)[0]);
    setMessage("Local file deleted. Nothing was changed on GitHub or a hosting provider.");
  }

  function resetTrack() {
    if (!window.confirm("Replace all local files in this training track with the reviewed starter kit?")) return;
    const fresh = newStudioWorkspace(trackId);
    setWorkspace(fresh);
    setActivePath(Object.keys(fresh.files)[0]);
    setMessage("Restored reviewed training starter files. This does not touch your actual projects.");
    setReactPreview(null);
    setReactPreviewMessage("");
  }

  function downloadBackup() {
    if (containsSecrets) {
      setMessage("Possible credentials were detected. Remove them before exporting a backup.");
      return;
    }
    const text = JSON.stringify(workspace, null, 2);
    triggerDownload(new Blob([text], { type: "application/json;charset=utf-8" }),
      "buildrx-training-" + trackId + ".studio.json");
    setMessage("Downloaded a local JSON backup. It is not an assessed submission.");
  }

  async function importBackup(file: File | undefined) {
    setImportError("");
    if (!file) return;
    if (!file.name.endsWith(".json") || file.size > STUDIO_MAX_BACKUP_BYTES) {
      setImportError("Choose a BuildRx .json backup under 260 KB.");
      return;
    }
    try {
      const raw = JSON.parse(await file.text());
      const response = parseStudioWorkspace(raw, trackId);
      if (!response.ok) {
        setImportError(response.reason);
        return;
      }
      if (!window.confirm("Replace this track's current files with the imported local backup?")) return;
      setWorkspace(response.workspace);
      setActivePath(Object.keys(response.workspace.files)[0]);
      setMessage("Loaded validated local training files. Nothing was executed or uploaded to BuildRx.");
      setReactPreview(null);
      setReactPreviewMessage("");
    } catch {
      setImportError("This file is not valid BuildRx training JSON.");
    }
  }

  function restoreUiDemoOnly() {
    if (trackId !== "fullstack-web") return;
    let next = workspace;
    const missing = [
      { path: REACT_DEMO_ENTRY, content: REACT_DEMO_APP },
      { path: REACT_DEMO_STYLE, content: REACT_DEMO_CSS },
    ].filter(item => !Object.prototype.hasOwnProperty.call(next.files, item.path));
    if (!missing.length) {
      setReactPreviewMessage("Both reviewed React demo files are already present.");
      return;
    }
    for (const item of missing) {
      const result = setStudioFile(next, item.path, item.content);
      if (!result.ok) {
        setReactPreviewMessage(result.reason);
        return;
      }
      next = result.workspace;
    }
    setWorkspace(next);
    setActivePath(missing[0].path);
    setReactPreviewMessage("Restored missing React UI demo files without replacing your other project files.");
  }

  function launchReactPreview() {
    if (!reactPreviewConsent) {
      setReactPreviewMessage("Confirm external sandbox processing before running the preview.");
      return;
    }
    if (loadedFor !== trackId) return;
    const snapshot = prepareReactDemoPreview({
      trackId, files: workspace.files, containsSecrets,
    });
    if (!snapshot.ok) {
      setReactPreviewMessage(snapshot.reason);
      return;
    }
    // Snapshot is frozen until the learner explicitly runs again: edits do
    // not silently send code to CodeSandbox's externally hosted bundler.
    setReactPreview(current => ({
      files: snapshot.files, revision: (current?.revision ?? 0) + 1,
    }));
    setReactPreviewMessage("Only the two selected React UI demo files were handed to the external sandbox. This does not run your Next.js server or database.");
  }

  async function downloadZip() {
    if (busy) return;
    const prepared = buildStudioExport(workspace);
    if (!prepared.ok) {
      setMessage(prepared.reason);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      // Includes only local edited sources and explicitly reviewed configuration.
      // Nothing is uploaded, installed, executed or auto-published.
      for (const [path, source] of Object.entries(prepared.files)) {
        zip.file(path, source);
      }
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 3 },
      });
      triggerDownload(blob, "buildrx-training-" + trackId + ".zip");
      setMessage("Training ZIP exported with stack-specific setup instructions. No build or deployment has been performed.");
    } catch {
      setMessage("ZIP export failed in this browser. Use the JSON backup option instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
            <FolderOpen className="size-5 text-primary" />
            Multi-file Project Studio
            <Badge variant="secondary">Browser-local</Badge>
          </CardTitle>
          <CardDescription>
            Work on a real source-file structure, save drafts locally, inspect training milestones
            and export a ZIP for your own development environment. BuildRx does not install packages,
            build Next.js or Expo, create GitHub commits, or deploy this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Choose a project track">
          {TRAINING_TRACKS.map(track => (
            <button key={track.id} type="button" aria-pressed={trackId === track.id}
              onClick={() => chooseTrack(track.id)}
              className={"rounded-lg border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (trackId === track.id ? "border-primary bg-primary/5" : "")}>
              <span className="block text-sm font-semibold">{track.title}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{track.stack.slice(0, 3).join(" · ")}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-4" aria-label="Training source editor">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{fileCount} files</Badge>
                <Badge variant="outline">{totalChars.toLocaleString()} source characters</Badge>
              </div>
              <CardTitle className="text-lg">{kit?.name ?? "Training starter"}</CardTitle>
              <CardDescription>{kit?.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,190px)_minmax(0,1fr)]">
                <div className="min-w-0 space-y-3">
                  <h3 className="text-sm font-semibold">Files</h3>
                  <nav aria-label="Training project files" className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-1">
                    {paths.map(path => (
                      <button type="button" key={path} aria-current={active === path ? "true" : undefined}
                        onClick={() => { setActivePath(path); setMessage(""); }}
                        className={"flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-xs break-all hover:bg-muted " +
                          (active === path ? "bg-primary/10 font-semibold text-primary" : "")}>
                        <FileCode2 className="mt-0.5 size-3.5 shrink-0" />
                        {path}
                      </button>
                    ))}
                  </nav>
                  <form className="space-y-2" onSubmit={event => { event.preventDefault(); addFile(); }}>
                    <Label htmlFor="studio-new-file" className="text-xs">New relative filename</Label>
                    <Input id="studio-new-file" value={newPath} onChange={e => setNewPath(e.target.value)}
                      placeholder="src/lib/example.ts" maxLength={140} className="text-sm" />
                    <Button size="sm" type="submit" variant="outline" className="w-full">
                      <FilePlus2 className="mr-1.5 size-3.5" /> Add file
                    </Button>
                  </form>
                </div>

                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="studio-editor" className="min-w-0 break-all text-sm">{active}</Label>
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant={advanced ? "outline" : "secondary"}
                        onClick={() => setAdvanced(false)}>Simple editor</Button>
                      <Button size="sm" variant={advanced ? "secondary" : "outline"}
                        onClick={() => setAdvanced(true)}>Syntax editor</Button>
                    </div>
                  </div>
                  {advanced ? (
                    <div className="overflow-hidden rounded-lg border">
                      <MonacoEditor
                        key={active}
                        height="420px"
                        path={"file:///" + active}
                        language={monacoLanguageFor(active)}
                        theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
                        value={contents}
                        onChange={value => updateCode(value ?? "")}
                        options={{
                          fontSize: 13, minimap: { enabled: false },
                          wordWrap: "on", tabSize: 2, automaticLayout: true,
                          scrollBeyondLastLine: false,
                        }}
                      />
                    </div>
                  ) : (
                    <textarea id="studio-editor" spellCheck={false}
                      value={contents} maxLength={STUDIO_MAX_FILE_CHARS + 1}
                      onChange={e => updateCode(e.target.value)}
                      rows={19} autoCapitalize="off" autoCorrect="off"
                      className="w-full min-w-0 resize-y rounded-lg border bg-slate-950 p-3 font-mono text-base leading-6 text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:text-sm"
                      aria-describedby="studio-source-help"
                    />
                  )}
                  <p id="studio-source-help" className="text-xs text-muted-foreground">
                    Drafts autosave in this browser only. Maximum 16,000 characters per file.
                    Do not enter API keys, database passwords or real customer information.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={removeFile}>
                      <Trash2 className="mr-1.5 size-3.5" /> Delete file
                    </Button>
                    <Button size="sm" variant="outline" onClick={resetTrack}>
                      <RotateCcw className="mr-1.5 size-3.5" /> Restore starter
                    </Button>
                  </div>
                </div>
              </div>
              {containsSecrets && (
                <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                  Possible credential detected in local code. Autosave and export are blocked until it is removed.
                  If it was real, rotate it.
                </p>
              )}
              {message && <p role="status" className="rounded-md border bg-muted/50 p-3 text-sm">{message}</p>}
            </CardContent>
          </Card>

          {trackId === "fullstack-web" && (
            <Card className="border-primary/25">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Play className="size-4 text-primary" /> React UI demo — run a real interactive preview
                  <Badge variant="outline">Opt-in external sandbox</Badge>
                </CardTitle>
                <CardDescription>
                  Edit only the reviewed <code>{REACT_DEMO_ENTRY}</code> and <code>{REACT_DEMO_STYLE}</code> files,
                  then preview a working in-memory React interface. Your Next.js pages, API routes,
                  MongoDB/Supabase configuration and production application are NOT executed here.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setActivePath(REACT_DEMO_ENTRY)}
                    disabled={!Object.prototype.hasOwnProperty.call(workspace.files, REACT_DEMO_ENTRY)}>
                    Edit React UI
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setActivePath(REACT_DEMO_STYLE)}
                    disabled={!Object.prototype.hasOwnProperty.call(workspace.files, REACT_DEMO_STYLE)}>
                    Edit demo CSS
                  </Button>
                  {!reactPreviewStatus.ok && (
                    <Button size="sm" variant="outline" onClick={restoreUiDemoOnly}>
                      Restore missing demo files
                    </Button>
                  )}
                </div>
                <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 p-3 text-xs text-foreground dark:bg-amber-950/20">
                  <p className="font-semibold">External sandbox privacy notice</p>
                  <p className="mt-1">
                    Preview uses CodeSandbox Sandpack, whose bundler is served from an external origin.
                    Running this demo transfers ONLY the two selected React UI source files to that
                    environment. Do not include credentials, customer information, or confidential code.
                    CodeSandbox may receive code as part of preview processing. Nothing is transferred
                    until you choose Run UI preview below.
                  </p>
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={reactPreviewConsent}
                    onChange={event => {
                      setReactPreviewConsent(event.target.checked);
                      if (!event.target.checked) {
                        setReactPreview(null);
                        setReactPreviewMessage("");
                      }
                    }} />
                  <span>I understand this demo loads an external CodeSandbox runner and will
                    send the two selected learning files when I explicitly run it.
                  </span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button disabled={!reactPreviewConsent || !reactPreviewStatus.ok}
                    onClick={launchReactPreview} className="gap-1.5">
                    <Play className="size-3.5" /> {reactPreview ? "Run updated UI" : "Run UI preview"}
                  </Button>
                  {reactPreview && (
                    <Button variant="outline" onClick={() => {
                      setReactPreview(null);
                      setReactPreviewMessage("Preview stopped. Local edits are unaffected.");
                    }} className="gap-1.5">
                      <Square className="size-3.5" /> Stop preview
                    </Button>
                  )}
                  {reactPreviewStale && <Badge variant="outline">Edited code not sent yet</Badge>}
                </div>
                {!reactPreviewStatus.ok && (
                  <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
                    {reactPreviewStatus.reason}
                  </p>
                )}
                {reactPreviewMessage && (
                  <p role="status" className="text-xs text-muted-foreground">{reactPreviewMessage}</p>
                )}
                {reactPreview && (
                  <div aria-label="CodeSandbox external React UI demonstration">
                    <ReactPracticeSandbox key={reactPreview.revision} files={reactPreview.files} />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  No authenticated BuildRx data, database, API keys, arbitrary packages or other
                  training files are provided to the preview. Its React state is temporary and resets
                  on reload. This is a frontend demonstration, not full-stack execution or certification.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDriveDownload className="size-4" /> Export or restore your training work
              </CardTitle>
              <CardDescription>
                Source stays in your browser unless you choose to download it. No upload to our servers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void downloadZip()} disabled={busy || !exportPackage.ok} className="gap-1.5">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
                  Download training project ZIP
                </Button>
                <Button variant="outline" onClick={downloadBackup} disabled={containsSecrets} className="gap-1.5">
                  <Download className="size-4" /> Backup JSON
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                  <Upload className="size-4" /> Restore JSON
                </Button>
              </div>
              <input type="file" ref={fileInputRef} accept=".json,application/json"
                className="sr-only" aria-label="Restore a local BuildRx training JSON backup"
                onChange={event => {
                  void importBackup(event.target.files?.[0]);
                  event.target.value = "";
                }} />
              {importError && <p role="alert" className="text-sm text-destructive">{importError}</p>}
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-semibold">
                  {exportPackage.ok ? exportPackage.label : "Export needs a correction"}
                </p>
                {exportPackage.ok ? (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">{exportPackage.caution}</p>
                    <ol className="mt-2 ml-4 list-decimal space-y-1 text-xs">
                      {exportPackage.steps.map(step => <li key={step}>{step}</li>)}
                    </ol>
                  </>
                ) : (
                  <p role="alert" className="mt-2 text-xs text-destructive">{exportPackage.reason}</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Web and TypeScript exports include npm manifests, setup commands and a read-only
                GitHub Actions verification template. The workflow only runs after you review the files
                and push them to your own repository; BuildRx does not initiate GitHub runs.
                Neither type of export includes preinstalled dependencies, a verified build or live data.
                Mobile exports remain an Expo overlay, and systems exports remain design documents.
                JSON restores only the selected training track.
              </p>
            </CardContent>
          </Card>
        </section>

        <aside className="min-w-0 space-y-4" aria-label="Guided project diagnostics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="size-4" /> What should I do next?
              </CardTitle>
              <CardDescription>
                Static, introductory source checks, not compiled tests or an AI code review.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" size="sm" onClick={() => setShowChecks(value => !value)}>
                {showChecks ? "Hide" : "Show"} checklist
              </Button>
              <p role="status" className="text-xs text-muted-foreground">
                {presentCount} of {checks.length} static indicators detected.
                Missing behavior requires actual testing in a development environment.
              </p>
              {showChecks && (
                <div className="space-y-2">
                  {checks.map(check => (
                    <div key={check.label} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        {check.status === "present" ? (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                        ) : (
                          <ShieldAlert className="size-4 shrink-0 text-amber-600" />
                        )}
                        <strong className="min-w-0 break-words">{check.label}</strong>
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          {check.status === "present" ? "Found" : check.status === "action" ? "To do" : "Caution"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
                    </div>
                  ))}
                </div>
              )}
              <p className="rounded-md bg-muted/50 p-3 text-xs">
                Next: download your source, set up the required framework locally,
                run actual typechecks/builds and verify authentication, persistence and accessibility.
                Then use BuildRx&apos;s guided GitHub/deployment workflow for a separately reviewed real app.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="size-4" /> Learn by doing
              </CardTitle>
              <CardDescription>Use the interactive runner for small snippets and the full labs for your framework.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/learn/playground">
                  <Code2 className="mr-1.5 size-3.5" /> Run coding exercises
                </Link>
              </Button>
              {nextLab && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={"/learn/labs?lab=" + nextLab}>
                    <FileText className="mr-1.5 size-3.5" /> Open track labs
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <Link href="/learn/doctor">
                  <FileSearch className="mr-1.5 size-3.5" /> Explain build failures
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/guide">
                  Read deployment guide <ArrowRight className="ml-1.5 size-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
