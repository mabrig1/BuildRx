import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Workspace } from "@/components/chat/workspace";
import type {
  SidebarProject,
  SidebarTemplate,
} from "@/components/chat/workspace-sidebar";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage, ProjectStatus } from "@/types";

export const metadata: Metadata = {
  title: "Workspace",
};

const fallbackTemplates: SidebarTemplate[] = [
  {
    id: "landing-page",
    name: "Landing Page",
    prompt:
      "Build a modern landing page with a bold hero section, a three-column feature grid, social proof, and a call-to-action footer.",
  },
  {
    id: "saas-dashboard",
    name: "SaaS Dashboard",
    prompt:
      "Build a SaaS analytics dashboard with a sidebar, stat summary cards, a line chart of weekly activity, and a sortable data table.",
  },
  {
    id: "todo-app",
    name: "Task Tracker",
    prompt:
      "Build a task tracker where users can add tasks with due dates, group them into lists, mark them complete, and filter by status.",
  },
];

interface WorkspaceData {
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    previewUrl: string | null;
  };
  messages: ChatMessage[];
  projects: SidebarProject[];
  templates: SidebarTemplate[];
}

async function loadWorkspace(projectId: string): Promise<WorkspaceData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/projects/${projectId}`);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, status, preview_url")
    .eq("id", projectId)
    .single();

  if (!project) {
    notFound();
  }

  const [messagesRes, projectsRes, templatesRes] = await Promise.all([
    supabase
      .from("chat_messages")
      .select("id, project_id, user_id, role, content, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("projects")
      .select("id, name")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("templates")
      .select("id, name, prompt")
      .eq("is_active", true)
      .order("is_featured", { ascending: false })
      .limit(6),
  ]);

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      previewUrl: project.preview_url,
    },
    messages: (messagesRes.data ?? []).map((row) => ({
      id: row.id,
      projectId: row.project_id,
      userId: row.user_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    })),
    projects: projectsRes.data ?? [],
    templates:
      templatesRes.data && templatesRes.data.length > 0
        ? templatesRes.data
        : fallbackTemplates,
  };
}

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const data: WorkspaceData = isSupabaseConfigured()
    ? await loadWorkspace(projectId)
    : {
        // Demo mode before Supabase is connected.
        project: {
          id: projectId,
          name: "Demo Project",
          status: "draft",
          previewUrl: null,
        },
        messages: [],
        projects: [{ id: projectId, name: "Demo Project" }],
        templates: fallbackTemplates,
      };

  return (
    <Workspace
      project={data.project}
      initialMessages={data.messages}
      projects={data.projects}
      templates={data.templates}
    />
  );
}
