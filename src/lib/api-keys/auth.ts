/**
 * Authenticates a request against the /api/v1/* public API using an
 * `Authorization: Bearer <key>` header instead of a Supabase session
 * cookie. Uses the service-role client since the caller has no
 * session — the key hash lookup itself is the authorization check.
 */

import { hashApiKeySecret, looksLikeApiKey } from "@/lib/api-keys/generate";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface ApiKeyIdentity {
  userId: string;
  keyId: string;
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

/** Returns the authenticated identity, or null if the key is missing/malformed/unknown/revoked. */
export async function authenticateApiKey(request: Request): Promise<ApiKeyIdentity | null> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const token = extractBearerToken(request);
  if (!token || !looksLikeApiKey(token)) return null;

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data } = await admin
    .from("api_keys")
    .select("id, owner_id, revoked_at")
    .eq("key_hash", hashApiKeySecret(token))
    .maybeSingle();
  if (!data || data.revoked_at) return null;

  // Best-effort — a failed timestamp bump shouldn't block the request it's authenticating.
  admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(undefined, () => undefined);

  return { userId: data.owner_id, keyId: data.id };
}
