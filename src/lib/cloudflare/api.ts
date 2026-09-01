import {
  cloudflareApiToken,
  isCloudflareApiConfigured,
} from "@/lib/cloudflare/config";

const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";

/** Read-only token verification used by the deployment health agent. */
export async function verifyCloudflareApiToken(): Promise<void> {
  if (!isCloudflareApiConfigured()) {
    throw new Error("Cloudflare API is not configured.");
  }
  const response = await fetch(`${CLOUDFLARE_API}/user/tokens/verify`, {
    headers: { Authorization: `Bearer ${cloudflareApiToken()}` },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(`Cloudflare token verification returned ${response.status}.`);
  }
}
