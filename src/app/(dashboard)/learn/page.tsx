import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, BookOpenCheck, Code2, FileSearch, FlaskConical, FolderOpen, GraduationCap, ArrowRight } from "lucide-react";

import { KnowledgeAcademy } from "@/components/learn/knowledge-academy";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
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
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpenCheck className="size-5 text-primary" /> Interactive Software Engineering Training
          </CardTitle>
          <CardDescription>
            Four realistic projects, 20 scored engineering decisions, immediate explanations and a guided five-stage workflow.
            Generate an editable BuildRx project, run a linked coding challenge, practise in the studio and prepare an evidence pack.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link href="/learn/engineering">Enter interactive engineering training <ArrowRight className="ml-2 size-4" /></Link></Button>
        </CardContent>
      </Card>
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="size-5 text-primary" /> Engineering hands-on labs
          </CardTitle>
          <CardDescription>
            Four structured tracks: software development engineering, systems architecture,
            full-stack web development, and React Native/Expo mobile apps. Twenty practical
            workshops with tasks, deliverables, acceptance checks and an optional AI lab mentor.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link href="/learn/labs">Explore practical laboratories <ArrowRight className="ml-2 size-4" /></Link></Button>
        </CardContent>
      </Card>
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Code2 className="size-5 text-primary" /> Interactive coding playground
          </CardTitle>
          <CardDescription>
            Edit real code, run isolated JavaScript tests, inspect HTML/CSS previews and
            practice debugging with guided feedback. All execution is browser-local;
            no production project or account is changed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/learn/playground">Start interactive coding <ArrowRight className="ml-2 size-4" /></Link>
          </Button>
        </CardContent>
      </Card>
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FolderOpen className="size-5 text-primary" /> Multi-file Project Studio
          </CardTitle>
          <CardDescription>
            Edit Next.js, Expo, systems engineering or TypeScript starter files,
            save drafts in your browser, review missing pieces and export source ZIPs.
            This is a training workspace, not a server-side application build.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/learn/studio">Open multi-file studio <ArrowRight className="ml-2 size-4" /></Link>
          </Button>
        </CardContent>
      </Card>
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSearch className="size-5 text-primary" /> Build Doctor — understand errors safely
          </CardTitle>
          <CardDescription>
            Paste a GitHub, Next.js, Vercel or Cloudflare build error into a browser-local
            helper to identify the first meaningful blocker and learn a reversible repair.
            No AI credits, secret uploads or changes to live projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/learn/doctor">Explain a build error <ArrowRight className="ml-2 size-4" /></Link>
          </Button>
        </CardContent>
      </Card>
      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="size-5 text-primary" /> Capstone evidence portfolio
          </CardTitle>
          <CardDescription>
            Prepare a source-linked review request for a real engineering project.
            Four track-specific rubrics, exact commit references, a private evidence journal
            and a downloadable mentor packet. This is preparation for human verification,
            not a certificate or a claim that BuildRx has run your tests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link href="/learn/capstone">Prepare my capstone review <ArrowRight className="ml-2 size-4" /></Link>
          </Button>
        </CardContent>
      </Card>
      <KnowledgeAcademy initialLessonId={initialLessonId} />
    </div>
  );
}
