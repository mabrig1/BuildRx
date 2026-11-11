import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";

import { KnowledgeAcademy } from "@/components/learn/knowledge-academy";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { getKnowledgeLesson } from "@/lib/learn/lessons";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Learning Center",
  description: "Learn how apps work, follow the BuildRx to GitHub to hosting path, and generate personalized AI training.",
};
export const dynamic = "force-dynamic";

export default async function LearnPage({
  searchParams,
}: {
  searchParams: Promise<{ lesson?: string }>;
}) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/learn");
  }

  const { lesson } = await searchParams;
  const initialLessonId = getKnowledgeLesson(lesson ?? "")?.id;
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="BuildRx Learning Center"
        description="Learn what each tool does, what to click next, and how to check that your app really works."
      >
        <Badge variant="secondary" className="gap-1.5">
          <BookOpen className="size-3.5" /> Free knowledge base + optional AI training
        </Badge>
      </PageHeader>
      <KnowledgeAcademy initialLessonId={initialLessonId} />
    </div>
  );
}
