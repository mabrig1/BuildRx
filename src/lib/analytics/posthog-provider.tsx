"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

let initialized = false;

function ensureInit() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || initialized || typeof window === "undefined") return false;
  posthog.init(key, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    capture_pageview: false, // captured manually on route change below
    persistence: "localStorage+cookie",
  });
  initialized = true;
  return true;
}

/** Client-side event capture — no-op when PostHog isn't configured. */
export function captureEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  if (ensureInit() || initialized) {
    posthog.capture(event, properties);
  }
}

/**
 * Boots PostHog (when NEXT_PUBLIC_POSTHOG_KEY is set) and captures a
 * $pageview on every route change.
 */
export function PostHogPageviews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    ensureInit();
  }, []);

  useEffect(() => {
    if (!initialized || !pathname) return;
    const query = searchParams.toString();
    posthog.capture("$pageview", {
      $current_url: query ? `${pathname}?${query}` : pathname,
    });
  }, [pathname, searchParams]);

  return null;
}
