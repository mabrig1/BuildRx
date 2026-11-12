import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";

import { CapstonePortfolio } from "@/components/learn/capstone-portfolio";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { TRAINING_TRACKS, type TrainingTrackId } from "@/lib/learn/labs";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Capstone Evidence Portfolio",
  description: "Prepare self-reported project evidence for independent learning assessment.",
};
export const dynamic = "force-dynamic";

export default async function CapstonePage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/learn/capstone");
  }
  const query = await searchParams;
  const track = TRAINING_TRACKS.find(item => item.id === query.track)?.id as TrainingTrackId | undefined;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="BuildRx Capstone Evidence Portfolio"
        description="Organize project references and hand an independent mentor a track-specific review packet. Drafts stay in your browser."
      >
        <Badge variant="secondary" className="gap-1.5">
          <GraduationCap className="size-3.5" />
          Independent assessment preparation, not certification
        </Badge>
      </PageHeader>
      <CapstonePortfolio initialTrack={track} />
    </div>
  );
}
