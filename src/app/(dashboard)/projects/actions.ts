"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  createProjectSchema,
  type CreateProjectInput,
} from "@/lib/validations/project";

type ActionResult = { error: string } | { success: true } | void;

function revalidateProjectViews() {
  revalidatePath("/dashboard");
  revalidatePath("/projects");
}

export async function createProject(
  input: CreateProjectInput
): Promise<ActionResult> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the form for errors." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to create a project." };
  }

  const { checkProjectLimit } = await import("@/lib/billing/limits");
  const limitError = await checkProjectLimit(user.id);
  if (limitError) {
    return { error: limitError };
  }

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      template_id: parsed.data.templateId ?? null,
    })
    .select("id")
    .single();

  if (error || !project) {
    return { error: error?.message ?? "Failed to create project." };
  }

  // Seed the conversation with the initial prompt so the workspace
  // opens with context.
  if (parsed.data.prompt) {
    await supabase.from("chat_messages").insert({
      project_id: project.id,
      user_id: user.id,
      role: "user",
      content: parsed.data.prompt,
    });
  }

  if (parsed.data.templateId) {
    // Best-effort — a failed counter bump shouldn't block project creation.
    await supabase.rpc("increment_template_installs", { target_id: parsed.data.templateId });
  }

  revalidateProjectViews();
  redirect(`/projects/${project.id}`);
}

export async function deleteProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to delete a project." };
  }

  // RLS restricts the delete to rows the user owns.
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) {
    return { error: error.message };
  }

  revalidateProjectViews();
  return { success: true };
}

export async function duplicateProject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in to duplicate a project." };
  }

  const { checkProjectLimit } = await import("@/lib/billing/limits");
  const limitError = await checkProjectLimit(user.id);
  if (limitError) {
    return { error: limitError };
  }

  const { data: source, error: sourceError } = await supabase
    .from("projects")
    .select("name, description, template_id")
    .eq("id", id)
    .single();

  if (sourceError || !source) {
    return { error: "Project not found." };
  }

  const { data: copy, error: copyError } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      name: `${source.name} (copy)`,
      description: source.description,
      template_id: source.template_id,
    })
    .select("id")
    .single();

  if (copyError || !copy) {
    return { error: copyError?.message ?? "Failed to duplicate project." };
  }

  // Copy the generated source files across.
  const { data: files, error: filesError } = await supabase
    .from("project_files")
    .select("path, content, language, version")
    .eq("project_id", id);

  if (filesError) {
    return { error: filesError.message };
  }

  if (files && files.length > 0) {
    const { error: insertError } = await supabase.from("project_files").insert(
      files.map((file) => ({
        project_id: copy.id,
        path: file.path,
        content: file.content,
        language: file.language,
        version: file.version,
      }))
    );
    if (insertError) {
      return { error: insertError.message };
    }
  }

  revalidateProjectViews();
  return { success: true };
}
