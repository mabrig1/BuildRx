/**
 * Text-to-image service — generates images (hero art, placeholders,
 * icons) for apps being built, via an NVIDIA NIM "visual GenAI" model
 * (Stable Diffusion 3.5 Large by default). This does NOT use the
 * OpenAI-compatible /chat/completions surface the rest of this module
 * shares — image NIMs live at their own per-model REST endpoint, which
 * NVIDIA occasionally revises. NVIDIA_IMAGE_API_URL lets an operator
 * point this at the exact endpoint shown on their model's API tab at
 * build.nvidia.com without a code change if the default below drifts.
 */

import {
  errorForStatus,
  nvidiaApiKey,
  NvidiaApiError,
  parseErrorDetail,
} from "@/lib/ai/nvidia";

const DEFAULT_IMAGE_MODEL = "stabilityai/stable-diffusion-3.5-large";
const DEFAULT_IMAGE_API_URL =
  "https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3.5-large";

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function nvidiaImageModel() {
  return cleanEnv(process.env.NVIDIA_IMAGE_MODEL) ?? DEFAULT_IMAGE_MODEL;
}

export function nvidiaImageApiUrl() {
  return cleanEnv(process.env.NVIDIA_IMAGE_API_URL) ?? DEFAULT_IMAGE_API_URL;
}

export interface GeneratedImage {
  imageDataUrl: string;
  model: string;
}

/**
 * Pulls a base64 image out of a NIM GenAI response, trying every field
 * name NVIDIA's visual-GenAI models have shipped with — the exact
 * shape varies by model family and isn't guaranteed here without a
 * live account to verify against.
 */
function extractBase64Image(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;

  if (typeof record.image === "string") return record.image;
  if (typeof record.b64_json === "string") return record.b64_json;

  const images = record.images;
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") {
      const firstRecord = first as Record<string, unknown>;
      if (typeof firstRecord.image === "string") return firstRecord.image;
      if (typeof firstRecord.base64 === "string") return firstRecord.base64;
      if (typeof firstRecord.b64_json === "string")
        return firstRecord.b64_json;
    }
  }

  const artifacts = record.artifacts;
  if (Array.isArray(artifacts) && artifacts.length > 0) {
    const first = artifacts[0];
    if (first && typeof first === "object") {
      const firstRecord = first as Record<string, unknown>;
      if (typeof firstRecord.base64 === "string") return firstRecord.base64;
    }
  }

  return undefined;
}

export async function generateImage({
  prompt,
  negativePrompt,
  aspectRatio = "1:1",
  seed,
}: {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
  seed?: number;
}): Promise<GeneratedImage> {
  const apiKey = nvidiaApiKey();
  if (!apiKey) {
    throw new NvidiaApiError("NVIDIA_API_KEY is not configured.", 503, false);
  }

  let response: Response;
  try {
    response = await fetch(nvidiaImageApiUrl(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        mode: "text-to-image",
        aspect_ratio: aspectRatio,
        ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
        ...(seed !== undefined ? { seed } : {}),
      }),
    });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new NvidiaApiError(
      `Could not reach the NVIDIA image API (${cause}).`,
      503,
      true
    );
  }

  if (!response.ok) {
    throw errorForStatus(response.status, await parseErrorDetail(response));
  }

  const data = await response.json();
  const base64 = extractBase64Image(data);
  if (!base64) {
    throw new NvidiaApiError(
      "NVIDIA image API returned an unexpected response shape — check " +
        "NVIDIA_IMAGE_API_URL against the current API reference for this model.",
      502,
      false
    );
  }

  return {
    imageDataUrl: `data:image/png;base64,${base64}`,
    model: nvidiaImageModel(),
  };
}
