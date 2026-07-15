export type {
  ChatRole,
  DeploymentStatus,
  GenerationStatus,
  PlanId,
  ProjectStatus,
  SubscriptionStatus,
  UsageAction,
  UserRole,
} from "@/types/database";

import type {
  ChatRole,
  DeploymentStatus,
  GenerationStatus,
  PlanId,
  ProjectStatus,
  SubscriptionStatus,
  UsageAction,
  UserRole,
} from "@/types/database";

/** Camel-cased domain models used by the UI and stores. */

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
  plan: PlanId;
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  thumbnailUrl: string | null;
  prompt: string;
  isFeatured: boolean;
  isActive: boolean;
}

export interface Project {
  id: string;
  ownerId: string;
  templateId: string | null;
  name: string;
  slug: string | null;
  description: string | null;
  status: ProjectStatus;
  isPublic: boolean;
  previewUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  path: string;
  content: string;
  language: string | null;
  version: number;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  projectId: string;
  userId: string | null;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface AiGeneration {
  id: string;
  projectId: string;
  messageId: string | null;
  userId: string | null;
  model: string;
  status: GenerationStatus;
  promptTokens: number;
  completionTokens: number;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Deployment {
  id: string;
  projectId: string;
  triggeredBy: string | null;
  status: DeploymentStatus;
  url: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface UsageLog {
  id: string;
  userId: string;
  projectId: string | null;
  action: UsageAction;
  quantity: number;
  createdAt: string;
}

export interface AnalyticsEvent {
  id: string;
  userId: string | null;
  projectId: string | null;
  eventType: string;
  properties: Record<string, unknown>;
  sessionId: string | null;
  createdAt: string;
}
