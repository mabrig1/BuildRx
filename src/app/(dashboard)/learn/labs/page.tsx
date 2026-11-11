import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";

import { PracticalLabs } from "@/components/learn/practical-labs";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getTrainingLab, TRAINING_TRACKS, type TrainingTrackId } from "@/lib/learn/labs";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Engineering Practical Labs",
  description: "Guided hands-on software development, systems engineering, full-stack web and mobile app labs.",
};
export const dynamic = "force-dynamic";

export default async function LabsPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; lab?: string }>;
}) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/learn/labs");
  }
  const query = await searchParams;
  const selectedLab = getTrainingLab(query.lab ?? "");
  const requestedTrack = TRAINING_TRACKS.find(t => t.id === query.track)?.id as TrainingTrackId | undefined;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="BuildRx Engineering Labs"
        description="Hands-on software development, systems architecture, full-stack web apps and React Native mobile training."
      >
        <Badge variant="secondary" className="gap-1.5">
          <FlaskConical className="size-3.5" />
          4 tracks · 20 practical workshops
        </Badge>
      </PageHeader>
      <PracticalLabs initialTrack={selectedLab?.trackId ?? requestedTrack} initialLabId={selectedLab?.id} />
    </div>
  );
}
