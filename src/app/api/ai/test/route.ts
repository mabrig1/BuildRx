import { NextResponse } from "next/server";

import {
  createChatCompletion,
  isNvidiaConfigured,
  NvidiaApiError,
} from "@/lib/ai/nvidia";

export const maxDuration = 60;

/**
 * GET /api/ai/test — NVIDIA connectivity check. Sends a minimal
 * completion to the configured endpoint and reports success/failure.
 * Intentionally auth-free and Supabase-free: it exists to verify the
 * NVIDIA_API_KEY / base URL configuration in isolation.
 */
export async function GET() {
  if (!isNvidiaConfigured()) {
    return NextResponse.json(
      { connected: false, error: "NVIDIA_API_KEY is not set" },
      { status: 503 }
    );
  }

  try {
    const result = await createChatCompletion(
      [{ role: "user", content: "Reply with the single word: pong" }],
      // Generous budget: reasoning models spend tokens thinking first.
      { maxTokens: 512, temperature: 0 }
    );
    return NextResponse.json({
      connected: true,
      message: "Connected to NVIDIA successfully",
      model: result.model,
      reply: result.text.trim().slice(0, 200),
    });
  } catch (error) {
    const status =
      error instanceof NvidiaApiError
        ? error.status >= 500
          ? 502
          : error.status
        : 500;
    return NextResponse.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status }
    );
  }
}
