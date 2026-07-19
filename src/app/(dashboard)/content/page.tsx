import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookOpen,
  Clapperboard,
  Mail,
  Megaphone,
  Newspaper,
  Share2,
  type LucideIcon,
} from "lucide-react";

import { ConnectSupabaseNotice } from "@/components/dashboard/connect-supabase-notice";
import {
  ContentPieceCard,
  type ContentPieceSummary,
} from "@/components/content/content-piece-card";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/content/prompts";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Content Studio" };

const WRITERS: { type: ContentType; icon: LucideIcon; description: string }[] = [
  { type: "blog_post", icon: Newspaper, description: "SEO-friendly posts with headings and structure." },
  { type: "ebook", icon: BookOpen, description: "Multi-chapter ebooks, outlined then written chapter by chapter." },
  { type: "social_post", icon: Share2, description: "Platform-native posts for X, LinkedIn, Instagram, and more." },
  { type: "email", icon: Mail, description: "Newsletters, welcome emails, and promotional sends." },
  { type: "ad_copy", icon: Megaphone, description: "Headline variants and body copy for paid ads." },
  { type: "video_script", icon: Clapperboard, description: "Short- or long-form scripts with beat markers." },
];

async function loadRecentContent(): Promise<ContentPieceSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/content");

  const { data } = await supabase
    .from("content_pieces")
    .select("id, type, title, status, error, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(12);

  return data ?? [];
}

export default async function ContentStudioPage() {
  const configured = isSupabaseConfigured();
  const pieces = configured ? await loadRecentContent() : [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Content Studio"
        description="AI writers for blog posts, ebooks, social, email, ads, and video scripts."
      >
        <Button variant="outline" asChild>
          <Link href="/content/prompts">Prompt library</Link>
        </Button>
      </PageHeader>

      {!configured ? <ConnectSupabaseNotice /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {WRITERS.map((writer) => (
          <Link key={writer.type} href={`/content/new?type=${writer.type}`}>
            <Card className="h-full gap-2 p-4 transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-2 p-0">
                <writer.icon className="text-primary size-6" />
                <p className="font-medium">{CONTENT_TYPE_LABELS[writer.type]}</p>
                <p className="text-muted-foreground text-sm">{writer.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {configured ? (
        <div className="grid gap-3">
          <h2 className="text-lg font-semibold">Recent</h2>
          {pieces.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
              Nothing generated yet — pick a writer above to get started.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pieces.map((piece) => (
                <ContentPieceCard key={piece.id} piece={piece} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
