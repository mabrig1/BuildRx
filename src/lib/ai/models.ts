/**
 * Model routing by task complexity.
 *
 * Maps a task role to the NVIDIA model best suited to it, read from
 * server-side env vars (never exposed to the browser):
 *
 *   NVIDIA_MODEL_DEEPSEEK_PRO    — deep reasoning, architecture, primary coding
 *   NVIDIA_MODEL_DEEPSEEK_FLASH  — fast debugging and diagnostics
 *   NVIDIA_MODEL_MISTRAL_LARGE   — code generation and review
 *   NVIDIA_MODEL_MISTRAL_MEDIUM  — lightweight tasks
 *   NVIDIA_MODEL_KIMI            — general-purpose fallback tier
 *
 * Set each to the exact id from the NVIDIA NIM catalog
 * (https://build.nvidia.com). When one is unset, the role falls back to
 * the already-configured pipeline models (GLM / Laguna / Step) so a
 * deployment that has only NVIDIA_API_KEY keeps working unchanged —
 * routing is an upgrade, not a new requirement.
 */
import {
  nvidiaChatModel,
  nvidiaCodeModel,
  nvidiaGlmModel,
  validModelId,
} from "@/lib/ai/nvidia";

/** What kind of work a model call is doing. */
export type ModelRole =
  | "deep-reasoning" // planning, architecture, hard problems
  | "primary-coding" // main application code generation
  | "codegen" // code generation/review (UI, schema, repairs)
  | "diagnostics" // fast debugging, log analysis
  | "light"; // small classification/review tasks

/**
 * A routed model id, or undefined when the variable is unset *or*
 * malformed. Validation matters most here: these five variables were
 * found holding API keys in a live deployment, which turned every
 * routed call into a 404 for a model named "nvapi-…" while the pipeline
 * silently fell back to scaffolds.
 */
function env(name: string): string | undefined {
  return validModelId(process.env[name], name);
}

export function deepseekProModel(): string | undefined {
  return env("NVIDIA_MODEL_DEEPSEEK_PRO");
}
export function deepseekFlashModel(): string | undefined {
  return env("NVIDIA_MODEL_DEEPSEEK_FLASH");
}
export function mistralLargeModel(): string | undefined {
  return env("NVIDIA_MODEL_MISTRAL_LARGE");
}
export function mistralMediumModel(): string | undefined {
  return env("NVIDIA_MODEL_MISTRAL_MEDIUM");
}
export function kimiModel(): string | undefined {
  return env("NVIDIA_MODEL_KIMI");
}

/** The model a given role should run on. Always returns something usable. */
export function modelForRole(role: ModelRole): string {
  switch (role) {
    case "deep-reasoning":
      return deepseekProModel() ?? nvidiaGlmModel();
    case "primary-coding":
      return deepseekProModel() ?? nvidiaCodeModel();
    case "codegen":
      return mistralLargeModel() ?? nvidiaCodeModel();
    case "diagnostics":
      return deepseekFlashModel() ?? nvidiaChatModel();
    case "light":
      return mistralMediumModel() ?? nvidiaChatModel();
  }
}

/**
 * General-purpose fallback model for the chain's second tier — tried when
 * the role's primary model fails, before dropping to the lite tier.
 */
export function generalFallbackModel(): string {
  return kimiModel() ?? nvidiaChatModel();
}
