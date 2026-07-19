import { NextResponse } from "next/server";

import { isNvidiaConfigured, NvidiaApiError } from "@/lib/ai/nvidia";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { moderateContent } from "@/lib/ai/safety";
import { moderateSchema } from "@/lib/validations/ai";

export const maxDuration = 30;

/**
 * POST /api/ai/moderate — classifies text as safe/unsafe via the
 * Nemotron Safety Guard model. Used to gate prompts before they reach
 * chat/generate/code, and available standalone for custom flows.
 *
 * Body: { text }
 */
export async function POST(request: Request) {
  const auth = await authorizeAiRequest();
  if (!auth.ok) return auth.response;

  if (!isNvidiaConfigured()) {
    return NextResponse.json(
      { error: "NVIDIA API is not configured — set NVIDIA_API_KEY." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = moderateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    const result = await moderateContent(parsed.data.text);
    return NextResponse.json(result, { headers: auth.limitHeaders });
  } catch (error) {
    if (error instanceof NvidiaApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : error.status }
      );
    }
    return NextResponse.json(
      { error: "Content moderation failed. Please try again." },
      { status: 500 }
    );
  }
}
