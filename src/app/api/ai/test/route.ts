import { NextResponse } from "next/server";

import {
  createChatCompletion,
  isNvidiaConfigured,
  NvidiaApiError,
} from "@/lib/ai/nvidia";
import {
  createChatCompletion as createOpenRouterCompletion,
  isOpenRouterConfigured,
  openrouterStrongModel,
  OpenRouterApiError,
} from "@/lib/ai/openrouter";

export const maxDuration = 60;

/**
 * GET /api/ai/test — NVIDIA connectivity check. Sends a minimal
 * completion to the configured endpoint and reports success/failure.
 * Intentionally auth-free and Supabase-free: it exists to verify the
 * NVIDIA_API_KEY / base URL configuration in isolation.
 */
export async function GET() {
  // OpenRouter first, matching the provider chain — a green NVIDIA check
  // would be misleading when OpenRouter is what actually serves calls.
  if (isOpenRouterConfigured()) {
    try {
      const result = await createOpenRouterCompletion(
        [{ role: "user", content: "Reply with the single word: pong" }],
        { model: openrouterStrongModel(), maxTokens: 64, temperature: 0 }
      );
      return NextResponse.json({
        connected: true,
        provider: "openrouter",
        message: "Connected to OpenRouter successfully",
        model: result.model,
        reply: result.text.trim().slice(0, 200),
      });
    } catch (error) {
      const status = error instanceof OpenRouterApiError ? error.status : 500;
      return NextResponse.json(
        {
          connected: false,
          provider: "openrouter",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: status >= 500 ? 502 : status }
      );
    }
  }

  if (!isNvidiaConfigured()) {
    return NextResponse.json(
      {
        connected: false,
        error: "Neither OPENROUTER_API_KEY nor NVIDIA_API_KEY is set",
      },
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
      provider: "nvidia",
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
