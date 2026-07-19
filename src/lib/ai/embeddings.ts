/**
 * Text embeddings via an NVIDIA NIM retrieval embedding model
 * (nv-embedqa-e5-v5 by default, 1024 dimensions — matches the
 * `vector(1024)` columns in the RAG migration). Like image.ts, this
 * hits its own endpoint convention rather than the shared
 * /chat/completions surface: NVIDIA's embedding NIMs require an
 * `input_type` of "query" or "passage" so the model can apply
 * asymmetric query/document encoding.
 */

import {
  errorForStatus,
  nvidiaApiKey,
  nvidiaBaseUrl,
  NvidiaApiError,
  parseErrorDetail,
} from "@/lib/ai/nvidia";

const DEFAULT_EMBEDDING_MODEL = "nvidia/nv-embedqa-e5-v5";

/** Dimensionality of the default embedding model — must match the `vector(N)` column width in the RAG migration. */
export const EMBEDDING_DIMENSIONS = 1024;

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function nvidiaEmbeddingModel() {
  return cleanEnv(process.env.NVIDIA_EMBEDDING_MODEL) ?? DEFAULT_EMBEDDING_MODEL;
}

export type EmbeddingInputType = "query" | "passage";

interface NvidiaEmbeddingResponseItem {
  embedding: number[];
  index: number;
}

/** Embeds a batch of texts. Use "query" for a search question, "passage" for documents being indexed. */
export async function embedTexts(
  texts: string[],
  inputType: EmbeddingInputType
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = nvidiaApiKey();
  if (!apiKey) {
    throw new NvidiaApiError("NVIDIA_API_KEY is not configured.", 503, false);
  }

  let response: Response;
  try {
    response = await fetch(`${nvidiaBaseUrl()}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: texts,
        model: nvidiaEmbeddingModel(),
        input_type: inputType,
        encoding_format: "float",
        truncate: "END",
      }),
    });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);
    throw new NvidiaApiError(`Could not reach the NVIDIA embeddings API (${cause}).`, 503, true);
  }

  if (!response.ok) {
    throw errorForStatus(response.status, await parseErrorDetail(response));
  }

  const data = await response.json();
  const items: NvidiaEmbeddingResponseItem[] = Array.isArray(data?.data) ? data.data : [];
  if (items.length !== texts.length) {
    throw new NvidiaApiError(
      "NVIDIA embeddings API returned an unexpected number of results.",
      502,
      false
    );
  }

  return [...items].sort((a, b) => a.index - b.index).map((item) => item.embedding);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text], "query");
  return embedding;
}
