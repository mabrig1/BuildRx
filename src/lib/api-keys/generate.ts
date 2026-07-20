/**
 * API key generation/hashing. The raw secret is only ever handed to
 * the caller at creation time — the database stores a SHA-256 hash
 * (for lookup) and a short visible prefix (so a user can tell keys
 * apart in a list without the full secret being retrievable again).
 */

import { createHash, randomBytes } from "crypto";

export const API_KEY_PREFIX = "brx_live_";
/** Characters of the prefix + random segment shown in the UI (never enough to reconstruct the key). */
const VISIBLE_CHARS = API_KEY_PREFIX.length + 6;

/** A fresh random secret in `brx_live_<43 base64url chars>` form. */
export function generateApiKeySecret(): string {
  return `${API_KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
}

/** Deterministic SHA-256 hex digest, used as the lookup key — never store or log the raw secret itself. */
export function hashApiKeySecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/** Short, safe-to-display prefix of a key, e.g. "brx_live_a1b2c3…". */
export function visibleKeyPrefix(secret: string): string {
  return secret.slice(0, VISIBLE_CHARS);
}

/** True if a string is shaped like one of our keys — a cheap pre-check before hitting the database. */
export function looksLikeApiKey(value: string): boolean {
  return value.startsWith(API_KEY_PREFIX) && value.length > API_KEY_PREFIX.length + 20;
}
