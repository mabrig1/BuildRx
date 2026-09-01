import JSZip from "jszip";
import { NextResponse } from "next/server";

import { getFileSystem } from "@/lib/files/manager";
import { storeBuildArtifact } from "@/lib/cloudflare/r2";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * GET /api/projects/[projectId]/export — download the project's
 * virtual filesystem as a zip archive. Auth via session; RLS scopes
 * file access to the owner in connected mode (open in demo mode).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  let projectName = projectId;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .maybeSingle();
    if (project?.name) projectName = project.name;
  }

  const fs = getFileSystem(projectId);
  const entries = await fs.list();
  if (entries.length === 0) {
    return NextResponse.json(
      { error: "No files to export — run a build first." },
      { status: 404 }
    );
  }

  const zip = new JSZip();
  for (const entry of entries) {
    const file = await fs.read(entry.path);
    if (file) zip.file(file.path, file.content);
  }

  const archive = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const slug =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project";

  let artifactStatus = "not-configured";
  try {
    const artifactKey = await storeBuildArtifact({
      projectId,
      slug,
      archive: new Uint8Array(archive),
    });
    if (artifactKey) artifactStatus = "stored";
  } catch (error) {
    artifactStatus = "failed";
    console.warn(
      "[cloudflare-r2] artifact backup failed:",
      error instanceof Error ? error.name : "unknown error"
    );
  }

  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}.zip"`,
      "Cache-Control": "private, no-store",
      "X-BuildRx-Artifact": artifactStatus,
    },
  });
}
