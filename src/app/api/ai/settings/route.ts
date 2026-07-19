import { NextResponse } from "next/server";

import { nvidiaTextModel } from "@/lib/ai/nvidia";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { aiSettingsSchema } from "@/lib/validations/ai-platform";

/**
 * GET/PUT /api/ai/settings — the signed-in user's default AI
 * provider/model, shown and edited on the AI Settings page.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      defaultProvider: "nvidia",
      defaultModel: nvidiaTextModel(),
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("user_ai_settings")
    .select("default_provider, default_model")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    defaultProvider: data?.default_provider ?? "nvidia",
    defaultModel: data?.default_model || nvidiaTextModel(),
  });
}

export async function PUT(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase isn't configured on this deployment — settings can't be saved." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = aiSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("user_ai_settings").upsert({
    user_id: user.id,
    default_provider: parsed.data.defaultProvider,
    default_model: parsed.data.defaultModel,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
