import { NextResponse } from "next/server";

import { isNvidiaConfigured, NvidiaApiError } from "@/lib/ai/nvidia";
import { authorizeAiRequest } from "@/lib/ai/route-helpers";
import { isNvidiaAsrConfigured, transcribeAudio } from "@/lib/ai/speech";
import { recordAiUsage } from "@/lib/ai/usage";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * POST /api/ai/transcribe — speech-to-text for the chat composer's
 * voice input, via an NVIDIA Parakeet ASR NIM.
 *
 * Body: multipart/form-data with a `file` field (and optional
 * `language`, `projectId`).
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
  if (!isNvidiaAsrConfigured()) {
    return NextResponse.json(
      {
        error:
          "Voice input isn't set up yet — NVIDIA_ASR_API_URL is missing on this deployment.",
      },
      { status: 503 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof Blob) || file.size === 0) {
    return NextResponse.json(
      { error: "Attach an audio recording to transcribe." },
      { status: 400 }
    );
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Recording is too long (max 20MB)." },
      { status: 400 }
    );
  }

  const language =
    typeof form?.get("language") === "string"
      ? (form.get("language") as string)
      : undefined;
  const projectId =
    typeof form?.get("projectId") === "string"
      ? (form.get("projectId") as string)
      : undefined;

  const startedAt = Date.now();

  try {
    const result = await transcribeAudio({
      file,
      filename: file instanceof File ? file.name : "recording.webm",
      language,
    });

    if (auth.userId) {
      await recordAiUsage({
        userId: auth.userId,
        projectId,
        model: result.model,
        status: "completed",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startedAt,
      });
    }

    return NextResponse.json(
      { text: result.text, model: result.model },
      { headers: auth.limitHeaders }
    );
  } catch (error) {
    if (auth.userId) {
      await recordAiUsage({
        userId: auth.userId,
        projectId,
        model: "speech",
        status: "failed",
        promptTokens: 0,
        completionTokens: 0,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    if (error instanceof NvidiaApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 500 ? 502 : error.status }
      );
    }
    return NextResponse.json(
      { error: "Transcription failed. Please try again." },
      { status: 500 }
    );
  }
}
