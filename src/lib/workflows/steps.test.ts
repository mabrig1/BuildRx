import { describe, expect, it } from "vitest";

import { isSafeWebhookUrl } from "@/lib/workflows/steps";

describe("isSafeWebhookUrl", () => {
  it("allows ordinary public https/http URLs", () => {
    expect(isSafeWebhookUrl("https://example.com/hook")).toBe(true);
    expect(isSafeWebhookUrl("http://api.example.com/webhook?x=1")).toBe(true);
  });

  it("rejects non-http(s) protocols", () => {
    expect(isSafeWebhookUrl("ftp://example.com")).toBe(false);
    expect(isSafeWebhookUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeWebhookUrl("javascript:alert(1)")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isSafeWebhookUrl("not a url")).toBe(false);
    expect(isSafeWebhookUrl("")).toBe(false);
  });

  it("rejects loopback and unspecified hosts", () => {
    expect(isSafeWebhookUrl("http://localhost/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://127.0.0.1/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://0.0.0.0/hook")).toBe(false);
  });

  it("rejects private network ranges", () => {
    expect(isSafeWebhookUrl("http://10.0.0.5/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://172.16.0.5/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://172.31.255.255/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://192.168.1.1/hook")).toBe(false);
    expect(isSafeWebhookUrl("http://169.254.169.254/hook")).toBe(false);
  });

  it("does not reject a public address that merely starts similarly to a private one", () => {
    expect(isSafeWebhookUrl("http://172.32.0.1/hook")).toBe(true);
    expect(isSafeWebhookUrl("http://192.168.example.com/hook")).toBe(false);
  });

  it("rejects .local hostnames", () => {
    expect(isSafeWebhookUrl("http://myserver.local/hook")).toBe(false);
  });
});
