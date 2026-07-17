import { createClient } from "@supabase/supabase-js";

import { supabaseServiceRoleKey, supabaseUrl } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

/**
 * Supabase admin client using the service-role key.
 * Server-only — never import this from client code.
 */
export function createAdminClient() {
  return createClient<Database>(supabaseUrl()!, supabaseServiceRoleKey()!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
