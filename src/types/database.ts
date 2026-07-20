/**
 * Supabase database types.
 *
 * Regenerate after schema changes with:
 *   npx supabase gen types typescript --project-id <project-ref> --schema public > src/types/database.ts
 *
 * The definitions below mirror the migrations in supabase/migrations/
 * and act as a hand-written stand-in until generated types are wired up.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "user" | "admin";
export type PlanId = "free" | "pro" | "team";
export type ProjectStatus =
  | "draft"
  | "generating"
  | "ready"
  | "error"
  | "archived";
export type DeploymentStatus =
  | "queued"
  | "building"
  | "live"
  | "failed"
  | "canceled";
export type ChatRole = "user" | "assistant" | "system";
export type GenerationStatus =
  | "pending"
  | "streaming"
  | "completed"
  | "failed";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete";
export type UsageAction =
  | "ai_message"
  | "ai_generation"
  | "deployment"
  | "preview"
  | "export";
export type AiProvider =
  | "nvidia"
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "grok";
export type AgentVisibility = "private" | "unlisted" | "public";
export type AgentMessageRole = "user" | "assistant" | "tool";
export type DocumentFileType = "pdf" | "docx" | "xlsx" | "image";
export type DocumentStatus = "processing" | "ready" | "failed";
export type ContentType =
  | "blog_post"
  | "ebook"
  | "social_post"
  | "email"
  | "ad_copy"
  | "video_script";
export type ContentStatus = "ready" | "failed";
export type KnowledgeDocumentStatus = "processing" | "ready" | "failed";
export type WorkflowTriggerType = "manual" | "webhook";
export type WorkflowStepType =
  | "ai_generate"
  | "agent_run"
  | "content_generate"
  | "kb_chat"
  | "webhook";
export type WorkflowRunStatus = "running" | "completed" | "failed";
export type WorkflowRunStepStatus = "completed" | "failed";
export type TeamMemberRole = "owner" | "admin" | "member";
export type TeamInviteRole = "admin" | "member";
export type TeamInviteStatus = "pending" | "accepted" | "revoked";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          role: UserRole;
          plan: PlanId;
          onboarded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          plan?: PlanId;
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          plan?: PlanId;
          onboarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      templates: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          category: string;
          thumbnail_url: string | null;
          prompt: string;
          is_featured: boolean;
          is_active: boolean;
          created_by: string | null;
          source_project_id: string | null;
          install_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          category?: string;
          thumbnail_url?: string | null;
          prompt: string;
          is_featured?: boolean;
          is_active?: boolean;
          created_by?: string | null;
          source_project_id?: string | null;
          install_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          category?: string;
          thumbnail_url?: string | null;
          prompt?: string;
          is_featured?: boolean;
          is_active?: boolean;
          created_by?: string | null;
          source_project_id?: string | null;
          install_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "templates_created_by_fkey";
            columns: ["created_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "templates_source_project_id_fkey";
            columns: ["source_project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      projects: {
        Row: {
          id: string;
          owner_id: string;
          template_id: string | null;
          name: string;
          slug: string | null;
          description: string | null;
          status: ProjectStatus;
          is_public: boolean;
          preview_url: string | null;
          github_repo: string | null;
          custom_domain: string | null;
          team_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          template_id?: string | null;
          name: string;
          slug?: string | null;
          description?: string | null;
          status?: ProjectStatus;
          is_public?: boolean;
          preview_url?: string | null;
          github_repo?: string | null;
          custom_domain?: string | null;
          team_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          template_id?: string | null;
          name?: string;
          slug?: string | null;
          description?: string | null;
          status?: ProjectStatus;
          is_public?: boolean;
          preview_url?: string | null;
          github_repo?: string | null;
          custom_domain?: string | null;
          team_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_template_id_fkey";
            columns: ["template_id"];
            referencedRelation: "templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "projects_team_id_fkey";
            columns: ["team_id"];
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      project_files: {
        Row: {
          id: string;
          project_id: string;
          path: string;
          content: string;
          language: string | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          path: string;
          content?: string;
          language?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          path?: string;
          content?: string;
          language?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          id: string;
          project_id: string;
          user_id: string | null;
          role: ChatRole;
          content: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id?: string | null;
          role: ChatRole;
          content: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string | null;
          role?: ChatRole;
          content?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_generations: {
        Row: {
          id: string;
          project_id: string;
          message_id: string | null;
          user_id: string | null;
          model: string;
          provider: AiProvider;
          status: GenerationStatus;
          prompt_tokens: number;
          completion_tokens: number;
          duration_ms: number | null;
          error: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          message_id?: string | null;
          user_id?: string | null;
          model: string;
          provider?: AiProvider;
          status?: GenerationStatus;
          prompt_tokens?: number;
          completion_tokens?: number;
          duration_ms?: number | null;
          error?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          message_id?: string | null;
          user_id?: string | null;
          model?: string;
          provider?: AiProvider;
          status?: GenerationStatus;
          prompt_tokens?: number;
          completion_tokens?: number;
          duration_ms?: number | null;
          error?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_generations_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_generations_message_id_fkey";
            columns: ["message_id"];
            referencedRelation: "chat_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_generations_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_ai_settings: {
        Row: {
          user_id: string;
          default_provider: AiProvider;
          default_model: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          default_provider?: AiProvider;
          default_model?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          default_provider?: AiProvider;
          default_model?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_ai_settings_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      model_comparisons: {
        Row: {
          id: string;
          user_id: string;
          prompt: string;
          results: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          prompt: string;
          results?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          prompt?: string;
          results?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "model_comparisons_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      agents: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          icon: string;
          system_prompt: string;
          provider: AiProvider;
          model: string;
          tools: Json;
          visibility: AgentVisibility;
          share_slug: string | null;
          forked_from: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          icon?: string;
          system_prompt?: string;
          provider?: AiProvider;
          model?: string;
          tools?: Json;
          visibility?: AgentVisibility;
          share_slug?: string | null;
          forked_from?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          icon?: string;
          system_prompt?: string;
          provider?: AiProvider;
          model?: string;
          tools?: Json;
          visibility?: AgentVisibility;
          share_slug?: string | null;
          forked_from?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agents_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agents_forked_from_fkey";
            columns: ["forked_from"];
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_knowledge_files: {
        Row: {
          id: string;
          agent_id: string;
          name: string;
          content: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          name: string;
          content: string;
          size_bytes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          name?: string;
          content?: string;
          size_bytes?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_knowledge_files_agent_id_fkey";
            columns: ["agent_id"];
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_memories: {
        Row: {
          id: string;
          agent_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          user_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          user_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_memories_agent_id_fkey";
            columns: ["agent_id"];
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_memories_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_conversations: {
        Row: {
          id: string;
          agent_id: string;
          user_id: string;
          title: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          agent_id: string;
          user_id: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          agent_id?: string;
          user_id?: string;
          title?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_conversations_agent_id_fkey";
            columns: ["agent_id"];
            referencedRelation: "agents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "agent_conversations_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      agent_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: AgentMessageRole;
          content: string;
          tool_calls: Json | null;
          tool_name: string | null;
          tool_call_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: AgentMessageRole;
          content?: string;
          tool_calls?: Json | null;
          tool_name?: string | null;
          tool_call_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: AgentMessageRole;
          content?: string;
          tool_calls?: Json | null;
          tool_name?: string | null;
          tool_call_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "agent_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            referencedRelation: "agent_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          file_type: DocumentFileType;
          size_bytes: number;
          status: DocumentStatus;
          extracted_text: string;
          tables: Json;
          summary: string | null;
          tables_markdown: string | null;
          report_markdown: string | null;
          warning: string | null;
          error: string | null;
          provider: AiProvider;
          model: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          file_type: DocumentFileType;
          size_bytes?: number;
          status?: DocumentStatus;
          extracted_text?: string;
          tables?: Json;
          summary?: string | null;
          tables_markdown?: string | null;
          report_markdown?: string | null;
          warning?: string | null;
          error?: string | null;
          provider?: AiProvider;
          model?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          file_type?: DocumentFileType;
          size_bytes?: number;
          status?: DocumentStatus;
          extracted_text?: string;
          tables?: Json;
          summary?: string | null;
          tables_markdown?: string | null;
          report_markdown?: string | null;
          warning?: string | null;
          error?: string | null;
          provider?: AiProvider;
          model?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      content_pieces: {
        Row: {
          id: string;
          owner_id: string;
          type: ContentType;
          title: string;
          inputs: Json;
          content: string;
          cover_image_data_url: string | null;
          status: ContentStatus;
          error: string | null;
          provider: AiProvider;
          model: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          type: ContentType;
          title: string;
          inputs?: Json;
          content?: string;
          cover_image_data_url?: string | null;
          status?: ContentStatus;
          error?: string | null;
          provider?: AiProvider;
          model?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          type?: ContentType;
          title?: string;
          inputs?: Json;
          content?: string;
          cover_image_data_url?: string | null;
          status?: ContentStatus;
          error?: string | null;
          provider?: AiProvider;
          model?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "content_pieces_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      prompt_library: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          category: string;
          prompt_text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          category?: string;
          prompt_text: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          title?: string;
          category?: string;
          prompt_text?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "prompt_library_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_bases: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_bases_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_documents: {
        Row: {
          id: string;
          knowledge_base_id: string;
          owner_id: string;
          name: string;
          file_type: string;
          size_bytes: number | null;
          status: KnowledgeDocumentStatus;
          chunk_count: number;
          warning: string | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          knowledge_base_id: string;
          owner_id: string;
          name: string;
          file_type: string;
          size_bytes?: number | null;
          status?: KnowledgeDocumentStatus;
          chunk_count?: number;
          warning?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          knowledge_base_id?: string;
          owner_id?: string;
          name?: string;
          file_type?: string;
          size_bytes?: number | null;
          status?: KnowledgeDocumentStatus;
          chunk_count?: number;
          warning?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_knowledge_base_id_fkey";
            columns: ["knowledge_base_id"];
            referencedRelation: "knowledge_bases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_documents_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      knowledge_chunks: {
        Row: {
          id: string;
          document_id: string;
          knowledge_base_id: string;
          owner_id: string;
          chunk_index: number;
          content: string;
          embedding: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          knowledge_base_id: string;
          owner_id: string;
          chunk_index: number;
          content: string;
          /** pgvector accepts either its "[0.1,0.2,...]" text form or a plain number array. */
          embedding?: string | number[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          document_id?: string;
          knowledge_base_id?: string;
          owner_id?: string;
          chunk_index?: number;
          content?: string;
          embedding?: string | number[] | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey";
            columns: ["document_id"];
            referencedRelation: "knowledge_documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "knowledge_chunks_knowledge_base_id_fkey";
            columns: ["knowledge_base_id"];
            referencedRelation: "knowledge_bases";
            referencedColumns: ["id"];
          },
        ];
      };
      workflows: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          enabled: boolean;
          trigger_type: WorkflowTriggerType;
          webhook_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          enabled?: boolean;
          trigger_type?: WorkflowTriggerType;
          webhook_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          enabled?: boolean;
          trigger_type?: WorkflowTriggerType;
          webhook_token?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflows_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_steps: {
        Row: {
          id: string;
          workflow_id: string;
          owner_id: string;
          position: number;
          name: string;
          type: WorkflowStepType;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          owner_id: string;
          position: number;
          name: string;
          type: WorkflowStepType;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workflow_id?: string;
          owner_id?: string;
          position?: number;
          name?: string;
          type?: WorkflowStepType;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_steps_workflow_id_fkey";
            columns: ["workflow_id"];
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_runs: {
        Row: {
          id: string;
          workflow_id: string;
          owner_id: string;
          status: WorkflowRunStatus;
          trigger: WorkflowTriggerType;
          trigger_input: string | null;
          error: string | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          owner_id: string;
          status?: WorkflowRunStatus;
          trigger?: WorkflowTriggerType;
          trigger_input?: string | null;
          error?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          workflow_id?: string;
          owner_id?: string;
          status?: WorkflowRunStatus;
          trigger?: WorkflowTriggerType;
          trigger_input?: string | null;
          error?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_runs_workflow_id_fkey";
            columns: ["workflow_id"];
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_run_steps: {
        Row: {
          id: string;
          run_id: string;
          owner_id: string;
          position: number;
          step_name: string;
          step_type: string;
          status: WorkflowRunStepStatus;
          input: Json | null;
          output: Json | null;
          error: string | null;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          run_id: string;
          owner_id: string;
          position: number;
          step_name: string;
          step_type: string;
          status: WorkflowRunStepStatus;
          input?: Json | null;
          output?: Json | null;
          error?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          run_id?: string;
          owner_id?: string;
          position?: number;
          step_name?: string;
          step_type?: string;
          status?: WorkflowRunStepStatus;
          input?: Json | null;
          output?: Json | null;
          error?: string | null;
          started_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_run_steps_run_id_fkey";
            columns: ["run_id"];
            referencedRelation: "workflow_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: TeamMemberRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: TeamMemberRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          user_id?: string;
          role?: TeamMemberRole;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey";
            columns: ["team_id"];
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      team_invites: {
        Row: {
          id: string;
          team_id: string;
          email: string;
          role: TeamInviteRole;
          token: string;
          invited_by: string;
          status: TeamInviteStatus;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          email: string;
          role?: TeamInviteRole;
          token?: string;
          invited_by: string;
          status?: TeamInviteStatus;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          email?: string;
          role?: TeamInviteRole;
          token?: string;
          invited_by?: string;
          status?: TeamInviteStatus;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_invites_team_id_fkey";
            columns: ["team_id"];
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_invites_invited_by_fkey";
            columns: ["invited_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      api_keys: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          last_used_at: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          key_prefix: string;
          key_hash: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          key_prefix?: string;
          key_hash?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      deployments: {
        Row: {
          id: string;
          project_id: string;
          triggered_by: string | null;
          status: DeploymentStatus;
          provider: string;
          url: string | null;
          domain: string | null;
          logs: string | null;
          vercel_deployment_id: string | null;
          error: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          project_id: string;
          triggered_by?: string | null;
          status?: DeploymentStatus;
          provider?: string;
          url?: string | null;
          domain?: string | null;
          logs?: string | null;
          vercel_deployment_id?: string | null;
          error?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          project_id?: string;
          triggered_by?: string | null;
          status?: DeploymentStatus;
          provider?: string;
          url?: string | null;
          domain?: string | null;
          logs?: string | null;
          vercel_deployment_id?: string | null;
          error?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "deployments_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "deployments_triggered_by_fkey";
            columns: ["triggered_by"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_connections: {
        Row: {
          id: string;
          user_id: string;
          provider: "github" | "vercel" | "netlify" | "railway";
          access_token: string;
          account_name: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "github" | "vercel" | "netlify" | "railway";
          access_token: string;
          account_name?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: "github" | "vercel" | "netlify" | "railway";
          access_token?: string;
          account_name?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_connections_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: PlanId;
          status: SubscriptionStatus;
          provider: string | null;
          provider_ref: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan?: PlanId;
          status?: SubscriptionStatus;
          provider?: string | null;
          provider_ref?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: PlanId;
          status?: SubscriptionStatus;
          provider?: string | null;
          provider_ref?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string | null;
          provider: string;
          reference: string;
          plan: PlanId;
          amount: number;
          currency: string;
          status: "paid" | "pending" | "failed" | "refunded";
          paid_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id?: string | null;
          provider: string;
          reference: string;
          plan: PlanId;
          amount: number;
          currency?: string;
          status?: "paid" | "pending" | "failed" | "refunded";
          paid_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_id?: string | null;
          provider?: string;
          reference?: string;
          plan?: PlanId;
          amount?: number;
          currency?: string;
          status?: "paid" | "pending" | "failed" | "refunded";
          paid_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_subscription_id_fkey";
            columns: ["subscription_id"];
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_logs: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          action: UsageAction;
          quantity: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          action: UsageAction;
          quantity?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          action?: UsageAction;
          quantity?: number;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_logs_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usage_logs_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics: {
        Row: {
          id: string;
          user_id: string | null;
          project_id: string | null;
          event_type: string;
          properties: Json;
          session_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          project_id?: string | null;
          event_type: string;
          properties?: Json;
          session_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          project_id?: string | null;
          event_type?: string;
          properties?: Json;
          session_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analytics_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "analytics_project_id_fkey";
            columns: ["project_id"];
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      match_knowledge_chunks: {
        Args: {
          query_embedding: string | number[];
          target_kb_id: string;
          match_owner_id: string;
          match_count?: number;
        };
        Returns: {
          id: string;
          document_id: string;
          content: string;
          similarity: number;
          chunk_index: number;
        }[];
      };
      is_team_member: {
        Args: { check_team_id: string };
        Returns: boolean;
      };
      team_member_role: {
        Args: { check_team_id: string };
        Returns: string | null;
      };
      increment_template_installs: {
        Args: { target_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      plan_id: PlanId;
      project_status: ProjectStatus;
      deployment_status: DeploymentStatus;
      chat_role: ChatRole;
      generation_status: GenerationStatus;
      subscription_status: SubscriptionStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
