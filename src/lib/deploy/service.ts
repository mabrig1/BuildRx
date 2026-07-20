import type { DeployProviderName } from "@/lib/deploy/providers";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export interface DeploymentRecord {
  id: string;
  provider: DeployProviderName | "app-creator";
  status: "queued" | "building" | "live" | "failed" | "canceled";
  url: string | null;
  domain: string | null;
  logs: string;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Token for a connected deploy provider (null when not connected). */
export async function getProviderToken(
  provider: DeployProviderName
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("access_token")
    .eq("provider", provider)
    .maybeSingle();
  return data?.access_token ?? null;
}

// ------------------------------------------------------------------
// Demo store (no Supabase): deployments kept in memory
// ------------------------------------------------------------------

interface DemoDeployState {
  deployments: Map<string, DeploymentRecord[]>;
  domains: Map<string, string>;
  tokens: Map<DeployProviderName, string>;
}

const globalDemo = globalThis as unknown as {
  __appCreatorDeploys?: DemoDeployState;
};

export function demoDeployState(): DemoDeployState {
  globalDemo.__appCreatorDeploys ??= {
    deployments: new Map(),
    domains: new Map(),
    tokens: new Map(),
  };
  return globalDemo.__appCreatorDeploys;
}

export function demoHistory(projectId: string): DeploymentRecord[] {
  return demoDeployState().deployments.get(projectId) ?? [];
}

export function demoAddDeployment(
  projectId: string,
  record: DeploymentRecord
): void {
  const state = demoDeployState();
  const list = state.deployments.get(projectId) ?? [];
  list.unshift(record);
  state.deployments.set(projectId, list.slice(0, 20));
}
