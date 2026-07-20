import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Bot } from "lucide-react";

import { ConnectSupabaseNotice } from "@/components/dashboard/connect-supabase-notice";
import { PageHeader } from "@/components/layout/page-header";
import { MarketplaceGrid } from "@/components/marketplace/marketplace-grid";
import { PublishTemplateDialog } from "@/components/marketplace/publish-template-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Marketplace" };

async function loadTemplates() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/marketplace");

  const { data } = await supabase
    .from("templates")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(60);

  return { templates: data ?? [], userId: user.id };
}

export default async function MarketplacePage() {
  const configured = isSupabaseConfigured();
  const { templates, userId } = configured
    ? await loadTemplates()
    : { templates: [] as Awaited<ReturnType<typeof loadTemplates>>["templates"], userId: null };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title="Marketplace"
        description="Start from a community template, or publish one of your own projects."
      >
        <PublishTemplateDialog />
      </PageHeader>

      {!configured ? <ConnectSupabaseNotice /> : null}

      <Link href="/agents/marketplace">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="flex items-center gap-3 py-4">
            <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
              <Bot className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-medium">Looking for AI agents?</p>
              <p className="text-muted-foreground text-sm">
                Browse public agents shared by the community.
              </p>
            </div>
            <ArrowRight className="text-muted-foreground size-4" />
          </CardContent>
        </Card>
      </Link>

      <MarketplaceGrid templates={templates} currentUserId={userId} />
    </div>
  );
}
