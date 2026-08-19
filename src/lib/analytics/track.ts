import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Server-side event tracking: writes to the analytics table (RLS lets
 * authenticated users insert their own events) and mirrors to PostHog
 * via its capture API when a key is configured. Fire-and-forget —
 * tracking must never break a user-facing flow.
 */
export async function trackServerEvent(params: {
  userId: string | null;
  eventType: string;
  projectId?: string | null;
  properties?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (isSupabaseConfigured()) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      await supabase.from("analytics").insert({
        user_id: params.userId,
        project_id: params.projectId ?? null,
        event_type: params.eventType,
        properties: (params.properties ?? {}) as never,
      });
    }

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key) {
      const host =
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
      await fetch(`${host}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          event: params.eventType,
          distinct_id: params.userId ?? "anonymous",
          properties: params.properties ?? {},
        }),
      });
    }
  } catch (error) {
    console.error("trackServerEvent failed:", error);
  }
}
