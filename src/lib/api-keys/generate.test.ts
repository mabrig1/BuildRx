import { describe, expect, it } from "vitest";

import {
  API_KEY_PREFIX,
  generateApiKeySecret,
  hashApiKeySecret,
  looksLikeApiKey,
  visibleKeyPrefix,
} from "@/lib/api-keys/generate";

describe("generateApiKeySecret", () => {
  it("starts with the API key prefix", () => {
    expect(generateApiKeySecret().startsWith(API_KEY_PREFIX)).toBe(true);
  });

  it("generates a different secret each time", () => {
    expect(generateApiKeySecret()).not.toBe(generateApiKeySecret());
  });

  it("is long enough to be a real secret, not just the prefix", () => {
    expect(generateApiKeySecret().length).toBeGreaterThan(API_KEY_PREFIX.length + 30);
  });
});

describe("hashApiKeySecret", () => {
  it("is deterministic for the same input", () => {
    const secret = generateApiKeySecret();
    expect(hashApiKeySecret(secret)).toBe(hashApiKeySecret(secret));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashApiKeySecret("a")).not.toBe(hashApiKeySecret("b"));
  });

  it("returns a 64-character hex digest (SHA-256)", () => {
    expect(hashApiKeySecret("test")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("visibleKeyPrefix", () => {
  it("shows the prefix plus a few characters, not the full secret", () => {
    const secret = generateApiKeySecret();
    const prefix = visibleKeyPrefix(secret);
    expect(secret.startsWith(prefix)).toBe(true);
    expect(prefix.length).toBeLessThan(secret.length);
    expect(prefix.length).toBe(API_KEY_PREFIX.length + 6);
  });
});

describe("looksLikeApiKey", () => {
  it("accepts a real generated secret", () => {
    expect(looksLikeApiKey(generateApiKeySecret())).toBe(true);
  });

  it("rejects strings without the prefix", () => {
    expect(looksLikeApiKey("sk-something-else")).toBe(false);
  });

  it("rejects a bare prefix with no meaningful secret", () => {
    expect(looksLikeApiKey(API_KEY_PREFIX)).toBe(false);
  });
});
