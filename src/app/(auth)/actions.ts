"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { sanitizeNextPath } from "@/lib/auth/redirects";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
  type SignupInput,
} from "@/lib/validations/auth";

type ActionResult = { error: string } | { success: true } | void;

const NOT_CONFIGURED_ERROR =
  "Authentication isn't set up yet: the NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables are missing on " +
  "this deployment. Add them (Production environment) and redeploy.";

async function getOrigin() {
  const headerList = await headers();
  return (
    headerList.get("origin") ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  );
}

export async function login(
  input: LoginInput,
  next?: string
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_ERROR };
  }
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  const { trackServerEvent } = await import("@/lib/analytics/track");
  await trackServerEvent({
    userId: data.user?.id ?? null,
    eventType: "login",
    properties: { method: "password" },
  });

  redirect(sanitizeNextPath(next));
}

export async function signup(input: SignupInput): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_ERROR };
  }
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the form for errors." };
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { name: parsed.data.name },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Email confirmation disabled → session is live, go straight in.
  if (data.session) {
    const { trackServerEvent } = await import("@/lib/analytics/track");
    await trackServerEvent({
      userId: data.user?.id ?? null,
      eventType: "signup",
      properties: { method: "password" },
    });
    redirect("/dashboard");
  }

  // Email confirmation enabled → tell the user to check their inbox.
  return { success: true };
}

export async function signInWithGoogle(next?: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_ERROR };
  }
  const origin = await getOrigin();
  const supabase = await createClient();

  const safeNext = sanitizeNextPath(next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect(data.url);
}

export async function forgotPassword(
  input: ForgotPasswordInput
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_ERROR };
  }
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Always report success so the form can't be used to probe for accounts.
  return { success: true };
}

export async function resetPassword(
  input: ResetPasswordInput
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) {
    return { error: NOT_CONFIGURED_ERROR };
  }
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the form for errors." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
