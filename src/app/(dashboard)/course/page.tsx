import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, LockKeyhole, Sparkles } from "lucide-react";

import { CourseExperience } from "@/components/course/course-experience";
import { EnrollButton } from "@/components/course/enroll-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COURSE_DURATION,
  COURSE_PRICE_NGN,
  COURSE_SLUG,
  COURSE_SUBTITLE,
  COURSE_TITLE,
  courseBenefits,
  courseModules,
} from "@/lib/course/buildrx-tech-plus";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Tech+ Full-Stack Course",
};

async function enrollmentState() {
  if (!isSupabaseConfigured()) return { enrolled: true, demo: true };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/course");

  const { data } = await supabase
    .from("course_enrollments")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("course_slug", COURSE_SLUG)
    .eq("status", "active")
    .maybeSingle();

  return { enrolled: Boolean(data), demo: false };
}

export default async function CoursePage() {
  const state = await enrollmentState();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageHeader
        title={COURSE_TITLE}
        description={COURSE_SUBTITLE + " — " + COURSE_DURATION + ", project-first, portfolio-driven."}
      >
        <Badge variant="secondary">MABRIG Technologies</Badge>
      </PageHeader>

      {state.enrolled ? (
        <>
          {state.demo ? (
            <Card className="border-dashed">
              <CardContent className="flex items-center gap-3 py-4 text-sm">
                <Sparkles className="size-4" />
                Demo mode: the complete course experience is unlocked for product testing.
              </CardContent>
            </Card>
          ) : null}
          <CourseExperience />
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <Card>
            <CardHeader>
              <div className="mb-2 flex items-center gap-2">
                <LockKeyhole className="size-5" />
                <Badge>Premium cohort</Badge>
              </div>
              <CardTitle>Learn by shipping, not by watching.</CardTitle>
              <CardDescription>
                Eight practical modules. Eight BuildRx labs. One production-grade capstone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {courseModules.map((module) => (
                <div key={module.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">{module.week}: {module.title}</p>
                    <p className="text-muted-foreground text-sm">{module.deliverable}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Premium enrollment</CardTitle>
              <CardDescription>One-time course fee. Your BuildRx SaaS plan remains separate.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-4xl font-semibold tracking-tight">₦{COURSE_PRICE_NGN.toLocaleString()}</p>
                <p className="text-muted-foreground text-sm">one-time · {COURSE_DURATION}</p>
              </div>
              <div className="space-y-2 text-sm">
                {courseBenefits.slice(0, 6).map((benefit) => (
                  <p key={benefit} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    <span>{benefit}</span>
                  </p>
                ))}
              </div>
              <div className="grid gap-2">
                <EnrollButton provider="paystack">Enroll with Paystack</EnrollButton>
                <EnrollButton provider="flutterwave" variant="outline">Enroll with Flutterwave</EnrollButton>
              </div>
              <p className="text-muted-foreground text-xs">
                Access activates only after the payment provider confirms the transaction server-side.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
