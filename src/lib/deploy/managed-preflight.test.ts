import { describe, expect, it } from "vitest";
import { evaluateManagedPreflight, operatorConfigurationPresent } from "./managed-preflight";

const source = [
  { path: "package.json", content: '{"dependencies":{"next":"15.5.20"}}' },
  { path: "src/app/page.tsx", content: "export default function Page() { return null; }" },
  { path: "src/app/layout.tsx", content: "export default function Layout() { return null; }" },
];
const check = (overrides: Partial<Parameters<typeof evaluateManagedPreflight>[0]> = {}) =>
  evaluateManagedPreflight({
    projectStatus: "ready", files: source, operatorConfigured: false, verification: null,
    ...overrides,
  });

describe("managed publish preflight", () => {
  it("never enables publishing, even with configuration and matching evidence", () => {
    const digest = check().sourceDigest!;
    const result = check({ operatorConfigured: true, verification: { sourceDigest: digest, passed: true } });
    expect(result.canPublish).toBe(false);
    expect(result.deployed).toBe(false);
    expect(result.blockers).toContain("managed_execution_unavailable");
    expect(result.blockers).toContain("operator_authorization_unverified");
    expect(result.blockers).toContain("quota_policy_unverified");
    expect(result).not.toHaveProperty("url");
  });
  it("hashes canonical order and changes the digest when content or path changes", () => {
    expect(check({ files: [...source].reverse() }).sourceDigest).toBe(check().sourceDigest);
    expect(check({ files: [...source, { path: "README.md", content: "one" }] }).sourceDigest)
      .not.toBe(check({ files: [...source, { path: "README.md", content: "two" }] }).sourceDigest);
    expect(check({ files: [...source, { path: "a.txt", content: "one" }] }).sourceDigest)
      .not.toBe(check({ files: [...source, { path: "b.txt", content: "one" }] }).sourceDigest);
  });
  it("does not treat ready status as source verification", () => {
    expect(check().blockers).toContain("source_verification_missing");
    expect(check({ projectStatus: "draft" }).blockers).toContain("project_not_ready");
    expect(check({ verification: { sourceDigest: "old", passed: true } }).blockers)
      .toContain("source_verification_stale");
    expect(check({ verification: { sourceDigest: check().sourceDigest!, passed: false } }).blockers)
      .toContain("source_verification_failed");
  });
  it("reuses exclusions and withholds digests for embedded credentials", () => {
    expect(check({ files: [...source, { path: ".env", content: "SECRET=value" }] }).sourceDigest)
      .toBe(check().sourceDigest);
    const result = check({ files: [...source, { path: "config.ts", content: "sk-" + "x".repeat(30) }] });
    expect(result.sourceDigest).toBeNull();
    expect(result.blockers).toContain("source_credentials_detected");
    expect(JSON.stringify(result)).not.toContain("sk-");
  });
  it("rejects duplicate paths, traversal, incomplete source and oversized source", () => {
    for (const files of [
      [...source, source[0]],
      [...source, { path: "../outside", content: "" }],
      source.slice(1),
      [...source, { path: "large.txt", content: "x".repeat(3_000_001) }],
      [...source, { path: "package.json/../bad", content: "" }],
    ]) {
      expect(check({ files }).sourceDigest).toBeNull();
      expect(check({ files }).blockers).toContain("source_invalid");
    }
  });
  it("withholds digest and blocks when DevShield reports suspicious or unscannable source", () => {
    const malicious = check({ files: [
      ...source,
      { path: "tool.ps1", content: "powershell.exe -EncodedCommand Zg==" },
    ] });
    expect(malicious.sourceDigest).toBeNull();
    expect(malicious.blockers).toContain("security_scan_failed");
    expect(malicious.canPublish).toBe(false);

    const incomplete = check({ files: [
      ...source,
      { path: "payload.exe", content: "untrusted executable" },
    ] });
    expect(incomplete.sourceDigest).toBeNull();
    expect(incomplete.blockers).toContain("security_scan_incomplete");
    expect(incomplete.canPublish).toBe(false);
  });
  it("only checks presence of explicitly named server settings", () => {
    expect(operatorConfigurationPresent({})).toBe(false);
    expect(operatorConfigurationPresent({
      BUILDRX_MANAGED_CF_ACCOUNT_ID: "a", BUILDRX_MANAGED_CF_BUILDS_TOKEN: "b",
      BUILDRX_MANAGED_CF_BUILD_TOKEN_UUID: "c", BUILDRX_MANAGED_SOURCE_TOKEN: " ",
    })).toBe(false);
  });
});
