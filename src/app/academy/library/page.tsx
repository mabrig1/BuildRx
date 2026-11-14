import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Code2, ExternalLink, FlaskConical, FolderOpen, GraduationCap } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { COURSE_DURATION, COURSE_PRICE_NGN } from "@/lib/course/buildrx-tech-plus";
import { ACADEMY_MOTTO, academyLabTracks, academyCourseSources, academyAppExamples, masterclassPhases, masterclassTopicCount } from "@/lib/course/academy-bundle";

export const metadata: Metadata = {
  title: "BuildRx Software Engineering Academy | Course and Laboratory Library",
  description: "Explore BuildRx's eight-week practical academy, connected engineering laboratories, 64-topic roadmap and app case studies.",
};

export default function AcademyLibraryPage() {
  return (
    <MarketingShell>
      <div className="mx-auto w-full max-w-6xl space-y-14 px-4 py-16">
        <header className="max-w-4xl space-y-5">
          <Badge variant="secondary"><GraduationCap className="mr-1 size-4" /> MABRIG Technologies</Badge>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">BuildRx Software Engineering Academy</h1>
          <p className="text-xl font-medium text-primary">{ACADEMY_MOTTO}</p>
          <p className="text-muted-foreground leading-7">From conversation to real source: practise modern app creation, code review, testing, GitHub, Vercel or Cloudflare deployment and independent project evaluation.</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild><Link href="/signup?next=/course">Explore ₦{COURSE_PRICE_NGN.toLocaleString()} enrolment <ArrowRight className="ml-1 size-4" /></Link></Button>
            <Button variant="outline" asChild><Link href="/academy">Flagship syllabus</Link></Button>
          </div>
          <p className="text-sm text-muted-foreground">One-time flagship tuition · {COURSE_DURATION}. International learners may enquire; the current checkout is NGN-denominated and foreign-card eligibility depends on the provider.</p>
        </header>
        <section className="space-y-5">
          <div className="flex items-center gap-2"><FlaskConical className="size-6 text-primary" /><h2 className="text-3xl font-semibold">Build in connected engineering labs</h2></div>
          <p className="text-sm text-muted-foreground">Open a specific track, practise coding, or edit reviewed starter files in the Project Studio. These learning tools do not automatically publish or certify an app.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {academyLabTracks.map((track) => (
              <Card key={track.id}>
                <CardHeader><Badge variant="outline" className="w-fit">{track.labCount} guided labs</Badge><CardTitle>{track.title}</CardTitle><CardDescription>{track.outcome}</CardDescription></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" asChild><Link href={"/learn/labs?track=" + track.id}>Guided labs <ArrowRight className="ml-1 size-4" /></Link></Button>
                  <Button size="sm" variant="outline" asChild><Link href={"/learn/studio?track=" + track.id}><FolderOpen className="mr-1 size-4" /> Project Studio</Link></Button>
                  <Button size="sm" variant="outline" asChild><Link href="/learn/playground"><Code2 className="mr-1 size-4" /> Playground</Link></Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        <section className="space-y-5">
          <div className="flex items-center gap-2"><BookOpen className="size-6 text-primary" /><h2 className="text-3xl font-semibold">{masterclassTopicCount}-topic extended syllabus</h2></div>
          <p className="text-sm text-muted-foreground">Indexed from the separate Full Stack Master Class repository. Topics are a linked roadmap, not 64 imported and independently verified complete lessons.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {masterclassPhases.map((phase, i) => (
              <Card key={phase.name}><CardHeader><Badge variant="outline" className="w-fit">Phase {i + 1} · {phase.topics.length} topics</Badge><CardTitle className="text-lg">{phase.name}</CardTitle></CardHeader>
                <CardContent><ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">{phase.topics.map(t => <li key={t}>{t}</li>)}</ul></CardContent></Card>
            ))}
          </div>
        </section>
        <section className="space-y-5">
          <h2 className="text-3xl font-semibold">MABRIG course sources and teaching projects</h2>
          <p className="text-sm text-muted-foreground">Explore the real repositories. No student records, payments, copyrighted third-party content or separate academy accounts have been merged.</p>
          <div className="grid gap-4 md:grid-cols-2">
            {academyCourseSources.map(s => (
              <Card key={s.name}><CardHeader><CardTitle className="text-lg">{s.name}</CardTitle><CardDescription>{s.focus}</CardDescription></CardHeader>
                <CardContent><a className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-4" href={s.repo} target="_blank" rel="noopener noreferrer">Inspect repository <ExternalLink className="size-4" /></a></CardContent>
              </Card>
            ))}
          </div>
        </section>
        <section className="space-y-5">
          <h2 className="text-3xl font-semibold">Real application case studies</h2>
          <p className="text-sm text-muted-foreground">Use these to discuss requirements, trade-offs, testing and architecture; repository source is not evidence that a live deployment is production-ready.</p>
          <div className="grid gap-3 md:grid-cols-3">
            {academyAppExamples.map(s => (
              <Card key={s.name}><CardHeader><CardTitle className="text-base">{s.name}</CardTitle><CardDescription>{s.focus}</CardDescription></CardHeader>
                <CardContent><a className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-4" href={s.repo} target="_blank" rel="noopener noreferrer">View source <ExternalLink className="size-4" /></a></CardContent></Card>
            ))}
          </div>
        </section>
        <section className="rounded-xl border p-6">
          <h2 className="text-2xl font-semibold">Enquire about practical laboratory coaching</h2>
          <p className="mt-2 text-sm text-muted-foreground">Ask about cohort schedules, mentor reviews and project support. Availability, certificate rules and instructor hours must be confirmed before enrolment.</p>
          <Button className="mt-4" asChild><a href="https://wa.me/2347065342818?text=Hello%2C%20I%20want%20BuildRx%20Academy%20hands-on%20coaching." target="_blank" rel="noopener noreferrer">Discuss coaching <ExternalLink className="ml-1 size-4" /></a></Button>
        </section>
      </div>
    </MarketingShell>
  );
}
