import { NextResponse } from "next/server";

import { sanitizeNextPath } from "@/lib/auth/redirects";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase OAuth / magic-link / recovery callback.
 * Exchanges the auth code for a session (setting the auth cookies),
 * then redirects into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeNextPath(searchParams.get("next"));

  // Behind a proxy/load balancer (Vercel included) the host the user
  // actually visited arrives in x-forwarded-host — prefer it so the
  // post-auth redirect lands back on the same domain the flow started
  // on, per the current Supabase SSR guide.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const siteOrigin = forwardedHost
    ? `${forwardedProto ?? "https"}://${forwardedHost}`
    : origin;

  let errorDescription = searchParams.get("error_description");

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
      return NextResponse.redirect(`${siteOrigin}${next}`);
    }
    errorDescription = error.message;
  }

  // Surface what actually failed (e.g. "provider is not enabled",
  // user cancelled at the provider) instead of a silent generic error.
  const loginUrl = new URL("/login", siteOrigin);
  loginUrl.searchParams.set("error", "auth");
  if (errorDescription) {
    loginUrl.searchParams.set("error_description", errorDescription.slice(0, 200));
  }
  return NextResponse.redirect(loginUrl);
}
