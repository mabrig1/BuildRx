import { NextResponse } from "next/server";
import { z } from "zod";

import {
  containsCredential,
  feedbackInputSchema,
} from "@/lib/agents/build-feedback";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const querySchema = z.object({ projectId: z.string().uuid() });

/**
 * Authenticated, owner-scoped project feedback. No external LLM call,
 * telemetry export or rebuild is triggered by storing a comment.
 */
async function authenticateProject(projectId: string) {
  if (!isSupabaseConfigured()) {
    return {
      error: NextResponse.json(
        { error: "Feedback requires configured Supabase; demo mode is not persistent." },
        { status: 503 }
      ),
    };
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (projectError) {
    return { error: NextResponse.json({ error: "Project lookup unavailable" }, { status: 503 }) };
  }
  if (!project) {
    return { error: NextResponse.json({ error: "Project not found" }, { status: 404 }) };
  }
  return { supabase, userId: user.id };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ projectId: url.searchParams.get("projectId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
  }
  const auth = await authenticateProject(parsed.data.projectId);
  if (auth.error) return auth.error;
  const { data, error } = await auth.supabase!
    .from("analytics")
    .select("id, created_at, properties")
    .eq("project_id", parsed.data.projectId)
    .eq("user_id", auth.userId!)
    .eq("event_type", "build_feedback")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    return NextResponse.json(
      { error: "Feedback read unavailable; apply the owner-read analytics migration." },
      { status: 503 }
    );
  }
  return NextResponse.json({
    feedback: (data ?? []).map((item) => ({
      id: item.id,
      createdAt: item.created_at,
      rating: typeof item.properties === "object" && item.properties !== null && !Array.isArray(item.properties)
        ? item.properties.rating
        : null,
      note: typeof item.properties === "object" && item.properties !== null && !Array.isArray(item.properties)
        ? item.properties.note
        : null,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = feedbackInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid feedback" }, { status: 400 });
  }
  const { projectId, rating, note, runId } = parsed.data;
  if (containsCredential(note)) {
    return NextResponse.json({ error: "Remove credentials or tokens before submitting feedback." }, { status: 400 });
  }
  const auth = await authenticateProject(projectId);
  if (auth.error) return auth.error;

  const limit = rateLimit(`build-feedback:${auth.userId}`, { limit: 6, windowMs: 60_000 });
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many feedback submissions. Try again shortly." },
      { status: 429, headers: rateLimitHeaders(limit) }
    );
  }
  const { error } = await auth.supabase!.from("analytics").insert({
    user_id: auth.userId!,
    project_id: projectId,
    event_type: "build_feedback",
    properties: { rating, note, ...(runId ? { runId } : {}) },
  });
  if (error) {
    return NextResponse.json({ error: "Feedback could not be saved" }, { status: 503 });
  }
  return NextResponse.json(
    { saved: true, message: "Feedback saved privately. It will not be sent to AI unless you choose to use it." },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
