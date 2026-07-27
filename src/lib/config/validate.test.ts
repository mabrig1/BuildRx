import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConfigCheck, ConfigReport } from "@/lib/config/validate";

/**
 * Both the model-id rejection cache and the once-per-process `announced`
 * flag are module-level, so each test gets its own module instance.
 */
async function freshModule() {
  vi.resetModules();
  return import("@/lib/config/validate");
}

const MODEL_VARS = [
  "NVIDIA_TEXT_MODEL",
  "NVIDIA_CODE_MODEL",
  "NVIDIA_CHAT_MODEL",
  "NVIDIA_GLM_MODEL",
  "NVIDIA_LLAMA_MODEL",
  "NVIDIA_MODEL_DEEPSEEK_PRO",
  "NVIDIA_MODEL_DEEPSEEK_FLASH",
  "NVIDIA_MODEL_MISTRAL_LARGE",
  "NVIDIA_MODEL_MISTRAL_MEDIUM",
  "NVIDIA_MODEL_KIMI",
];

const savedEnv = { ...process.env };

/** A fully-healthy deployment. */
function healthy() {
  process.env.NVIDIA_API_KEY = "nvapi-testkey";
  process.env.NVIDIA_API_BASE_URL = "https://integrate.api.nvidia.com/v1";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
}

const check = (report: ConfigReport, key: string): ConfigCheck =>
  report.checks.find((c) => c.key === key)!;

beforeEach(() => {
  for (const name of [
    ...MODEL_VARS,
    "NVIDIA_API_KEY",
    "NVIDIA_API_BASE_URL",
    "NVIDIA_BASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL",
    "VERCEL_URL",
    "ANTHROPIC_ENABLED",
    "ANTHROPIC_API_KEY",
  ]) {
    delete process.env[name];
  }
});

afterEach(() => {
  process.env = { ...savedEnv };
  vi.restoreAllMocks();
});

describe("validateConfiguration", () => {
  it("reports ok for a fully-configured deployment", async () => {
    const { validateConfiguration } = await freshModule();
    healthy();

    const report = validateConfiguration();

    expect(report.status).toBe("ok");
    expect(report.canGenerate).toBe(true);
    expect(report.checks.every((c) => c.status === "ok")).toBe(true);
  });

  describe("AI provider", () => {
    it("fails without an API key and cannot generate", async () => {
      const { validateConfiguration } = await freshModule();
      healthy();
      delete process.env.NVIDIA_API_KEY;

      const report = validateConfiguration();

      expect(report.status).toBe("fail");
      expect(report.canGenerate).toBe(false);
      expect(check(report, "NVIDIA_API_KEY").status).toBe("fail");
      expect(check(report, "NVIDIA_API_KEY").action).toMatch(/NVIDIA_API_KEY/);
    });

    it("fails when the endpoint is not https", async () => {
      const { validateConfiguration } = await freshModule();
      healthy();
      process.env.NVIDIA_API_BASE_URL = "http://insecure.example/v1";

      const report = validateConfiguration();

      expect(check(report, "NVIDIA_BASE_URL").status).toBe("fail");
      expect(report.canGenerate).toBe(false);
    });

    it("warns — but still generates — when a model variable is malformed", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { validateConfiguration } = await freshModule();
      healthy();
      process.env.NVIDIA_MODEL_KIMI = "not-a-model-id";

      const report = validateConfiguration();

      expect(report.status).toBe("warn");
      expect(report.canGenerate).toBe(true);
      expect(check(report, "model ids").status).toBe("warn");
    });

    it("names the offending variable without revealing its value", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { validateConfiguration } = await freshModule();
      healthy();
      const secret = "nvapi-akeypastedintothewrongbox123456";
      process.env.NVIDIA_MODEL_DEEPSEEK_PRO = secret;

      const detail = check(validateConfiguration(), "model ids").detail;

      expect(detail).toContain("NVIDIA_MODEL_DEEPSEEK_PRO");
      expect(detail).not.toContain(secret);
    });
  });

  describe("persistence", () => {
    it("warns about demo mode when Supabase is unconfigured", async () => {
      const { validateConfiguration } = await freshModule();
      healthy();
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;

      const report = validateConfiguration();

      expect(check(report, "Supabase").status).toBe("warn");
      expect(check(report, "Supabase").detail).toMatch(/Demo mode/);
      expect(report.status).toBe("warn");
    });

    it("accepts a publishable key in place of the legacy anon key", async () => {
      const { validateConfiguration } = await freshModule();
      healthy();
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

      expect(check(validateConfiguration(), "Supabase").status).toBe("ok");
    });

    it("warns when the service-role key is absent", async () => {
      const { validateConfiguration } = await freshModule();
      healthy();
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const report = validateConfiguration();

      expect(check(report, "SUPABASE_SERVICE_ROLE_KEY").status).toBe("warn");
      expect(check(report, "SUPABASE_SERVICE_ROLE_KEY").detail).toMatch(
        /billing\/usage writes are disabled/
      );
    });
  });

  describe("public URL", () => {
    it("accepts VERCEL_URL when NEXT_PUBLIC_APP_URL is unset", async () => {
      const { validateConfiguration } = await freshModule();
      healthy();
      delete process.env.NEXT_PUBLIC_APP_URL;
      process.env.VERCEL_URL = "app.vercel.app";

      expect(check(validateConfiguration(), "NEXT_PUBLIC_APP_URL").status).toBe(
        "ok"
      );
    });

    it("warns when neither is set", async () => {
      const { validateConfiguration } = await freshModule();
      healthy();
      delete process.env.NEXT_PUBLIC_APP_URL;

      expect(check(validateConfiguration(), "NEXT_PUBLIC_APP_URL").status).toBe(
        "warn"
      );
    });
  });

  describe("the paid Anthropic tier", () => {
    it("is ok when off", async () => {
      const { validateConfiguration } = await freshModule();
      healthy();

      const anthropic = check(validateConfiguration(), "ANTHROPIC_ENABLED");

      expect(anthropic.status).toBe("ok");
      expect(anthropic.detail).toMatch(/off/);
    });

    it.each(["true", "1", "TRUE", " true "])(
      "warns loudly when enabled with %j and a key present",
      async (value) => {
        const { validateConfiguration } = await freshModule();
        healthy();
        process.env.ANTHROPIC_ENABLED = value;
        process.env.ANTHROPIC_API_KEY = "sk-ant-test";

        const anthropic = check(validateConfiguration(), "ANTHROPIC_ENABLED");

        expect(anthropic.status).toBe("warn");
        expect(anthropic.detail).toMatch(/can incur charges/);
      }
    );

    it("stays off when the flag is set but no key is present", async () => {
      const { validateConfiguration } = await freshModule();
      healthy();
      process.env.ANTHROPIC_ENABLED = "true";

      expect(check(validateConfiguration(), "ANTHROPIC_ENABLED").status).toBe(
        "ok"
      );
    });

    it("stays off for a flag value that is not truthy", async () => {
      const { validateConfiguration } = await freshModule();
      healthy();
      process.env.ANTHROPIC_ENABLED = "yes";
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";

      expect(check(validateConfiguration(), "ANTHROPIC_ENABLED").status).toBe(
        "ok"
      );
    });
  });

  describe("severity rollup", () => {
    it("reports fail when any check fails, even alongside warnings", async () => {
      const { validateConfiguration } = await freshModule();
      // Nothing configured at all: a failing key plus several warnings.
      const report = validateConfiguration();

      expect(report.checks.some((c) => c.status === "fail")).toBe(true);
      expect(report.checks.some((c) => c.status === "warn")).toBe(true);
      expect(report.status).toBe("fail");
    });

    it("never returns a value in a check detail for a secret variable", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { validateConfiguration } = await freshModule();
      healthy();
      const serviceKey = "super-secret-service-role-key";
      process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;

      const serialised = JSON.stringify(validateConfiguration());

      expect(serialised).not.toContain(serviceKey);
      expect(serialised).not.toContain("nvapi-testkey");
    });
  });
});

describe("announceConfigurationOnce", () => {
  it("logs each non-ok check once per process", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { announceConfigurationOnce } = await freshModule();

    announceConfigurationOnce();
    const errorCalls = consoleError.mock.calls.length;
    const warnCalls = consoleWarn.mock.calls.length;

    announceConfigurationOnce();
    announceConfigurationOnce();

    expect(errorCalls).toBeGreaterThan(0);
    expect(warnCalls).toBeGreaterThan(0);
    expect(consoleError.mock.calls).toHaveLength(errorCalls);
    expect(consoleWarn.mock.calls).toHaveLength(warnCalls);
  });

  it("stays silent when everything is ok", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { announceConfigurationOnce } = await freshModule();
    healthy();

    announceConfigurationOnce();

    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("logs names and states, never values", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { announceConfigurationOnce } = await freshModule();
    healthy();
    process.env.NVIDIA_MODEL_KIMI = "nvapi-akeyinthewrongbox1234567";

    announceConfigurationOnce();

    const logged = [
      ...consoleError.mock.calls,
      ...consoleWarn.mock.calls,
    ]
      .flat()
      .join(" ");

    expect(logged).toContain("NVIDIA_MODEL_KIMI");
    expect(logged).not.toContain("nvapi-akeyinthewrongbox1234567");
  });
});
