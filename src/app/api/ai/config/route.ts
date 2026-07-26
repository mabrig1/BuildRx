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
 *
 * This endpoint has no auth check and is publicly reachable — do not
 * add any field here that echoes a raw env var's string content. Model
 * names are normally harmless, but a misconfigured deployment can set
 * any of these vars to something sensitive, and there's no way to
 * validate that server-side; only report booleans.
 */
function isDefault(value: string, defaultValue: string) {
  return value === defaultValue;
}

export async function GET() {
  return Response.json({
    hasKey: isNvidiaConfigured(),
    baseUrl: nvidiaBaseUrl(),
    textModelIsDefault: isDefault(nvidiaTextModel(), "z-ai/glm-5.2"),
    codeModelIsDefault: isDefault(nvidiaCodeModel(), "poolside/laguna-xs-2.1"),
    chatModelIsDefault: isDefault(nvidiaChatModel(), "stepfun-ai/step-3.7-flash"),
    glmModelIsDefault: isDefault(nvidiaGlmModel(), "z-ai/glm-5.2"),
    llamaModelIsDefault: isDefault(nvidiaLlamaModel(), "meta/llama-3.2-1b-instruct"),
    // The chat/agent-pipeline fallback order, in priority: tiers that
    // aren't usable (no NVIDIA key, Anthropic not explicitly enabled)
    // are simply absent from this list. Fixed, known-safe literal
    // strings only — never derived from env content.
    providerChain: availableProviders(),
    // True only when ANTHROPIC_ENABLED=true *and* a key is present;
    // otherwise the app is NVIDIA-only and cannot incur Anthropic spend.
    anthropicEnabled: availableProviders().includes("anthropic"),
  });
}
