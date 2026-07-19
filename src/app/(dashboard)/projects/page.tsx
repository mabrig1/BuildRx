import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ConnectSupabaseNotice } from "@/components/dashboard/connect-supabase-notice";
import { PageHeader } from "@/components/layout/page-header";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import type { ProjectSummary } from "@/components/projects/project-card";
import { ProjectsGrid } from "@/components/projects/projects-grid";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Projects",
};

async function loadProjects(): Promise<ProjectSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/projects");
  }

  const { data } = await supabase
    .from("projects")
    .select("id, name, description, status, preview_url, updated_at, team_id")
    .order("updated_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    previewUrl: row.preview_url,
    updatedAt: row.updated_at,
    teamId: row.team_id,
  }));
}

export default async function ProjectsPage() {
  const configured = isSupabaseConfigured();
  const projects = configured ? await loadProjects() : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Create, manage, and deploy your AI-built apps."
      >
        <CreateProjectDialog />
      </PageHeader>

      {!configured ? <ConnectSupabaseNotice /> : null}

      <ProjectsGrid projects={projects} />
    </div>
  );
}
