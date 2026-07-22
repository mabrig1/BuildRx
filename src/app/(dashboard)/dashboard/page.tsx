import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bot,
  CreditCard,
  FolderKanban,
  Rocket,
} from "lucide-react";

import { ConnectSupabaseNotice } from "@/components/dashboard/connect-supabase-notice";
import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import type { ProjectSummary } from "@/components/projects/project-card";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard",
};

interface DashboardData {
  greetingName: string | null;
  plan: string;
  projectCount: number;
  messagesThisMonth: number;
  deploymentCount: number;
  recentProjects: ProjectSummary[];
}

async function loadDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/dashboard");
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [recent, projectCount, messageCount, deploymentCount, userRow] =
    await Promise.all([
      // All stats are scoped to rows the user owns: RLS visibility also
      // spans public/team projects (and every row, for admins), which
      // would misstate the personal counts shown on the dashboard.
      supabase
        .from("projects")
        .select("id, name, description, status, preview_url, updated_at")
        .eq("owner_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(6),
      supabase
        .from("projects")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", user.id),
      supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("deployments")
        .select("*, projects!inner(owner_id)", { count: "exact", head: true })
        .eq("projects.owner_id", user.id),
      supabase.from("users").select("name, plan").eq("id", user.id).single(),
    ]);

  return {
    greetingName:
      userRow.data?.name?.split(" ")[0] ??
      (user.user_metadata.name as string | undefined)?.split(" ")[0] ??
      null,
    plan: userRow.data?.plan ?? "free",
    projectCount: projectCount.count ?? 0,
    messagesThisMonth: messageCount.count ?? 0,
    deploymentCount: deploymentCount.count ?? 0,
    recentProjects: (recent.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      previewUrl: row.preview_url,
      updatedAt: row.updated_at,
    })),
  };
}

export default async function DashboardPage() {
  const configured = isSupabaseConfigured();

  const data: DashboardData = configured
    ? await loadDashboardData()
    : {
        greetingName: null,
        plan: "free",
        projectCount: 0,
        messagesThisMonth: 0,
        deploymentCount: 0,
        recentProjects: [],
      };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title={
          data.greetingName ? `Welcome back, ${data.greetingName}` : "Dashboard"
        }
        description="An overview of your projects and activity."
      >
        <CreateProjectDialog />
      </PageHeader>

      {!configured ? <ConnectSupabaseNotice /> : null}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Projects"
          value={String(data.projectCount)}
          icon={FolderKanban}
        />
        <StatCard
          label="AI messages"
          value={String(data.messagesThisMonth)}
          hint="This month"
          icon={Bot}
        />
        <StatCard
          label="Deployments"
          value={String(data.deploymentCount)}
          icon={Rocket}
        />
        <StatCard
          label="Plan"
          value={data.plan.charAt(0).toUpperCase() + data.plan.slice(1)}
          hint="Manage in Billing"
          icon={CreditCard}
        />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">
            Recent projects
          </h2>
          {data.recentProjects.length > 0 ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/projects">
                View all
                <ArrowRight />
              </Link>
            </Button>
          ) : null}
        </div>
        <ProjectsGrid projects={data.recentProjects} />
      </section>
    </div>
  );
}
