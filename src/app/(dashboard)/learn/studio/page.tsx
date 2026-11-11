import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FolderOpen } from "lucide-react";

import { ProjectStudio } from "@/components/learn/project-studio";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { isStudioTrack } from "@/lib/learn/studio-workspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Multi-file Project Studio",
  description: "Edit reviewed Next.js, Expo, TypeScript and systems design source snippets in a browser-local learning workspace.",
};
export const dynamic = "force-dynamic";

export default async function ProjectStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/learn/studio");
  }

  const query = await searchParams;
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="BuildRx Multi-file Project Studio"
        description="Open a reviewed starter, edit multiple files, inspect next steps and export your learning project safely."
      >
        <Badge variant="secondary" className="gap-1.5">
          <FolderOpen className="size-3.5" /> Four training stacks · private browser workspace
        </Badge>
      </PageHeader>
      <ProjectStudio initialTrack={isStudioTrack(query.track) ? query.track : undefined} />
    </div>
  );
}
