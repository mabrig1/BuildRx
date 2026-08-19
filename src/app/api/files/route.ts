import { NextResponse } from "next/server";
import { z } from "zod";

import { isSafeFilePath } from "@/lib/agents/llm";
import { buildFileTree, getFileSystem } from "@/lib/files/manager";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Flat-path alias for the project filesystem, addressed by query/body
 * `projectId` instead of the path segment. Canonical route:
 * /api/projects/[projectId]/files.
 */

async function requireUser(): Promise<NextResponse | null> {
  if (!isSupabaseConfigured()) return null; // demo mode
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/**
 * GET /api/files?projectId=…          → { files, tree }
 * GET /api/files?projectId=…&path=…   → { file }
 */
export async function GET(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  const path = searchParams.get("path");
  const fs = getFileSystem(projectId);

  try {
    if (path) {
      if (!isSafeFilePath(path)) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
      }
      const file = await fs.read(path);
      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      return NextResponse.json({ file });
    }
    const files = await fs.list();
    return NextResponse.json({ files, tree: buildFileTree(files) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read files" },
      { status: 500 }
    );
  }
}

const writeSchema = z.object({
  projectId: z.string().min(1).max(100),
  path: z.string().min(1).max(200),
  content: z.string().max(500_000),
});

/** PUT /api/files — write/overwrite one file. */
export async function PUT(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = writeSchema.safeParse(body);
  if (!parsed.success || !isSafeFilePath(parsed.data.path)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await getFileSystem(parsed.data.projectId).write({
      path: parsed.data.path,
      content: parsed.data.content,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to write file" },
      { status: 500 }
    );
  }
}

/** DELETE /api/files?projectId=…&path=… */
export async function DELETE(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const path = searchParams.get("path");
  if (!projectId || !path || !isSafeFilePath(path)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await getFileSystem(projectId).delete(path);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete file" },
      { status: 500 }
    );
  }
}
