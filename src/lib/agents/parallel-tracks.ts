import type { GeneratedFile } from "@/lib/agents/types";

export type IndependentTrack = "ui" | "database";

export function isTrackOwnedPath(track: IndependentTrack, path: string): boolean {
  if (path.includes("\\\\") || path.split("/").some((segment) => segment === "." || segment === "..")) {
    return false;
  }
  if (track === "database") {
    return path === "supabase/schema.sql" || path === "src/lib/database.types.ts";
  }
  return (
    path === "preview/index.html" ||
    path === "src/app/globals.css" ||
    /^src\/components\/[a-zA-Z0-9/_().-]+\.tsx$/.test(path) ||
    /^src\/app\/(?!api\/)(?:[a-zA-Z0-9_()[\].-]+\/)*page\.tsx$/.test(path)
  );
}

export interface TrackFiles {
  track: IndependentTrack;
  files: Map<string, GeneratedFile>;
}

/**
 * Worker snapshots are isolated. Only each worker's allowlisted writes
 * are merged, in a fixed order; unrelated baseline files stay untouched.
 * A rogue model output cannot overwrite API source, secrets or another
 * agent's artifact. No tool or network actions are executed here.
 */
export function mergeIndependentTracks(
  baseline: Map<string, GeneratedFile>,
  tracks: TrackFiles[]
): { files: Map<string, GeneratedFile>; rejected: string[] } {
  const files = new Map(baseline);
  const changed = new Set<string>();
  const rejected: string[] = [];

  for (const { track, files: proposed } of tracks) {
    for (const [path, file] of [...proposed].sort(([a], [b]) => a.localeCompare(b))) {
      if (baseline.get(path)?.content === file.content) continue;
      if (!isTrackOwnedPath(track, path) || path !== file.path) {
        rejected.push(`${track}: out-of-scope file ${path}`);
        continue;
      }
      if (changed.has(path)) {
        rejected.push(`${track}: duplicate modification of ${path}`);
        continue;
      }
      files.set(path, file);
      changed.add(path);
    }
    for (const path of baseline.keys()) {
      if (!proposed.has(path)) {
        rejected.push(`${track}: ignored deletion of ${path}`);
      }
    }
  }
  return { files, rejected };
}
