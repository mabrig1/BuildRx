import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { Output, ToolLoopAgent, isStepCount, tool } from "ai";
import { z } from "zod";

import {
  canCallModel,
  degradedEvent,
  diagnoseModelFailure,
  outOfTimeNote,
  pause,
  stepBudgetMs,
} from "@/lib/agents/llm";
import { writeFile } from "@/lib/agents/tools";
import type {
  Agent,
  AppPlan,
  FounderOpsSpec,
  GeneratedFile,
} from "@/lib/agents/types";
import {
  nvidiaApiKey,
  nvidiaBaseUrl,
  nvidiaGlmModel,
} from "@/lib/ai/nvidia";
import {
  openrouterApiKey,
  openrouterBaseUrl,
  openrouterStrongModel,
} from "@/lib/ai/openrouter";

const providerSchema = z.enum([
  "vercel",
  "cloudflare",
  "mongodb",
  "supabase",
  "other",
]);

const founderOpsSchema = z.object({
  primaryUser: z.string().min(2).max(160),
  smallestValuableOutcome: z.string().min(8).max(500),
  acceptanceCriteria: z.array(z.string().min(4).max(300)).min(3).max(12),
  excludedScope: z.array(z.string().min(3).max(300)).max(10),
  dataClassification: z
    .array(
      z.object({
        category: z.enum(["public", "internal", "confidential", "regulated"]),
        examples: z.array(z.string().min(2).max(160)).min(1).max(8),
        controls: z.array(z.string().min(4).max(240)).min(1).max(8),
      })
    )
    .min(1)
    .max(4),
  infrastructure: z
    .array(
      z.object({
        provider: providerSchema,
        responsibility: z.string().min(5).max(300),
        reason: z.string().min(5).max(300),
        required: z.boolean(),
      })
    )
    .min(2)
    .max(8),
  riskGates: z.array(z.string().min(4).max(300)).min(3).max(12),
  productionEvidence: z.array(z.string().min(4).max(300)).min(3).max(12),
  costControls: z.array(z.string().min(4).max(300)).min(2).max(10),
  humanApprovals: z.array(z.string().min(4).max(300)).min(2).max(10),
});

type ProviderName = z.infer<typeof providerSchema>;

/** Read-only tool: it proposes boundaries; it never provisions or mutates infrastructure. */
const assessInfrastructure = tool({
  description:
    "Assess which requested providers have a distinct production responsibility and flag duplicated responsibility.",
  inputSchema: z.object({
    requestedProviders: z.array(providerSchema).min(1),
    needsAuth: z.boolean(),
    needsRelationalData: z.boolean(),
    needsFlexibleJobState: z.boolean(),
    needsPublicEdgeOrObjectStorage: z.boolean(),
  }),
  execute: async (input) => {
    const recommended = new Set<ProviderName>(["vercel"]);
    if (input.needsAuth || input.needsRelationalData) recommended.add("supabase");
    if (input.needsFlexibleJobState) recommended.add("mongodb");
    if (input.needsPublicEdgeOrObjectStorage) recommended.add("cloudflare");
    return {
      recommended: [...recommended],
      requestedButUnjustified: input.requestedProviders.filter(
        (provider) => provider !== "other" && !recommended.has(provider)
      ),
      rule:
        "Share infrastructure patterns, never failure domains: each provider must own one bounded responsibility and no secret may reach client code.",
    };
  },
});

function founderModel() {
  const openrouterKey = openrouterApiKey();
  if (openrouterKey) {
    return createOpenAICompatible({
      name: "openrouter",
      baseURL: openrouterBaseUrl(),
      apiKey: openrouterKey,
      supportsStructuredOutputs: true,
    })(openrouterStrongModel());
  }

  const nvidiaKey = nvidiaApiKey();
  if (nvidiaKey) {
    return createOpenAICompatible({
      name: "nvidia",
      baseURL: nvidiaBaseUrl(),
      apiKey: nvidiaKey,
      supportsStructuredOutputs: true,
    })(nvidiaGlmModel());
  }

  return null;
}

function containsAny(value: string, terms: string[]): boolean {
  const normalized = value.toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

/** A complete, conservative operating spec even when no model is reachable. */
export function fallbackFounderOps(plan: AppPlan, prompt: string): FounderOpsSpec {
  const source = `${prompt}\n${plan.summary}\n${plan.features.join(" ")}`;
  const needsUploads = containsAny(source, [
    "upload",
    "file",
    "image",
    "video",
    "document",
    "asset",
  ]);
  const needsFlexibleJobState = containsAny(source, [
    "agent",
    "builder",
    "workflow",
    "pipeline",
    "job",
    "generation",
  ]);
  const primaryUser = plan.userRoles?.[0]?.name ?? "Authenticated product user";
  const planCriteria = plan.acceptanceCriteria ?? [];

  return {
    primaryUser,
    smallestValuableOutcome:
      plan.workflows?.[0]?.outcome ??
      `${primaryUser} can complete ${plan.features[0] ?? "the primary workflow"} and retrieve the saved result.`,
    acceptanceCriteria: [
      ...planCriteria.slice(0, 7),
      "A clean deployment can complete the primary workflow with persisted data.",
      "Failure states identify the failing subsystem and a safe recovery action.",
      "No credential or service-role token appears in browser code, generated output, or logs.",
    ].slice(0, 10),
    excludedScope: [
      "Unrequested integrations and speculative platform features",
      "Automatic production deployment or destructive migration without approval",
      "Duplicating the same source of truth across MongoDB and Supabase",
    ],
    dataClassification: [
      {
        category: "confidential",
        examples: ["account data", "project content", "generated application files"],
        controls: [
          "Authenticated access with least privilege",
          "Row-level ownership enforcement",
          "Redaction from model prompts and operational logs",
        ],
      },
      {
        category: "regulated",
        examples: ["provider credentials and service-role tokens"],
        controls: [
          "Server-only environment variables",
          "Rotation after suspected exposure",
          "Never copy secret values into generated projects",
        ],
      },
    ],
    infrastructure: [
      {
        provider: "vercel",
        responsibility: "Host the Next.js control plane, previews, and server functions",
        reason: "BuildRx is a Next.js application and needs preview deployment evidence",
        required: true,
      },
      {
        provider: "supabase",
        responsibility: "Own authentication, relational product records, authorization, and RLS",
        reason: "Identity and relational integrity need one auditable source of truth",
        required: true,
      },
      {
        provider: "mongodb",
        responsibility: "Store flexible, nested agent-run and build-job state only",
        reason: needsFlexibleJobState
          ? "Long-lived build workflows benefit from document-shaped state"
          : "Not justified until a document-shaped workflow state is introduced",
        required: needsFlexibleJobState,
      },
      {
        provider: "cloudflare",
        responsibility: needsUploads
          ? "Own DNS, edge protection, and generated binary artifacts in R2"
          : "Own DNS and edge protection; add R2 only when binary artifacts exist",
        reason: needsUploads
          ? "Uploaded and generated binary artifacts need bounded object storage"
          : "Edge protection is useful, but a second application runtime is not required",
        required: needsUploads,
      },
    ],
    riskGates: [
      "Run typecheck, tests, lint, build, and the generated-app smoke checks",
      "Scan generated and platform files for credentials before persistence or deployment",
      "Validate every model response against a bounded schema and file-write allowlist",
      "Confirm Supabase RLS and MongoDB tenant filters prevent cross-project access",
      "Record the deployed revision, migration state, health result, and rollback target",
    ],
    productionEvidence: [
      "Primary workflow smoke test with a saved and reloaded result",
      "Preview URL and immutable source revision",
      "Database migration and authorization verification",
      "AI request trace with model, latency, token usage, cost, and redaction status",
      "Rollback procedure tested against the previous known-good release",
    ],
    costControls: [
      "Per-run token and step limits with explicit timeouts",
      "Persist model, token usage, duration, status, and estimated cost for every generation",
      "Use retries only for classified transient errors and cap every retry loop",
    ],
    humanApprovals: [
      "Approve production deployment after reviewing the diff and evidence pack",
      "Approve schema migrations, credential changes, billing changes, and destructive actions",
    ],
  };
}

function normalizedSpec(
  value: FounderOpsSpec,
  fallback: FounderOpsSpec
): FounderOpsSpec {
  const byProvider = new Map(
    value.infrastructure.map((item) => [item.provider, item])
  );
  // Vercel and Supabase are current platform dependencies, so a model
  // cannot accidentally erase them from the operating contract.
  for (const item of fallback.infrastructure.filter(
    (candidate) => candidate.provider === "vercel" || candidate.provider === "supabase"
  )) {
    if (!byProvider.has(item.provider)) byProvider.set(item.provider, item);
  }
  return {
    ...value,
    infrastructure: [...byProvider.values()],
    acceptanceCriteria: [...new Set(value.acceptanceCriteria)].slice(0, 12),
    riskGates: [...new Set(value.riskGates)].slice(0, 12),
    productionEvidence: [...new Set(value.productionEvidence)].slice(0, 12),
  };
}

const bulletList = (items: string[]) => items.map((item) => `- ${item}`).join("\n");
const checklist = (items: string[]) => items.map((item) => `- [ ] ${item}`).join("\n");

/** Evidence travels with the generated repository instead of living only in chat. */
export function buildFounderOpsFiles(
  spec: FounderOpsSpec,
  plan: AppPlan
): GeneratedFile[] {
  const required = spec.infrastructure.filter((item) => item.required);
  const boundaries = spec.infrastructure
    .map(
      (item) =>
        `| ${item.provider} | ${item.required ? "Required" : "Deferred"} | ${item.responsibility} | ${item.reason} |`
    )
    .join("\n");
  const data = spec.dataClassification
    .map(
      (item) =>
        `### ${item.category}\n\nExamples:\n${bulletList(item.examples)}\n\nControls:\n${bulletList(item.controls)}`
    )
    .join("\n\n");

  return [
    {
      path: "docs/PRODUCT-BRIEF.md",
      content: `# Product Brief: ${plan.appName}\n\n## Primary user\n\n${spec.primaryUser}\n\n## Smallest valuable outcome\n\n${spec.smallestValuableOutcome}\n\n## Acceptance criteria\n\n${checklist(spec.acceptanceCriteria)}\n\n## Explicitly excluded\n\n${bulletList(spec.excludedScope)}\n`,
    },
    {
      path: "docs/ARCHITECTURE-DECISION.md",
      content: `# Architecture Decision: Provider Boundaries\n\n## Decision\n\nUse ${required.map((item) => item.provider).join(", ")} with one bounded responsibility per provider. Share infrastructure patterns, not failure domains. Supabase remains the authority for identity and relational permissions; MongoDB must not duplicate those records.\n\n| Provider | Status | Responsibility | Reason |\n| --- | --- | --- | --- |\n${boundaries}\n\n## Data classification\n\n${data}\n\n## Consequences\n\n- Secrets remain server-side and are referenced by variable name only.\n- Every cross-provider write needs an idempotency key and an observable failure state.\n- Removing a provider must not corrupt the source of truth owned by another provider.\n`,
    },
    {
      path: "docs/RELEASE-CHECKLIST.md",
      content: `# Release Checklist\n\n## Risk gates\n\n${checklist(spec.riskGates)}\n\n## Production evidence\n\n${checklist(spec.productionEvidence)}\n\n## Human approval\n\n${checklist(spec.humanApprovals)}\n`,
    },
    {
      path: "docs/OPERATIONS-RUNBOOK.md",
      content: `# Operations Runbook\n\n## Health order\n\n1. Verify the deployed revision and environment-variable names.\n2. Probe the configured AI provider, then Supabase, MongoDB, and Cloudflare independently.\n3. Inspect structured logs using the build request ID; never paste credentials into an incident.\n4. Roll back to the last verified revision when the primary workflow fails.\n\n## AI request envelope\n\n- Server-side model calls only\n- Schema-validated output and bounded tool access\n- Token, step, timeout, and retry caps\n- Prompt and log redaction\n- Human approval before production-side effects\n\n## Cost controls\n\n${bulletList(spec.costControls)}\n\n## Recovery evidence\n\n${checklist([
        "Last known-good revision is recorded",
        "Database recovery path is documented and tested",
        "Provider status and request IDs are captured without secrets",
        "Post-rollback smoke test completes the smallest valuable outcome",
      ])}\n`,
    },
  ];
}

export const founderOpsAgent: Agent = {
  name: "founder_ops",
  async run(context, emit) {
    emit({
      type: "agent_start",
      agent: "founder_ops",
      message: "Defining the production boundary and evidence gates…",
    });

    const plan = context.plan!;
    const fallback = fallbackFounderOps(plan, context.prompt);
    let spec = fallback;
    let source: "agent" | "deterministic" = "deterministic";
    const model = founderModel();

    if (model && canCallModel(context)) {
      try {
        const agent = new ToolLoopAgent({
          model,
          instructions: [
            "You are the FounderOps Agent for an application builder.",
            "Turn a product plan into the smallest production-worthy operating contract before code is generated.",
            "Use assessInfrastructure exactly once before producing the final object.",
            "Each provider owns one bounded responsibility. Supabase owns auth and relational authorization. MongoDB is allowed only for document-shaped build/job state. Cloudflare is DNS/edge/R2, not a duplicate app runtime. Vercel hosts the Next.js control plane and previews.",
            "Never request, repeat, infer, or output secret values. Name environment variables only.",
            "Require human approval for deployment, migrations, credential or billing changes, and destructive actions.",
            "A verified user outcome is the unit of value; generated code alone is not evidence.",
          ].join(" "),
          tools: { assessInfrastructure },
          output: Output.object({ schema: founderOpsSchema }),
          stopWhen: isStepCount(3),
          maxOutputTokens: 4_000,
          temperature: 0.1,
          prepareStep: ({ stepNumber }) =>
            stepNumber === 0
              ? {
                  activeTools: ["assessInfrastructure"],
                  toolChoice: { type: "tool", toolName: "assessInfrastructure" },
                }
              : { activeTools: [], toolChoice: "none" },
        });
        const result = await agent.generate({
          prompt: `Original request:\n${context.prompt}\n\nApproved product plan:\n${JSON.stringify(plan, null, 2)}`,
          timeout: {
            totalMs: stepBudgetMs(context),
            stepMs: stepBudgetMs(context),
          },
        });
        spec = normalizedSpec(result.output, fallback);
        source = "agent";
      } catch (error) {
        emit(
          degradedEvent(
            "founder_ops",
            "The FounderOps model pass failed; BuildRx used the deterministic production contract instead.",
            diagnoseModelFailure(error)
          )
        );
      }
    } else {
      const note = outOfTimeNote(context);
      emit({
        type: "agent_log",
        agent: "founder_ops",
        message: `Using the deterministic production contract${note ? ` (${note})` : ""}.`,
      });
    }

    context.founderOps = spec;
    context.founderOpsSource = source;
    const evidenceFiles = buildFounderOpsFiles(spec, plan);
    for (const file of evidenceFiles) {
      writeFile(context, file.path, file.content);
      emit({ type: "file", agent: "founder_ops", path: file.path });
    }

    await pause(100);
    emit({
      type: "agent_complete",
      agent: "founder_ops",
      message: `Production contract ready (${source}); ${evidenceFiles.length} evidence files added.`,
    });
  },
};
