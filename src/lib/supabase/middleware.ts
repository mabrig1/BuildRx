import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

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

  const url = supabaseUrl();
  const anonKey = supabaseAnonKey();

  // Allow the app to run before Supabase is configured.
  if (!url || !anonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anonKey, {
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isProtected = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("next", pathname);
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
