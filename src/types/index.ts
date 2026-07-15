export type UserRole = "user" | "admin";

export type PlanId = "free" | "pro" | "team";

export type ProjectStatus = "draft" | "generating" | "ready" | "error";

export type DeploymentStatus = "queued" | "building" | "live" | "failed";

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  plan: PlanId;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  projectId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface Deployment {
  id: string;
  projectId: string;
  status: DeploymentStatus;
  url: string | null;
  createdAt: string;
}
