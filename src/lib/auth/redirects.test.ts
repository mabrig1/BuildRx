import { describe, expect, it } from "vitest";

import { sanitizeNextPath } from "@/lib/auth/redirects";

const FALLBACK = "/dashboard";

describe("sanitizeNextPath", () => {
  describe("rejects off-origin redirect targets", () => {
    it.each([
      ["absolute https URL", "https://evil.example"],
      ["absolute http URL", "http://evil.example/path"],
      ["protocol-relative", "//evil.example"],
      ["protocol-relative with path", "//evil.example/dashboard"],
      ["backslash variant", "/\\evil.example"],
      ["backslash anywhere", "/dashboard\\..\\admin"],
      ["javascript scheme", "javascript:alert(1)"],
      ["data scheme", "data:text/html,<script>"],
      ["scheme-relative with credentials", "//user:pass@evil.example"],
      ["bare path without leading slash", "dashboard"],
    ])("%s", (_label, input) => {
      expect(sanitizeNextPath(input)).toBe(FALLBACK);
    });
  });

  describe("rejects empty input", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["empty string", ""],
    ])("%s", (_label, input) => {
      expect(sanitizeNextPath(input)).toBe(FALLBACK);
    });
  });

  describe("allows same-origin relative paths", () => {
    it.each([
      ["root", "/"],
      ["simple path", "/projects"],
      ["nested path", "/projects/abc-123/settings"],
      ["path with query", "/projects?filter=recent"],
      ["path with fragment", "/docs#installation"],
      ["path with encoded space", "/projects/my%20app"],
    ])("%s", (_label, input) => {
      expect(sanitizeNextPath(input)).toBe(input);
    });
  });

  /**
   * The guard runs on the already-decoded value. `%2f%2fevil` therefore
   * survives as a literal path segment rather than becoming `//evil` —
   * safe, but only because nothing decodes it again downstream. If a
   * caller ever adds a decode step before the redirect, these cases turn
   * into open redirects and this test is the tripwire.
   */
  describe("encoded traversal is treated as a literal path, not decoded", () => {
    it.each([
      ["encoded double slash", "/%2f%2fevil.example"],
      ["encoded backslash", "/%5cevil.example"],
    ])("%s", (_label, input) => {
      expect(sanitizeNextPath(input)).toBe(input);
    });
  });
});
