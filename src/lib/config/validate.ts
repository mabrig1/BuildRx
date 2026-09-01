/**
 * Configuration validator.
 *
 * Answers "is this deployment actually able to do its job?" from env
 * alone — no network calls, safe to run on every request and at startup.
 * Reports variable NAMES and states only; a value is never returned or
 * logged, because the values here are exactly the sensitive ones (an
 * earlier incident put API keys into model-name variables, and the model
 * name was being echoed into logs).
 */
import { isNvidiaConfigured, nvidiaBaseUrl, rejectedModelVars } from "@/lib/ai/nvidia";
import {
  isOpenRouterConfigured,
  openrouterModel,
  openrouterStrongModel,
} from "@/lib/ai/openrouter";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isMongoConfigured } from "@/lib/mongodb/config";
import {
  isCloudflareApiConfigured,
  isCloudflareR2Configured,
} from "@/lib/cloudflare/config";

export type ConfigSeverity = "ok" | "warn" | "fail";

export interface ConfigCheck {
  key: string;
  status: ConfigSeverity;
  /** What this means, in a sentence a non-expert can act on. */
  detail: string;
  /** The concrete next action, when there is one. */
  action?: string;
}

export interface ConfigReport {
  status: ConfigSeverity;
  checks: ConfigCheck[];
  /** True when the build pipeline can produce real (non-mock) output. */
  canGenerate: boolean;
}

function has(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

export function validateConfiguration(): ConfigReport {
  const checks: ConfigCheck[] = [];

  // --- AI provider ---------------------------------------------------
  const openrouter = isOpenRouterConfigured();
  checks.push({
    key: "OPENROUTER_API_KEY",
    status: openrouter ? "ok" : "warn",
    detail: openrouter
      ? `OpenRouter is the primary provider (${openrouterStrongModel()} / ${openrouterModel()}).`
      : "No OpenRouter key — builds depend on the free NVIDIA tier, which may not answer within a step's time budget.",
    action: openrouter
      ? undefined
      : "Set OPENROUTER_API_KEY (openrouter.ai/keys) for reliable generation.",
  });

  const nvidiaKey = isNvidiaConfigured();
  checks.push({
    key: "NVIDIA_API_KEY",
    status: nvidiaKey ? "ok" : openrouter ? "warn" : "fail",
    detail: nvidiaKey
      ? "NVIDIA fallback key is present (server-side only)."
      : openrouter
        ? "No NVIDIA key — OpenRouter is serving every call, with no free fallback behind it."
        : "No AI provider key — every build falls back to mock output.",
    action: nvidiaKey ? undefined : "Set NVIDIA_API_KEY (free at build.nvidia.com).",
  });

  const baseUrl = nvidiaBaseUrl();
  const baseUrlOk = /^https:\/\//.test(baseUrl);
  checks.push({
    key: "NVIDIA_BASE_URL",
    status: baseUrlOk ? "ok" : "fail",
    detail: baseUrlOk
      ? `Inference endpoint: ${baseUrl}`
      : `Endpoint is not https: ${baseUrl}`,
    action: baseUrlOk ? undefined : "Use https://integrate.api.nvidia.com/v1",
  });

  const badModelVars = rejectedModelVars();
  checks.push({
    key: "model ids",
    status: badModelVars.length === 0 ? "ok" : "warn",
    detail:
      badModelVars.length === 0
        ? "All model variables are well-formed (or unset, using built-in defaults)."
        : `${badModelVars.length} model variable(s) are not valid model ids: ${badModelVars.join(", ")}`,
    action:
      badModelVars.length === 0
        ? undefined
        : "Delete these variables or set them to a vendor/model-name id from /api/ai/models.",
  });

  // --- persistence ---------------------------------------------------
  const supabase = isSupabaseConfigured();
  checks.push({
    key: "Supabase",
    status: supabase ? "ok" : "warn",
    detail: supabase
      ? "Auth and persistence are connected."
      : "Demo mode — projects, files and chat live in memory and reset.",
    action: supabase ? undefined : "Set NEXT_PUBLIC_SUPABASE_URL and a publishable/anon key.",
  });

  checks.push({
    key: "SUPABASE_SERVICE_ROLE_KEY",
    status: !supabase ? "warn" : has("SUPABASE_SERVICE_ROLE_KEY") ? "ok" : "warn",
    detail: has("SUPABASE_SERVICE_ROLE_KEY")
      ? "Service-role key present — billing and usage metering can write."
      : "No service-role key — billing/usage writes are disabled by design.",
  });

  const mongo = isMongoConfigured();
  checks.push({
    key: "MONGODB_URI",
    status: mongo ? "ok" : "warn",
    detail: mongo
      ? "MongoDB is configured for durable agent/build-run checkpoints."
      : "No durable agent-run store — builds still run, but cannot retain workflow checkpoints.",
    action: mongo
      ? undefined
      : "Set MONGODB_URI and optionally MONGODB_DATABASE; do not copy Supabase auth data into MongoDB.",
  });

  const cloudflareApi = isCloudflareApiConfigured();
  const cloudflareR2 = isCloudflareR2Configured();
  checks.push({
    key: "Cloudflare",
    status: cloudflareApi && cloudflareR2 ? "ok" : "warn",
    detail:
      cloudflareApi && cloudflareR2
        ? "Cloudflare API and R2 artifact storage are configured."
        : "Cloudflare edge/R2 is incomplete — generated ZIP artifacts are not backed up to R2.",
    action:
      cloudflareApi && cloudflareR2
        ? undefined
        : "Set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_R2_BUCKET, CLOUDFLARE_R2_ACCESS_KEY_ID, and CLOUDFLARE_R2_SECRET_ACCESS_KEY.",
  });

  // --- public URL (needed to verify a deployment from outside) -------
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.VERCEL_URL?.trim();
  checks.push({
    key: "NEXT_PUBLIC_APP_URL",
    status: appUrl ? "ok" : "warn",
    detail: appUrl
      ? "Public URL known — deployment self-verification can run."
      : "No public URL — the preview-renders check cannot be verified from outside.",
    action: appUrl ? undefined : "Set NEXT_PUBLIC_APP_URL to your production origin.",
  });

  // --- paid provider must not be silently enabled --------------------
  const anthropicOn =
    ["true", "1"].includes(process.env.ANTHROPIC_ENABLED?.trim().toLowerCase() ?? "") &&
    has("ANTHROPIC_API_KEY");
  checks.push({
    key: "ANTHROPIC_ENABLED",
    status: anthropicOn ? "warn" : "ok",
    detail: anthropicOn
      ? "The paid Anthropic tier is ENABLED and can incur charges."
      : "Paid Anthropic tier is off — NVIDIA only.",
  });

  const status: ConfigSeverity = checks.some((c) => c.status === "fail")
    ? "fail"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : "ok";

  // Either provider alone is enough to generate for real.
  return { status, checks, canGenerate: openrouter || (nvidiaKey && baseUrlOk) };
}

/**
 * Logged once per server instance so a misconfigured deployment
 * announces itself in the logs instead of silently producing mock
 * output. Names and states only — never values.
 */
let announced = false;
export function announceConfigurationOnce(): void {
  if (announced) return;
  announced = true;
  const report = validateConfiguration();
  if (report.status === "ok") return;
  for (const check of report.checks) {
    if (check.status === "ok") continue;
    const line = `[config:${check.status}] ${check.key} — ${check.detail}${check.action ? ` → ${check.action}` : ""}`;
    if (check.status === "fail") console.error(line);
    else console.warn(line);
  }
}
