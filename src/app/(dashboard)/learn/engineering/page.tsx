import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BookOpenCheck } from "lucide-react";
import { EngineeringMissionControl } from "@/components/learn/engineering-mission-control";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { missionById } from "@/lib/learn/engineering-missions";

export const metadata: Metadata = {
  title: "Interactive Software Engineering Training | BuildRx",
  description: "Practise 20 engineering decisions, write specs, open runnable code exercises and build real AI app projects in BuildRx.",
};
export const dynamic = "force-dynamic";

export default async function EngineeringTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ mission?: string }>;
}) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/learn/engineering");
    const { data: profile } = await supabase.from("users")
      .select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") {
      const { COURSE_SLUG } = await import("@/lib/course/buildrx-tech-plus");
      const { data: enrollment } = await supabase.from("course_enrollments")
        .select("id")
        .eq("user_id", user.id).eq("course_slug", COURSE_SLUG)
        .in("status", ["active", "completed"]).maybeSingle();
      if (!enrollment) redirect("/course");
    }
  }
  if (!isSupabaseConfigured()) redirect("/course");
  const params = await searchParams;
  const initialMission = missionById(params.mission)?.id;
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="Interactive Software Engineering Training"
        description="Work through real engineering choices, run code in a separate isolated playground and turn a training brief into an editable BuildRx app."
      >
        <Badge variant="secondary" className="gap-1.5">
          <BookOpenCheck className="size-3.5" /> 4 real-world missions · 20 knowledge checkpoints
        </Badge>
      </PageHeader>
      <EngineeringMissionControl initialMission={initialMission} />
    </div>
  );
}
