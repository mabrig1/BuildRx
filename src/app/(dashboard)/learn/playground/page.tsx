import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Code2 } from "lucide-react";

import { CodingPlayground } from "@/components/learn/coding-playground";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getPlaygroundExercise } from "@/lib/learn/playground-exercises";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Interactive Coding Lab",
  description: "Write JavaScript, practice HTML/CSS, run local browser tests and learn engineering by doing.",
};
export const dynamic = "force-dynamic";

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/learn/playground");
  }
  const params = await searchParams;
  const chosen = getPlaygroundExercise(params.exercise ?? "")?.id;
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="BuildRx Interactive Coding Lab"
        description="Edit code, run isolated browser checks, explore previews, receive feedback and learn to debug—without touching production."
      >
        <Badge variant="secondary" className="gap-1.5">
          <Code2 className="size-3.5" /> Six interactive practice challenges
        </Badge>
      </PageHeader>
      <CodingPlayground initialExercise={chosen} />
    </div>
  );
}
