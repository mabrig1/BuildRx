/**
 * Supabase database types.
 *
 * Regenerate after schema changes with:
 *   npx supabase gen types typescript --project-id <project-ref> --schema public > src/types/database.ts
 *
 * The definitions below mirror supabase/migrations/0001_initial_schema.sql
 * and act as a hand-written stand-in until generated types are wired up.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          role: "user" | "admin";
          plan: "free" | "pro" | "team";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          role?: "user" | "admin";
          plan?: "free" | "pro" | "team";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          avatar_url?: string | null;
          role?: "user" | "admin";
          plan?: "free" | "pro" | "team";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          description: string | null;
          status: "draft" | "generating" | "ready" | "error";
          preview_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          description?: string | null;
          status?: "draft" | "generating" | "ready" | "error";
          preview_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          description?: string | null;
          status?: "draft" | "generating" | "ready" | "error";
          preview_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          project_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          role?: "user" | "assistant" | "system";
          content?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      deployments: {
        Row: {
          id: string;
          project_id: string;
          status: "queued" | "building" | "live" | "failed";
          url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          status?: "queued" | "building" | "live" | "failed";
          url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          status?: "queued" | "building" | "live" | "failed";
          url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: "free" | "pro" | "team";
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan?: "free" | "pro" | "team";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: "free" | "pro" | "team";
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: "user" | "admin";
      plan_id: "free" | "pro" | "team";
      project_status: "draft" | "generating" | "ready" | "error";
      deployment_status: "queued" | "building" | "live" | "failed";
      chat_role: "user" | "assistant" | "system";
    };
    CompositeTypes: Record<string, never>;
  };
}
