import {
  isNvidiaConfigured,
  nvidiaBaseUrl,
  nvidiaChatModel,
  nvidiaCodeModel,
  nvidiaGlmModel,
  nvidiaLlamaModel,
  nvidiaTextModel,
} from "@/lib/ai/nvidia";
import { availableProviders } from "@/lib/ai/provider";

/**
 * GET /api/ai/config — reports whether the NVIDIA integration is
 * configured, without making an API call (use /api/ai/test for a live
 * round trip). Never returns the key itself.
 */
export async function GET() {
  return Response.json({
    hasKey: isNvidiaConfigured(),
    baseUrl: nvidiaBaseUrl(),
    textModel: nvidiaTextModel(),
    codeModel: nvidiaCodeModel(),
    chatModel: nvidiaChatModel(),
    glmModel: nvidiaGlmModel(),
    llamaModel: nvidiaLlamaModel(),
    // The chat/agent-pipeline fallback order, in priority: providers
    // with no key configured are simply absent from this list.
    providerChain: availableProviders(),
  });
}
