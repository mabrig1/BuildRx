import {
  isNvidiaConfigured,
  nvidiaBaseUrl,
  nvidiaCodeModel,
  nvidiaTextModel,
} from "@/lib/ai/nvidia";

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
  });
}
