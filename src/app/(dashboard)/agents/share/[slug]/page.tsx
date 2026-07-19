import { notFound, redirect } from "next/navigation";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ slug: string }> };

/** Resolves a shared-agent link to its canonical /agents/[id] URL. */
export default async function AgentSharePage({ params }: RouteParams) {
  const { slug } = await params;

  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/agents/share/${slug}`);

  const { data } = await supabase
    .from("agents")
    .select("id")
    .eq("share_slug", slug)
    .maybeSingle();
  if (!data) notFound();

  redirect(`/agents/${data.id}`);
}
