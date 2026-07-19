import { NextResponse } from "next/server";

import { getProvider } from "@/lib/ai/providers/registry";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { recordAiUsage } from "@/lib/ai/usage";
import { generateDocs } from "@/lib/coding/ai";
import { generateDocsSchema } from "@/lib/validations/coding";

export const maxDuration = 60;

/**
 * POST /api/ai/code/docs — adds documentation comments to a code
 * snippet without changing behavior. Body: { code, language?,
 * provider, model?, projectId? } → { explanation, code, model }.
 */
export async function POST(request: Request) {
  const auth = await authorizeAiRequest();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = generateDocsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const input = parsed.data;
  const provider = getProvider(input.provider);
  if (!provider.isConfigured()) {
    return NextResponse.json(
      { error: `${provider.label} isn't configured on this deployment.` },
      { status: 503 }
    );
  }

  const startedAt = Date.now();
  try {
    const result = await generateDocs({
      providerId: input.provider,
      model: input.model,
      code: input.code,
      language: input.language,
    });

    if (auth.userId) {
      await recordAiUsage({
        userId: auth.userId,
        projectId: input.projectId,
        provider: input.provider,
        model: input.model ?? provider.defaultModel(),
        status: "completed",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startedAt,
      });
    }

    return NextResponse.json(result, { headers: auth.limitHeaders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't document this code." },
      { status: 502 }
    );
  }
}
