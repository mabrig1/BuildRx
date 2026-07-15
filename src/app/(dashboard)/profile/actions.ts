"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { profileSchema, type ProfileInput } from "@/lib/validations/settings";

type ActionResult = { error: string } | { success: true };

export async function updateProfile(
  input: ProfileInput
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the form for errors." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to update your profile." };
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: { name: parsed.data.name },
  });
  if (authError) {
    return { error: authError.message };
  }

  const { error: dbError } = await supabase
    .from("profiles")
    .update({ name: parsed.data.name })
    .eq("id", user.id);
  if (dbError) {
    return { error: dbError.message };
  }

  revalidatePath("/profile");
  return { success: true };
}
