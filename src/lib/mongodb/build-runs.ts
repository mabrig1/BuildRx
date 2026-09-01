import { createHash } from "crypto";

import type { AgentName, WorkflowContext } from "@/lib/agents/types";
import { isMongoConfigured } from "@/lib/mongodb/config";
import { getMongoDatabase } from "@/lib/mongodb/client";

type BuildRunStatus = "running" | "completed" | "failed";

interface BuildRunDocument {
  _id: string;
  projectId: string;
  userId: string | null;
  promptHash: string;
  promptCharacters: number;
  status: BuildRunStatus;
  currentAgent: AgentName | null;
  generatedFileCount: number;
  founderOpsSource: "agent" | "deterministic" | null;
  requiredProviders: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  failureCode: string | null;
}

function runId(context: WorkflowContext): string | null {
  return context.requestId ?? null;
}

let retryAfter = 0;

async function safely(operation: () => Promise<void>): Promise<void> {
  if (!isMongoConfigured() || Date.now() < retryAfter) return;
  try {
    await operation();
    retryAfter = 0;
  } catch (error) {
    // MongoDB is durable orchestration telemetry, not the authority for
    // identity, files, or deployment. Its outage must remain isolated.
    console.warn(
      "[mongodb] build-run persistence unavailable:",
      error instanceof Error ? error.name : "unknown error"
    );
    // One unavailable optional provider must not consume three seconds
    // at every one of the eleven build steps.
    retryAfter = Date.now() + 30_000;
  }
}

export async function startBuildRun(context: WorkflowContext): Promise<void> {
  const id = runId(context);
  if (!id) return;
  await safely(async () => {
    const database = await getMongoDatabase();
    const now = new Date();
    const document: BuildRunDocument = {
      _id: id,
      projectId: context.projectId,
      userId: context.userId,
      promptHash: createHash("sha256").update(context.prompt).digest("hex"),
      promptCharacters: context.prompt.length,
      status: "running",
      currentAgent: null,
      generatedFileCount: 0,
      founderOpsSource: null,
      requiredProviders: [],
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      failureCode: null,
    };
    await database
      .collection<BuildRunDocument>("build_runs")
      .updateOne({ _id: id }, { $setOnInsert: document }, { upsert: true });
  });
}

export async function markBuildStep(
  context: WorkflowContext,
  agent: AgentName
): Promise<void> {
  const id = runId(context);
  if (!id) return;
  await safely(async () => {
    const database = await getMongoDatabase();
    await database.collection<BuildRunDocument>("build_runs").updateOne(
      { _id: id },
      {
        $set: {
          currentAgent: agent,
          generatedFileCount: context.files.size,
          founderOpsSource: context.founderOpsSource ?? null,
          requiredProviders:
            context.founderOps?.infrastructure
              .filter((provider) => provider.required)
              .map((provider) => provider.provider) ?? [],
          updatedAt: new Date(),
        },
      }
    );
  });
}

export async function finishBuildRun(
  context: WorkflowContext,
  status: Exclude<BuildRunStatus, "running">,
  failureCode: string | null = null
): Promise<void> {
  const id = runId(context);
  if (!id) return;
  await safely(async () => {
    const database = await getMongoDatabase();
    const now = new Date();
    await database.collection<BuildRunDocument>("build_runs").updateOne(
      { _id: id },
      {
        $set: {
          status,
          currentAgent: null,
          generatedFileCount: context.files.size,
          founderOpsSource: context.founderOpsSource ?? null,
          requiredProviders:
            context.founderOps?.infrastructure
              .filter((provider) => provider.required)
              .map((provider) => provider.provider) ?? [],
          updatedAt: now,
          completedAt: now,
          failureCode,
        },
      }
    );
  });
}
