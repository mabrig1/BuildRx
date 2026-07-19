import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ContentDetail, type ContentDetailData } from "@/components/content/content-detail";
import { PageHeader } from "@/components/layout/page-header";
import { CONTENT_TYPE_LABELS } from "@/lib/content/prompts";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ contentId: string }> };

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { contentId } = await params;
  return { title: `Content · ${contentId}` };
}

export default async function ContentPiecePage({ params }: RouteParams) {
  const { contentId } = await params;

  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/content/${contentId}`);

  const { data } = await supabase
    .from("content_pieces")
    .select("*")
    .eq("id", contentId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) notFound();

  const piece: ContentDetailData = {
    id: data.id,
    type: data.type,
    title: data.title,
    content: data.content ?? "",
    cover_image_data_url: data.cover_image_data_url,
    status: data.status,
    error: data.error,
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader title={piece.title} description={CONTENT_TYPE_LABELS[piece.type]} />
      <ContentDetail piece={piece} />
    </div>
  );
}
