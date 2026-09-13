import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Github,
  GraduationCap,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { MarketingShell } from "@/components/layout/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  COURSE_DURATION,
  COURSE_PRICE_NGN,
  COURSE_SUBTITLE,
  COURSE_TITLE,
  courseBenefits,
  courseModules,
} from "@/lib/course/buildrx-tech-plus";

export const metadata: Metadata = {
  title: COURSE_TITLE,
  description: COURSE_SUBTITLE,
};

const proof = [
  { icon: Code2, title: "8 BuildRx labs", text: "Every module launches a real project brief directly inside BuildRx." },
  { icon: Github, title: "GitHub evidence", text: "Graduate with repositories, release notes and case studies—not screenshots alone." },
  { icon: Rocket, title: "Live deployment", text: "Ship production previews and capstones through a disciplined Vercel workflow." },
  { icon: ShieldCheck, title: "Production mindset", text: "Security, authorization, testing, cost control and recovery are part of the build." },
];

export default function AcademyPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden border-b">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.25_295/0.16),transparent_60%)]" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[1.15fr_.85fr] lg:py-28">
          <div className="space-y-6">
            <Badge variant="secondary" className="gap-1.5">
              <GraduationCap className="size-3.5" />
              MABRIG Tech+ Premium Program
            </Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tighter text-balance md:text-6xl">
                {COURSE_TITLE}
              </h1>
              <p className="text-primary text-xl font-medium">{COURSE_SUBTITLE}</p>
              <p className="text-muted-foreground max-w-2xl text-lg leading-8">
                An AI-native full-stack developer program built around one rule: every lesson must produce something you can run, test, deploy or defend.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/signup?next=/course">
                  Join the premium cohort
                  <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login?next=/course">I already have an account</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span><strong>{COURSE_DURATION}</strong> intensive track</span>
              <span><strong>₦{COURSE_PRICE_NGN.toLocaleString()}</strong> one-time</span>
              <span><strong>8</strong> portfolio milestones</span>
            </div>
          </div>

          <Card className="border-primary/30 bg-background/90 shadow-xl">
            <CardHeader>
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Sparkles className="size-5" />
                <span className="text-sm font-medium">What makes it premium</span>
              </div>
              <CardTitle>Build real software while you learn.</CardTitle>
              <CardDescription>
                The course is integrated with BuildRx so students move from lesson to working project without losing momentum.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {courseBenefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{benefit}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-muted/30 border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {proof.map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <item.icon className="text-primary size-5" />
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription>{item.text}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="mb-10 max-w-3xl">
            <Badge variant="outline">Curriculum</Badge>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
              Eight weeks from foundation to production capstone
            </h2>
            <p className="text-muted-foreground mt-3 text-lg">
              Each week has a practical outcome, a required artifact and a BuildRx lab.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {courseModules.map((module) => (
              <Card key={module.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="secondary">{module.week}</Badge>
                    <span className="text-muted-foreground text-xs">BuildRx practical</span>
                  </div>
                  <CardTitle>{module.title}</CardTitle>
                  <CardDescription>{module.outcome}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm"><strong>Ship:</strong> {module.deliverable}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
          <Badge>₦{COURSE_PRICE_NGN.toLocaleString()} one-time</Badge>
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Do not finish another course with only notes.
          </h2>
          <p className="text-muted-foreground max-w-2xl text-lg">
            Finish with a portfolio, deployed software, production evidence and the ability to explain what you built.
          </p>
          <Button size="lg" asChild>
            <Link href="/signup?next=/course">
              Start MABRIG Tech+
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
