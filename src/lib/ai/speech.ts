/**
 * Speech-to-text service — transcribes voice input for the chat
 * composer via an NVIDIA Riva/Parakeet ASR NIM.
 *
 * Unlike the chat/vision/plan models, hosted Parakeet endpoints on
 * build.nvidia.com are exposed at a per-model NVCF invocation URL
 * (shown on that model's "API" tab), not a stable, guessable path —
 * so there is deliberately no default here. NVIDIA_ASR_API_URL must be
 * set explicitly; without it this throws a clear, actionable error
 * instead of silently failing against a wrong endpoint.
 */

import {
  errorForStatus,
  nvidiaApiKey,
  NvidiaApiError,
  parseErrorDetail,
} from "@/lib/ai/nvidia";

const DEFAULT_ASR_MODEL = "nvidia/parakeet-tdt-0.6b-v2";

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function nvidiaAsrModel() {
  return cleanEnv(process.env.NVIDIA_ASR_MODEL) ?? DEFAULT_ASR_MODEL;
}

export function nvidiaAsrApiUrl() {
  return cleanEnv(process.env.NVIDIA_ASR_API_URL);
}

export function isNvidiaAsrConfigured() {
  return Boolean(nvidiaApiKey() && nvidiaAsrApiUrl());
}

export interface Transcription {
  text: string;
  model: string;
}

export async function transcribeAudio({
  file,
  filename,
  language = "en-US",
}: {
  file: Blob;
  filename: string;
  language?: string;
}): Promise<Transcription> {
  const apiKey = nvidiaApiKey();
  if (!apiKey) {
    throw new NvidiaApiError("NVIDIA_API_KEY is not configured.", 503, false);
  }

  const url = nvidiaAsrApiUrl();
  if (!url) {
    throw new NvidiaApiError(
      "Voice input isn't set up yet — NVIDIA_ASR_API_URL is missing. " +
        "Copy the invocation URL from your Parakeet model's API tab on " +
        "build.nvidia.com and set it as an env var.",
      503,
      false
    );
  }

  const form = new FormData();
  form.append("file", file, filename);
  form.append("language", language);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new NvidiaApiError(
      `Could not reach the NVIDIA speech API (${cause}).`,
      503,
      true
    );
  }

  if (!response.ok) {
    throw errorForStatus(response.status, await parseErrorDetail(response));
  }

  const data = (await response.json()) as {
    text?: string;
    results?: Array<{ transcript?: string; text?: string }>;
  };

  const text =
    data.text ??
    data.results
      ?.map((r) => r.transcript ?? r.text ?? "")
      .filter(Boolean)
      .join(" ") ??
    "";

  return { text: text.trim(), model: nvidiaAsrModel() };
}
