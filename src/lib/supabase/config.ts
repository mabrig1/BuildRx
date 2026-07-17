/**
 * Supabase environment configuration.
 *
 * Values pasted into dashboard env-var forms often carry stray spaces
 * or a trailing newline, which makes the Supabase client reject them —
 * so everything is trimmed at read time (empty after trim = unset).
 * Pages use isSupabaseConfigured() to degrade gracefully (empty states
 * instead of crashes) before the project is connected to Supabase.
 */

function cleanEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function supabaseUrl(): string | undefined {
  return cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string | undefined {
  return cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabaseServiceRoleKey(): string | undefined {
  return cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl() && supabaseAnonKey());
}
