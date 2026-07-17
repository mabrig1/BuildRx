import { NextResponse } from "next/server";

import {
  isNvidiaConfigured,
  NVIDIA_MODELS,
  nvidiaCodeModel,
  nvidiaTextModel,
} from "@/lib/ai/nvidia";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/ai/models — the NVIDIA models available to /api/ai/generate
 * and /api/ai/code, plus the currently configured defaults.
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

  return NextResponse.json({
    configured: isNvidiaConfigured(),
    textModel: nvidiaTextModel(),
    codeModel: nvidiaCodeModel(),
    models: NVIDIA_MODELS,
  });
}
