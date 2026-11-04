import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/github/service";
import { findGithubAppTemplate } from "@/lib/projects/github-app-templates";
import {
  GithubTemplateImportError,
  importGithubTemplateSource,
} from "@/lib/projects/import-github-template";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const schema = z.object({
  templateId: z.enum(["github-blog-starter", "github-supabase-starter"]),
});

/** POST — copy an allowlisted MIT example's editable files into a new draft.
 * This is a code import, NOT a verified app build or external deployment.
 * Users do not need a GitHub token; the pinned source is public.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.demo || !session.userId) {
    return NextResponse.json(
      { error: "Sign in to save an imported GitHub template as your project." },
      { status: 401 }
    );
  }
  // Reject cross-site writes even if a browser were to send an auth cookie.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    if (url.protocol !== "https:" && url.hostname !== "localhost") {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
    if (url.host !== host) {
      return NextResponse.json({ error: "Cross-site project imports are not allowed." }, { status: 403 });
    }
  }

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Select a supported GitHub template." }, { status: 400 });
  }
  const template = findGithubAppTemplate(body.data.templateId);
  if (!template) {
    return NextResponse.json({ error: "This GitHub template is not approved." }, { status: 400 });
  }

  const { checkProjectLimit } = await import("@/lib/billing/limits");
  const limitError = await checkProjectLimit(session.userId);
  if (limitError) {
    return NextResponse.json({ error: limitError }, { status: 402 });
  }

  try {
    // Inspect and download the public, pinned template BEFORE creating a
    // project; rate-limit or source failures never leave orphan drafts.
    const source = await importGithubTemplateSource(template);
    const supabase = await createClient();
    const { data: created, error: projectError } = await supabase
      .from("projects")
      .insert({
        owner_id: session.userId,
        name: template.name.replace(" (GitHub)", ""),
        description: `${template.description} — imported from an MIT-licensed example.`,
        status: "draft" as const,
      })
      .select("id")
      .single();
    if (projectError || !created) {
      return NextResponse.json(
        { error: "Could not save the imported template as a project." }, { status: 500 }
      );
    }

    try {
      // Limits per batch avoid unexpectedly large Supabase REST bodies.
      for (let i = 0; i < source.files.length; i += 25) {
        const batch = source.files.slice(i, i + 25);
        const { error } = await supabase.from("project_files").insert(
          batch.map((file) => ({
            project_id: created.id,
            path: file.path,
            content: file.content,
          }))
        );
        if (error) throw new Error("Project file storage failed.");
      }
      await supabase.from("chat_messages").insert({
        project_id: created.id,
        user_id: session.userId,
        role: "user",
        content:
          `I imported the MIT-licensed GitHub example ${template.sourceUrl} at commit ${template.commit}. ` +
          "Inspect and customize the code, check dependencies and missing assets, implement any requested workflows, " +
          "and validate all required backend services before claiming the project is ready.",
      });
    } catch {
      // Delete partial drafts. The project's foreign-key cascade clears files.
      await supabase.from("projects").delete().eq("id", created.id)
        .eq("owner_id", session.userId);
      return NextResponse.json({
        error: "Could not save the full GitHub template. No partial project was intentionally retained.",
      }, { status: 500 });
    }

    return NextResponse.json({
      projectId: created.id,
      imported: true,
      verified: false,
      deployed: false,
      files: source.files.length,
      skippedBinary: source.skippedBinary,
      sourceUrl: source.sourceUrl,
      message: "Editable source imported. Review and build before publishing.",
    }, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof GithubTemplateImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({
      error: "GitHub template could not be imported. Retry or choose a local starter brief.",
    }, { status: 502 });
  }
}
