import { isSafeFilePath } from "@/lib/agents/llm";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * File system manager for a project's virtual filesystem.
 *
 * Backed by the project_files table (RLS-scoped through the caller's
 * session) when Supabase is configured, or an in-memory store in demo
 * mode so generation, browsing, and previews work before any keys are
 * set. Server-only.
 */

export interface FileEntry {
  path: string;
  language: string | null;
  size: number;
  updatedAt: string | null;
}

export interface FileContent {
  path: string;
  content: string;
  language: string | null;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileTreeNode[];
}

export interface FileSystemManager {
  list(): Promise<FileEntry[]>;
  read(path: string): Promise<FileContent | null>;
  write(file: {
    path: string;
    content: string;
    language?: string | null;
  }): Promise<void>;
  writeMany(
    files: Array<{ path: string; content: string; language?: string | null }>
  ): Promise<void>;
  delete(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
}

export function languageFromPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    css: "css",
    html: "html",
    sql: "sql",
    json: "json",
    md: "markdown",
  };
  return ext ? (map[ext] ?? ext) : null;
}

export function assertSafePath(path: string): void {
  if (!isSafeFilePath(path)) {
    throw new Error(`Unsafe file path: ${path}`);
  }
}

/** Builds a nested tree (dirs first, alphabetical) from flat paths. */
export function buildFileTree(entries: FileEntry[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const entry of [...entries].sort((a, b) =>
    a.path.localeCompare(b.path)
  )) {
    const segments = entry.path.split("/");
    let level = root;
    let prefix = "";

    segments.forEach((segment, index) => {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      const isFile = index === segments.length - 1;
      let node = level.find((n) => n.name === segment && (n.type === "dir") !== isFile);

      if (!node) {
        node = isFile
          ? { name: segment, path: prefix, type: "file" }
          : { name: segment, path: prefix, type: "dir", children: [] };
        level.push(node);
      }
      if (!isFile) {
        level = node.children!;
      }
    });
  }

  const sortLevel = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) =>
      a.type === b.type
        ? a.name.localeCompare(b.name)
        : a.type === "dir"
          ? -1
          : 1
    );
    for (const node of nodes) {
      if (node.children) sortLevel(node.children);
    }
  };
  sortLevel(root);
  return root;
}

// ------------------------------------------------------------------
// Supabase-backed implementation (RLS enforces ownership)
// ------------------------------------------------------------------

class SupabaseFileSystem implements FileSystemManager {
  constructor(private projectId: string) {}

  private async client() {
    const { createClient } = await import("@/lib/supabase/server");
    return createClient();
  }

  async list(): Promise<FileEntry[]> {
    const supabase = await this.client();
    const { data, error } = await supabase
      .from("project_files")
      .select("path, language, content, updated_at")
      .eq("project_id", this.projectId)
      .order("path");
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      path: row.path,
      language: row.language,
      size: row.content.length,
      updatedAt: row.updated_at,
    }));
  }

  async read(path: string): Promise<FileContent | null> {
    assertSafePath(path);
    const supabase = await this.client();
    const { data } = await supabase
      .from("project_files")
      .select("path, content, language")
      .eq("project_id", this.projectId)
      .eq("path", path)
      .maybeSingle();
    return data ?? null;
  }

  async write(file: {
    path: string;
    content: string;
    language?: string | null;
  }): Promise<void> {
    await this.writeMany([file]);
  }

  async writeMany(
    files: Array<{ path: string; content: string; language?: string | null }>
  ): Promise<void> {
    if (files.length === 0) return;
    files.forEach((f) => assertSafePath(f.path));
    const supabase = await this.client();
    const { error } = await supabase.from("project_files").upsert(
      files.map((f) => ({
        project_id: this.projectId,
        path: f.path,
        content: f.content,
        language: f.language ?? languageFromPath(f.path),
      })),
      { onConflict: "project_id,path" }
    );
    if (error) throw new Error(error.message);
  }

  async delete(path: string): Promise<void> {
    assertSafePath(path);
    const supabase = await this.client();
    const { error } = await supabase
      .from("project_files")
      .delete()
      .eq("project_id", this.projectId)
      .eq("path", path);
    if (error) throw new Error(error.message);
  }

  async rename(from: string, to: string): Promise<void> {
    assertSafePath(from);
    assertSafePath(to);
    const file = await this.read(from);
    if (!file) throw new Error(`File not found: ${from}`);
    await this.writeMany([
      { path: to, content: file.content, language: languageFromPath(to) },
    ]);
    await this.delete(from);
  }
}

// ------------------------------------------------------------------
// In-memory demo implementation (no Supabase configured)
// ------------------------------------------------------------------

type DemoStore = Map<string, Map<string, { content: string; language: string | null; updatedAt: string }>>;

const globalStore = globalThis as unknown as { __appCreatorFiles?: DemoStore };

function demoStore(): DemoStore {
  globalStore.__appCreatorFiles ??= new Map();
  return globalStore.__appCreatorFiles;
}

class DemoFileSystem implements FileSystemManager {
  constructor(private projectId: string) {}

  private files() {
    const store = demoStore();
    if (!store.has(this.projectId)) {
      store.set(this.projectId, new Map());
    }
    return store.get(this.projectId)!;
  }

  async list(): Promise<FileEntry[]> {
    return [...this.files().entries()].map(([path, file]) => ({
      path,
      language: file.language,
      size: file.content.length,
      updatedAt: file.updatedAt,
    }));
  }

  async read(path: string): Promise<FileContent | null> {
    assertSafePath(path);
    const file = this.files().get(path);
    return file
      ? { path, content: file.content, language: file.language }
      : null;
  }

  async write(file: {
    path: string;
    content: string;
    language?: string | null;
  }): Promise<void> {
    await this.writeMany([file]);
  }

  async writeMany(
    files: Array<{ path: string; content: string; language?: string | null }>
  ): Promise<void> {
    for (const f of files) {
      assertSafePath(f.path);
      this.files().set(f.path, {
        content: f.content,
        language: f.language ?? languageFromPath(f.path),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  async delete(path: string): Promise<void> {
    assertSafePath(path);
    this.files().delete(path);
  }

  async rename(from: string, to: string): Promise<void> {
    const file = await this.read(from);
    if (!file) throw new Error(`File not found: ${from}`);
    await this.write({ path: to, content: file.content });
    await this.delete(from);
  }
}

/** Returns the file system manager for a project. */
export function getFileSystem(projectId: string): FileSystemManager {
  return isSupabaseConfigured()
    ? new SupabaseFileSystem(projectId)
    : new DemoFileSystem(projectId);
}

/** Project ids present in the in-memory demo store (demo mode only). */
export function demoProjectIds(): string[] {
  return [...demoStore().keys()];
}
