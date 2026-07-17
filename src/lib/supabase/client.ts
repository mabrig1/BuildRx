import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

/**
 * Supabase client for use in Client Components (browser).
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl()!, supabaseAnonKey()!);
}
