import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getFileSystem } from "@/lib/files/manager";
import { TOOL_LIMITS } from "@/lib/agents/tools";
import { auditSavedApp } from "@/lib/projects/app-doctor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const safeId = z.string().uuid();
const MAX_TOTAL_BYTES = 2_000_000;

function response(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Read-only owner-scoped inspection. The API never executes generated code,
 * calls an AI model, changes project files, or triggers external publication.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  if (!isSupabaseConfigured()) {
    return response({ error: "Sign in to inspect a saved project. Demo drafts cannot be certified." }, 401);
  }
  const { projectId } = await params;
  if (!safeId.safeParse(projectId).success) return response({ error: "Invalid project ID" }, 400);
  const db = await createClient();
  const { data: { user }, error: authError } = await db.auth.getUser();
  if (authError || !user) return response({ error: "Sign in to inspect your project" }, 401);
  const { data: project, error } = await db.from("projects").select("id,status")
    .eq("id", projectId).eq("owner_id", user.id).maybeSingle();
  if (error) return response({ error: "Could not confirm project ownership" }, 503);
  if (!project) return response({ error: "Project not found" }, 404);

  try {
    const snapshot = await getFileSystem(projectId).readSnapshot(TOOL_LIMITS.maxFiles);
    const totalBytes = snapshot.reduce((sum, file) => sum + Buffer.byteLength(file.content, "utf8"), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return response({ error: "This source snapshot is too large for automatic inspection. Review its files manually." }, 413);
    }
    return response({
      doctor: auditSavedApp(snapshot, project.status),
      generatedAt: new Date().toISOString(),
      autoRepairPerformed: false,
      deployed: false,
    }, 200);
  } catch {
    return response({ error: "Unable to inspect the complete saved source. Nothing was changed." }, 503);
  }
}
