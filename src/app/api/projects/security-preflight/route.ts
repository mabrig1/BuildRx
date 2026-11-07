import { NextResponse } from "next/server";
import { z } from "zod";

import { isDeploymentSourcePath } from "@/lib/deploy/source";
import { getFileSystem } from "@/lib/files/manager";
import { getSession } from "@/lib/github/service";
import { scanDevShieldSource, devShieldPublicEvidence } from "@/lib/security/devshield-preflight";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const query = z.string().uuid();

function respond(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * GET /api/projects/security-preflight?projectId=<uuid>
 * Pure static review of an owner-scoped BuildRx VFS source snapshot.
 * This read-only endpoint does not authorize or trigger publication.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.demo || !session.userId) {
    return respond({ error: "Sign in to check saved project source." }, 401);
  }
  const projectId = query.safeParse(new URL(request.url).searchParams.get("projectId"));
  if (!projectId.success) return respond({ error: "Invalid project ID." }, 400);

  const supabase = await createClient();
  const { data: project, error } = await supabase.from("projects")
    .select("id, status").eq("id", projectId.data)
    .eq("owner_id", session.userId).maybeSingle();
  if (error) return respond({ error: "Unable to verify project ownership." }, 503);
  if (!project) return respond({ error: "Project not found." }, 404);

  try {
    const fs = getFileSystem(projectId.data);
    const entries = await fs.list();
    const selected = entries.filter(entry => isDeploymentSourcePath(entry.path));
    const files = (await Promise.all(selected.map(entry => fs.read(entry.path))))
      .filter((file): file is NonNullable<typeof file> => file !== null)
      .map(file => ({ path: file.path, content: file.content }));
    // A changed/disappeared file invalidates the source snapshot, not silently
    // counted as safe. This is a preview scan; publication rescans actual files.
    if (files.length !== selected.length) {
      return respond({ error: "Project source changed during scanning. Retry the check." }, 409);
    }
    const report = scanDevShieldSource(files);
    return respond({
      securityPreflight: devShieldPublicEvidence(report),
      projectStatus: project.status,
      securityCheckPassed: report.complete && report.status === "no-indicators-observed",
      deployed: false,
      message: "Static preflight only. A passing result is not proof the app is safe or deployable.",
    });
  } catch {
    return respond({ error: "The source snapshot could not be reviewed. No security pass was issued." }, 503);
  }
}
