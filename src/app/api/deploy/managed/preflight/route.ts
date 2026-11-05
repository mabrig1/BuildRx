import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";
import {
  evaluateManagedPreflight,
  operatorConfigurationPresent,
} from "@/lib/deploy/managed-preflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Diagnostics only. No provider clients, source preparation or writes.
 * The flag exposes preflight; it can never enable publishing.
 */
export async function GET(request: Request) {
  if (process.env.BUILDRX_MANAGED_PREFLIGHT_ENABLED !== "true")
    return reply({ error: "Managed publishing preflight is unavailable." }, 404);

  try {
    const session = await getSession();
    if (!session || session.demo || !session.userId)
      return reply({ error: "Sign in to check publishing readiness." }, 401);

    const parsed = z.string().uuid().safeParse(new URL(request.url).searchParams.get("projectId"));
    if (!parsed.success) return reply({ error: "Invalid app ID." }, 400);

    const db = await createClient();
    const { data: project, error } = await db.from("projects")
      .select("status").eq("id", parsed.data).eq("owner_id", session.userId).maybeSingle();
    if (error) return reply({ error: "Unable to verify app ownership." }, 503);
    if (!project) return reply({ error: "App not found." }, 404);

    // One bounded query, rather than list + per-file reads of changing source.
    // RLS and the ownership check both apply. Overflow fails closed.
    const { data: files, error: sourceError } = await db.from("project_files")
      .select("path, content").eq("project_id", parsed.data).limit(501);
    if (sourceError || !files || files.length > 500)
      return reply({ error: "Unable to inspect a complete bounded source snapshot." }, 503);

    return reply(evaluateManagedPreflight({
      projectStatus: project.status,
      files,
      operatorConfigured: operatorConfigurationPresent(process.env),
      // No durable, digest-bound builder attestation exists yet.
      // A projects.status value or client claim is not verification evidence.
      verification: null,
    }));
  } catch {
    // Never return provider/database error details or credentials.
    return reply({ error: "Publishing readiness could not be verified." }, 503);
  }
}
