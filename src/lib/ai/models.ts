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
  listAvailableModels,
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

/**
 * Preferred models per role, best-that-actually-answers first.
 *
 * These are candidates, not commitments: at call time the list is
 * filtered against the models this deployment's key can actually call
 * (see `resolveModelForRole`), so an id that is retired, renamed, or
 * simply not available on this account is skipped rather than 404ing.
 *
 * Ordering rationale — and it is not "biggest first", which is what this
 * used to be. On the free NVIDIA tier the very large models do not
 * return inside a pipeline step's slice at all. One build made the
 * pattern unambiguous:
 *
 *   planner  (deep-reasoning) -> gpt-oss-120b   (120B)  no response in 39s
 *   coding   (primary-coding) -> qwen3-next-80b ( 80B)  no response
 *   ui       (codegen)        -> qwen2.5-coder  ( 32B)  succeeded
 *   database (codegen)        -> qwen2.5-coder  ( 32B)  succeeded
 *
 * Leading with a model that cannot answer is worse than merely slow:
 * `completeText` breaks its fallback chain on a timeout (a slow endpoint
 * will not be faster for the next model on it), so the giant model at
 * the front of the list stopped the working 32B one behind it from ever
 * being tried. The mid-size models lead now, and the large ones stay as
 * later rungs for deployments whose tier can actually serve them.
 */
export const MODEL_CANDIDATES: Record<ModelRole, readonly string[]> = {
  "deep-reasoning": [
    "openai/gpt-oss-20b",
    "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    "mistralai/ministral-14b-instruct-2512",
    "openai/gpt-oss-120b",
    "qwen/qwen3-next-80b-a3b-instruct",
    "z-ai/glm-5.2",
  ],
  "primary-coding": [
    "qwen/qwen2.5-coder-32b-instruct",
    "openai/gpt-oss-20b",
    "poolside/laguna-xs-2.1",
    "nvidia/llama-3.3-nemotron-super-49b-v1.5",
    "qwen/qwen3-next-80b-a3b-instruct",
    "openai/gpt-oss-120b",
  ],
  codegen: [
    "qwen/qwen2.5-coder-32b-instruct",
    "mistralai/ministral-14b-instruct-2512",
    "openai/gpt-oss-20b",
    "poolside/laguna-xs-2.1",
    "qwen/qwen3-next-80b-a3b-instruct",
  ],
  diagnostics: [
    "openai/gpt-oss-20b",
    "mistralai/ministral-14b-instruct-2512",
    "meta/llama-3.1-8b-instruct",
    "stepfun-ai/step-3.7-flash",
  ],
  light: [
    "mistralai/ministral-14b-instruct-2512",
    "openai/gpt-oss-20b",
    "meta/llama-3.1-8b-instruct",
    "stepfun-ai/step-3.7-flash",
  ],
};

/** General-purpose models for the chain's second tier, strongest first. */
const GENERAL_CANDIDATES: readonly string[] = [
  "mistralai/ministral-14b-instruct-2512",
  "openai/gpt-oss-20b",
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  "stepfun-ai/step-3.7-flash",
];

/**
 * Small models that reliably start answering quickly, strongest first.
 *
 * The candidate ladders above rank by capability, which is the right
 * answer only when there is time to collect it. On a free inference tier
 * a 120B reasoning model can spend a step's entire slice before its
 * first token — the planner had 39 seconds, asked gpt-oss-120b, and got
 * "no response within 39s" from every tier it tried. A weaker model that
 * answers is worth more than a stronger one that doesn't: the fallback
 * when a step times out is not a lesser model, it is a built-in
 * template.
 */
const FAST_CANDIDATES: readonly string[] = [
  "openai/gpt-oss-20b",
  "mistralai/ministral-14b-instruct-2512",
  "meta/llama-3.1-8b-instruct",
  "stepfun-ai/step-3.7-flash",
];

/**
 * Below this, prefer a model that starts fast over one that reasons
 * well. Sized against observed time-to-first-token on the free NVIDIA
 * tier, where the large models routinely need most of a minute.
 */
const FAST_MODEL_BUDGET_MS = 60_000;

/**
 * The ladder to try for a role, given how long the step actually has.
 * Fast models lead when the slice is short; the capability ladder still
 * follows, so a short budget narrows the preference rather than
 * discarding the stronger options entirely.
 */
function candidatesFor(role: ModelRole, budgetMs?: number): readonly string[] {
  if (budgetMs === undefined || budgetMs >= FAST_MODEL_BUDGET_MS) {
    return MODEL_CANDIDATES[role];
  }
  return [
    ...FAST_CANDIDATES,
    ...MODEL_CANDIDATES[role].filter((id) => !FAST_CANDIDATES.includes(id)),
  ];
}

/**
 * The catalog is fetched once and reused: it changes on the scale of
 * weeks, a build makes a dozen model calls, and a lookup that cost a
 * round trip every time would eat budget the agents need. A failed
 * fetch caches nothing, so the next call retries.
 */
const CATALOG_TTL_MS = 10 * 60_000;
let catalogCache: { fetchedAt: number; ids: Set<string> } | null = null;
let catalogInFlight: Promise<Set<string> | null> | null = null;

async function availableModelIds(): Promise<Set<string> | null> {
  if (catalogCache && Date.now() - catalogCache.fetchedAt < CATALOG_TTL_MS) {
    return catalogCache.ids;
  }
  // Single-flight: ten agents starting at once must not each fetch it.
  catalogInFlight ??= (async () => {
    try {
      const ids = await listAvailableModels();
      if (ids.length === 0) return null;
      catalogCache = { fetchedAt: Date.now(), ids: new Set(ids) };
      return catalogCache.ids;
    } finally {
      catalogInFlight = null;
    }
  })();
  return catalogInFlight;
}

/**
 * The model this role should actually run on, resolved against the live
 * catalog.
 *
 * Precedence: a valid env override wins; otherwise the strongest
 * candidate this key can call; otherwise the built-in default. The
 * catalog being unreachable is not a failure — it just means the static
 * answer stands.
 */
export async function resolveModelForRole(
  role: ModelRole,
  budgetMs?: number
): Promise<string> {
  const fallback = modelForRole(role);
  // An explicit, valid override is a deliberate choice — never overrule it.
  const overrides: Record<ModelRole, string | undefined> = {
    "deep-reasoning": deepseekProModel(),
    "primary-coding": deepseekProModel(),
    codegen: mistralLargeModel(),
    diagnostics: deepseekFlashModel(),
    light: mistralMediumModel(),
  };
  if (overrides[role]) return overrides[role]!;

  const available = await availableModelIds();
  if (!available) return fallback;
  return (
    candidatesFor(role, budgetMs).find((id) => available.has(id)) ?? fallback
  );
}

/** Same resolution for the chain's general-purpose second tier. */
export async function resolveGeneralFallbackModel(
  budgetMs?: number
): Promise<string> {
  const override = kimiModel();
  if (override) return override;
  const available = await availableModelIds();
  if (!available) return generalFallbackModel();
  const ladder =
    budgetMs !== undefined && budgetMs < FAST_MODEL_BUDGET_MS
      ? [
          ...FAST_CANDIDATES,
          ...GENERAL_CANDIDATES.filter((id) => !FAST_CANDIDATES.includes(id)),
        ]
      : GENERAL_CANDIDATES;
  return ladder.find((id) => available.has(id)) ?? generalFallbackModel();
}

/** Which candidate each role resolves to right now, for diagnostics. */
export async function resolvedModelPlan(): Promise<Record<string, string>> {
  const [deepReasoning, primaryCoding, codegen, diagnostics, light, general] =
    await Promise.all([
      resolveModelForRole("deep-reasoning"),
      resolveModelForRole("primary-coding"),
      resolveModelForRole("codegen"),
      resolveModelForRole("diagnostics"),
      resolveModelForRole("light"),
      resolveGeneralFallbackModel(),
    ]);
  return { deepReasoning, primaryCoding, codegen, diagnostics, light, general };
}
