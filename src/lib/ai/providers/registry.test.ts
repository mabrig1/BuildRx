import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getProvider,
  isValidProviderId,
  listConfiguredProviders,
  listProviders,
  PROVIDER_IDS,
} from "@/lib/ai/providers/registry";

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "DEEPSEEK_API_KEY",
  "XAI_API_KEY",
  "NVIDIA_API_KEY",
] as const;

describe("provider registry", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("lists every provider exactly once, in a stable order", () => {
    expect(listProviders().map((p) => p.id)).toEqual(PROVIDER_IDS);
    expect(new Set(PROVIDER_IDS).size).toBe(PROVIDER_IDS.length);
  });

  it("reports every provider unconfigured when no keys are set", () => {
    expect(listConfiguredProviders()).toEqual([]);
  });

  it("reports a provider configured once its key is set", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(getProvider("openai").isConfigured()).toBe(true);
    expect(listConfiguredProviders().map((p) => p.id)).toContain("openai");
  });

  it("treats a whitespace-only key as not configured", () => {
    process.env.OPENAI_API_KEY = "   ";
    expect(getProvider("openai").isConfigured()).toBe(false);
  });

  it("validates provider ids", () => {
    expect(isValidProviderId("openai")).toBe(true);
    expect(isValidProviderId("not-a-provider")).toBe(false);
  });

  it("every provider exposes at least one model with a non-empty default", () => {
    for (const provider of listProviders()) {
      expect(provider.models().length).toBeGreaterThan(0);
      expect(provider.defaultModel().length).toBeGreaterThan(0);
    }
  });
});
