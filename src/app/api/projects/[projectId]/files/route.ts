import { NextResponse } from "next/server";
import { z } from "zod";

import { isSafeFilePath } from "@/lib/agents/llm";
import { buildFileTree, getFileSystem } from "@/lib/files/manager";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ projectId: string }> };

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
 * GET /api/projects/[projectId]/files          → { files, tree }
 * GET /api/projects/[projectId]/files?path=... → { file }
 */
export async function GET(request: Request, { params }: RouteParams) {
  const denied = await requireUser();
  if (denied) return denied;

  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
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
  path: z.string().min(1).max(200),
  content: z.string().max(500_000),
});

/** PUT /api/projects/[projectId]/files — write/overwrite one file. */
export async function PUT(request: Request, { params }: RouteParams) {
  const denied = await requireUser();
  if (denied) return denied;

  const { projectId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = writeSchema.safeParse(body);
  if (!parsed.success || !isSafeFilePath(parsed.data.path)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    await getFileSystem(projectId).write(parsed.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to write file" },
      { status: 500 }
    );
  }
}

/** DELETE /api/projects/[projectId]/files?path=... */
export async function DELETE(request: Request, { params }: RouteParams) {
  const denied = await requireUser();
  if (denied) return denied;

  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path");
  if (!path || !isSafeFilePath(path)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
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
