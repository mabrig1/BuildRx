import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

const SUPABASE_AUTH_TIMEOUT_MS = 2_000;

/** Routes that require an authenticated session. */
const protectedPrefixes = [
  "/dashboard",
  "/projects",
  "/chat",
  "/settings",
  "/billing",
  "/admin",
  "/profile",
];

/** Auth pages a signed-in user should be bounced away from. */
const authPages = ["/login", "/signup", "/forgot-password"];

function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some(
      ({ name }) => name.startsWith("sb-") && name.includes("-auth-token")
    );
}

/**
 * Routing middleware must never wait indefinitely on an external auth API.
 * A slow or unreachable Supabase project previously held every request open
 * until Vercel returned MIDDLEWARE_INVOCATION_TIMEOUT.
 */
async function fetchWithAuthTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort("Supabase auth middleware timed out"),
    SUPABASE_AUTH_TIMEOUT_MS
  );

  const upstreamSignal = init?.signal;
  const abortFromUpstream = () => controller.abort(upstreamSignal?.reason);
  upstreamSignal?.addEventListener("abort", abortFromUpstream, { once: true });

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}

/** Marketing-only routes (served on the apex domain). */
const marketingPrefixes = ["/pricing", "/features", "/docs"];

/**
 * Optional split-domain architecture: when NEXT_PUBLIC_APP_HOST is set
 * (e.g. app.buildrx.online), the app lives on that subdomain and the
 * marketing pages live on the apex. Requests landing on the wrong host
 * are redirected to the right one. Unset (local dev, previews), a
 * single host serves everything and this is a no-op.
 */
function hostRedirect(request: NextRequest): NextResponse | null {
  const appHost = process.env.NEXT_PUBLIC_APP_HOST?.trim();
  if (!appHost) return null;

  const host = request.headers.get("host");
  if (!host) return null;
  const { pathname } = request.nextUrl;

  const isAppPath =
    ["/dashboard", "/projects", "/chat", "/settings", "/billing", "/admin", "/profile"].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    ) ||
    [...authPages, "/reset-password"].includes(pathname);
  const isMarketingPath =
    pathname === "/" ||
    marketingPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

  if (host === appHost) {
    // The app subdomain's root goes straight to the product.
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    // Marketing pages belong on the apex (app. → apex when derivable).
    if (isMarketingPath && appHost.startsWith("app.")) {
      const url = request.nextUrl.clone();
      url.host = appHost.slice(4);
      return NextResponse.redirect(url);
    }
    return null;
  }

  // Any other host (apex/www): the product lives on the app subdomain.
  if (isAppPath) {
    const url = request.nextUrl.clone();
    url.host = appHost;
    url.protocol = "https";
    url.port = "";
    return NextResponse.redirect(url);
  }
  return null;
}

/**
 * Refreshes the Supabase auth session on every request (rotating the JWT
 * in the auth cookies when needed) and enforces route protection.
 */
export async function updateSession(request: NextRequest) {
  const crossHost = hostRedirect(request);
  if (crossHost) return crossHost;

  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isProtected = matchesPrefix(pathname, protectedPrefixes);
  const isAuthPage = authPages.includes(pathname);

  // Public and marketing requests do not need a verified user. Avoiding a
  // Supabase round trip here keeps the homepage available even if the auth
  // provider is degraded or its environment variables are wrong.
  if (!isProtected && !isAuthPage) {
    return supabaseResponse;
  }

  // A signed-out visitor opening a login page has no session to refresh.
  if (isAuthPage && !hasSupabaseAuthCookie(request)) {
    return supabaseResponse;
  }

  const url = supabaseUrl();
  const anonKey = supabaseAnonKey();

  // Allow the app to run before Supabase is configured.
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
    global: { fetch: fetchWithAuthTimeout },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: do not add logic between createServerClient and getUser —
  // it can cause hard-to-debug session issues.
  let user = null;
  let authUnavailable = false;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
    if (result.error) {
      authUnavailable = true;
      console.warn("[middleware:auth] Supabase user verification failed", {
        pathname,
        message: result.error.message,
      });
    }
  } catch (error) {
    authUnavailable = true;
    console.error("[middleware:auth] Supabase request failed", {
      pathname,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", pathname);
    if (authUnavailable) {
      redirectUrl.searchParams.set("error", "auth_unavailable");
    }
    return NextResponse.redirect(redirectUrl);
  }

  if (user && authPages.includes(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
