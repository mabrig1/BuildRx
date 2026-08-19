import { NextResponse } from "next/server";

import {
  isNvidiaConfigured,
  listAvailableModels,
  NVIDIA_MODELS,
  nvidiaChatModel,
  nvidiaCodeModel,
  nvidiaGlmModel,
  nvidiaLlamaModel,
  nvidiaTextModel,
  rejectedModelVars,
} from "@/lib/ai/nvidia";
import { MODEL_CANDIDATES, resolvedModelPlan } from "@/lib/ai/models";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

/**
 * GET /api/ai/models — what this deployment can actually run.
 *
 * `available` is fetched live from NVIDIA with the configured key, so it
 * is the exact set of ids the model env vars may be set to. `inUse`
 * shows what each role currently resolves to, and `invalidVars` names
 * any variable rejected as malformed (an API key pasted into a model
 * field, say) — names only, never values.
 *
 * Auth-gated wherever Supabase is configured: the ids aren't secret, but
 * this makes a live call with the platform's key, so it isn't public.
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

  const available = await listAvailableModels();
  const invalidVars = rejectedModelVars();
  const resolved = await resolvedModelPlan();
  const availableSet = new Set(available);

  return NextResponse.json({
    configured: isNvidiaConfigured(),
    /** Every model id this key can call — copy these into the env vars. */
    available,
    availableCount: available.length,
    /** What each pipeline role resolves to right now. */
    inUse: {
      ...resolved,
      chainPrimary: nvidiaGlmModel(),
      chainFast: nvidiaChatModel(),
      chainLite: nvidiaLlamaModel(),
      generateEndpoint: nvidiaTextModel(),
      codeEndpoint: nvidiaCodeModel(),
    },
    /** Model env vars rejected as malformed — fix or delete these. */
    invalidVars,
    /** Whether every routed model is one the key can actually call. */
    inUseAreAvailable:
      available.length === 0
        ? null
        : Object.values(resolved).every((model) => availableSet.has(model)),
    /**
     * The preference ladder per role, annotated with what this key can
     * call — shows why each role resolved the way it did.
     */
    candidates: Object.fromEntries(
      Object.entries(MODEL_CANDIDATES).map(([role, ids]) => [
        role,
        ids.map((id) => ({ id, available: availableSet.has(id) })),
      ])
    ),
    models: NVIDIA_MODELS,
  });
}
