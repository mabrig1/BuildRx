import { NextResponse } from "next/server";

import { listProviders } from "@/lib/ai/providers/registry";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/ai/providers — every AI provider BuildRx knows about, its
 * configuration status (never the key itself), default model, and full
 * model catalog (with pricing where known). Powers the AI Settings page
 * and the model comparison picker.
 */
export async function GET() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const providers = listProviders().map((provider) => ({
    id: provider.id,
    label: provider.label,
    configured: provider.isConfigured(),
    defaultModel: provider.defaultModel(),
    models: provider.models(),
  }));

  return NextResponse.json({ providers });
}
