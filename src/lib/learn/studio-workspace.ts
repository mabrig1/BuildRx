import { TRAINING_TRACKS, type TrainingTrackId } from "@/lib/learn/labs";
import { starterKitForTrack } from "@/lib/learn/starter-kits";

/**
 * Client-only, untrusted educational project files.
 * No code here is ever installed, evaluated, deployed, or sent to a server.
 */
export const STUDIO_MAX_FILES = 16;
export const STUDIO_MAX_FILE_CHARS = 16_000;
export const STUDIO_MAX_TOTAL_CHARS = 120_000;
export const STUDIO_MAX_BACKUP_BYTES = 260_000;
export const STUDIO_VERSION = 1 as const;
export const STUDIO_EXTENSIONS = [
  "js", "jsx", "ts", "tsx", "css", "html", "md", "json", "yaml", "yml", "txt",
] as const;

export interface StudioWorkspace {
  version: 1;
  trackId: TrainingTrackId;
  files: Record<string, string>;
}

export interface StudioCheck {
  label: string;
  status: "present" | "action" | "caution";
  detail: string;
}

export function isStudioTrack(value: unknown): value is TrainingTrackId {
  return typeof value === "string" && TRAINING_TRACKS.some(track => track.id === value);
}

/**
 * Strict allowlist: relative source/docs paths only. No traversal, dotfiles,
 * secret files, hidden tool configs, build output folders, or encoded paths.
 */
export function validStudioPath(value: string): boolean {
  if (typeof value !== "string" || value.length < 3 || value.length > 140 ||
      value.startsWith("/") || value.includes("\\") || value.includes("%") ||
      value.includes("//")) return false;

  const segments = value.split("/");
  if (segments.length > 6) return false;
  if (segments.some(segment =>
    !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(segment) ||
    segment === "." || segment === ".." ||
    ["node_modules", "dist", "build", "coverage", ".git", ".next", ".expo", "vendor"]
      .includes(segment.toLowerCase()))) return false;

  const file = segments[segments.length - 1];
  const ext = file.split(".").pop()?.toLowerCase();
  if (!ext || !STUDIO_EXTENSIONS.includes(ext as typeof STUDIO_EXTENSIONS[number])) return false;
  if (/(^|[/.])(env|secret|credentials|id_rsa|id_ed25519)([/.]|$)/i.test(value)) return false;
  return !/(^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i.test(value);
}

export function containsStudioSecret(content: string): boolean {
  return /(?:github_pat_|ghp_[a-z0-9]{12,}|mongodb(?:\+srv)?:\/\/|sk-[a-z0-9_-]{12,}|nvapi-[a-z0-9_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/i.test(content);
}

export function newStudioWorkspace(trackId: TrainingTrackId): StudioWorkspace {
  const kit = starterKitForTrack(trackId);
  if (!kit) throw new Error("Unknown starter track");
  const files: Record<string, string> = {};
  for (const source of kit.files) {
    if (!validStudioPath(source.path)) throw new Error("Unsafe built-in starter path");
    files[source.path] = source.content;
  }
  return { version: STUDIO_VERSION, trackId, files };
}

export function parseStudioWorkspace(value: unknown, expectedTrack?: TrainingTrackId):
  | { ok: true; workspace: StudioWorkspace }
  | { ok: false; reason: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, reason: "The backup must be a valid BuildRx studio project." };
  }
  const data = value as Record<string, unknown>;
  if (data.version !== STUDIO_VERSION || !isStudioTrack(data.trackId)) {
    return { ok: false, reason: "Unsupported workspace version or training track." };
  }
  if (expectedTrack && data.trackId !== expectedTrack) {
    return { ok: false, reason: "This backup belongs to another track. Switch tracks before importing." };
  }
  if (!data.files || typeof data.files !== "object" || Array.isArray(data.files)) {
    return { ok: false, reason: "This backup does not contain valid source files." };
  }
  const entries = Object.entries(data.files);
  if (!entries.length || entries.length > STUDIO_MAX_FILES) {
    return { ok: false, reason: "A studio project must contain between 1 and 16 source files." };
  }
  let total = 0;
  const files: Record<string, string> = {};
  for (const [path, content] of entries) {
    if (!validStudioPath(path) || typeof content !== "string" ||
        content.length > STUDIO_MAX_FILE_CHARS) {
      return { ok: false, reason: "Backup includes an unsupported path or oversized source file." };
    }
    total += content.length;
    if (total > STUDIO_MAX_TOTAL_CHARS) {
      return { ok: false, reason: "Project exceeds the local source-size limit." };
    }
    if (containsStudioSecret(content)) {
      return { ok: false, reason: "Remove credentials or private connection strings before importing." };
    }
    files[path] = content;
  }
  return { ok: true, workspace: { version: STUDIO_VERSION, trackId: data.trackId, files } };
}

export function setStudioFile(workspace: StudioWorkspace, path: string, content: string):
  | { ok: true; workspace: StudioWorkspace }
  | { ok: false; reason: string } {
  if (!validStudioPath(path)) return { ok: false, reason: "Use a safe relative filename such as src/app/about/page.tsx." };
  if (content.length > STUDIO_MAX_FILE_CHARS) return { ok: false, reason: "Individual files are limited to 16,000 characters." };
  const isNew = !Object.prototype.hasOwnProperty.call(workspace.files, path);
  if (isNew && Object.keys(workspace.files).length >= STUDIO_MAX_FILES) {
    return { ok: false, reason: "A studio project supports a maximum of 16 files." };
  }
  const files = { ...workspace.files, [path]: content };
  if (Object.values(files).reduce((size, value) => size + value.length, 0) > STUDIO_MAX_TOTAL_CHARS) {
    return { ok: false, reason: "The project has reached its 120,000-character limit." };
  }
  return { ok: true, workspace: { ...workspace, files } };
}

export function removeStudioFile(workspace: StudioWorkspace, path: string): StudioWorkspace {
  if (!Object.prototype.hasOwnProperty.call(workspace.files, path) ||
      Object.keys(workspace.files).length <= 1) return workspace;
  const files = { ...workspace.files };
  delete files[path];
  return { ...workspace, files };
}

export function inspectStudioWorkspace(workspace: StudioWorkspace): StudioCheck[] {
  const files = workspace.files;
  const all = Object.values(files).join("\n");
  const checks: StudioCheck[] = [];
  const kit = starterKitForTrack(workspace.trackId);
  for (const starter of kit?.files ?? []) {
    const present = Object.prototype.hasOwnProperty.call(files, starter.path);
    checks.push({
      label: starter.path,
      status: present ? "present" : "action",
      detail: present ? "Source file is present (content not compiled)." : "Restore or recreate this training starter file.",
    });
  }
  const hasSecret = Object.values(files).some(containsStudioSecret);
  if (hasSecret) checks.push({
    label: "Potential credential in source",
    status: "caution",
    detail: "Remove secrets before saving/exporting or sharing this project.",
  });
  if (workspace.trackId === "fullstack-web") {
    checks.push({
      label: "Semantic page headings",
      status: /<h1(?:\s|>)/i.test(all) ? "present" : "action",
      detail: "Include a clear h1 on the main page; full accessibility still requires browser testing.",
    });
    checks.push({
      label: "Real backend and access control",
      status: "action",
      detail: "Add and test server-side validation, real persistence, user ownership and auth in your external development environment.",
    });
  } else if (workspace.trackId === "mobile-app") {
    checks.push({
      label: "React Native entry screen",
      status: /from\s+["']react-native["']/.test(all) && /export\s+default/.test(all) ? "present" : "action",
      detail: "A React Native screen must be compiled and run with Expo externally; this is not an APK/IPA build.",
    });
    checks.push({
      label: "Real device and offline tests",
      status: "action",
      detail: "Test device behavior and offline persistence outside BuildRx; this browser studio cannot run native device code.",
    });
  } else if (workspace.trackId === "software-engineering") {
    checks.push({
      label: "Unit testing source",
      status: /\b(?:test|it)\s*\(/.test(all) && /\bexpect\s*\(/.test(all) ? "present" : "action",
      detail: "Test source exists, but Vitest has not been executed by BuildRx Studio.",
    });
  } else {
    checks.push({
      label: "OpenAPI definition",
      status: /(?:^|\n)openapi:\s*3\./.test(all) ? "present" : "action",
      detail: "A matching text header is present; run an OpenAPI validator to verify schema syntax.",
    });
    checks.push({
      label: "Unresolved architecture tasks",
      status: /\bTODO\b/i.test(all) ? "action" : "present",
      detail: "Resolve TODOs and validate API contracts, idempotency, failure handling, and threat modeling.",
    });
  }
  checks.push({
    label: "Real build and runtime verification",
    status: "action",
    detail: "No npm/Next.js/Expo build, network or authenticated live app test runs in this learning studio.",
  });
  return checks;
}
