import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/** Only allow same-origin relative paths as post-auth redirect targets. */
function sanitizeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/dashboard";
  }
  return next;
}

/**
 * Supabase OAuth / magic-link / recovery callback.
 * Exchanges the auth code for a session (setting the auth cookies),
 * then redirects into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { trackServerEvent } = await import("@/lib/analytics/track");
      await trackServerEvent({
        userId: data.user?.id ?? null,
        eventType: "login",
        properties: { method: "oauth" },
      });
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
