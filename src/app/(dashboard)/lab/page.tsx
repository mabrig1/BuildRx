import type { Metadata } from "next";
import { ArrowUpRight, CheckCircle2, FlaskConical, LockKeyhole } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { codingLab } from "@/lib/coding-lab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Coding Lab",
  description: "Hands-on coding, GitHub practice, deployment readiness and recovery drills.",
  robots: { index: false, follow: false },
};

export default function CodingLabPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader title="Coding Lab" description="Build confidence through practice, from your first line of code to a recoverable release." />
      <Card className="border-emerald-500/25 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FlaskConical className="size-5" aria-hidden />Your private coding laboratory</CardTitle>
          <CardDescription>Edit code, run checks, save progress, and rehearse your next deployment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-muted-foreground max-w-3xl text-sm leading-6">
            The working laboratory opens in a new tab. Sign in with ChatGPT using the account that owns the private lab.
            Your BuildRx login and the lab&apos;s access permission are separate.
          </p>
          <Button asChild size="lg">
            <a href={codingLab.privateUrl} target="_blank" rel="noopener noreferrer">
              Open private coding lab<ArrowUpRight className="size-4" aria-hidden />
            </a>
          </Button>
          <p className="text-muted-foreground flex items-start gap-2 text-xs leading-5">
            <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden />
            The laboratory remains owner-private. This link does not grant other BuildRx users access.
          </p>
        </CardContent>
      </Card>
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Laboratory exercises">
        {codingLab.modules.map(module => (
          <Card key={module.title}>
            <CardHeader>
              <CardTitle className="flex items-start gap-2 text-base"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />{module.title}</CardTitle>
              <CardDescription className="leading-6">{module.detail}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
      <Card>
        <CardHeader><CardTitle className="text-base">Your first session</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground space-y-4 text-sm leading-6">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Open the lab, edit the first HTML exercise, and run its checks.</li>
            <li>Pass each exercise, then save a tested snapshot in the Git practice terminal.</li>
            <li>Choose Vercel or Cloudflare Pages, resolve readiness blockers, and rehearse a release.</li>
            <li>Simulate a broken release, restore a working version, and export your progress backup.</li>
          </ol>
          <p>Code exercises execute in isolated browser sandboxes. Git, deployment and rollback actions are local simulations. Progress stays in that browser; export a backup before changing devices.</p>
          <p>The lab does not connect to your GitHub or hosting accounts. Real publishing remains a separate, approved step. Its knowledge base explains how to continue into React, APIs and databases.</p>
        </CardContent>
      </Card>
    </div>
  );
}
