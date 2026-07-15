/**
 * Whether Supabase env vars are present. Pages use this to degrade
 * gracefully (empty states instead of crashes) before the project is
 * connected to a Supabase instance.
 */
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
