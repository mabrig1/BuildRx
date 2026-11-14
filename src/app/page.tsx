import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Eye,
  GraduationCap,
  FlaskConical,
  Rocket,
  Stethoscope,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { MarketingShell } from "@/components/layout/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { brandConfig, siteConfig } from "@/lib/constants";

const features = [
  {
    icon: Bot,
    title: "AI-powered building",
    description:
      "Describe your app in plain English. AI agents turn your ideas into working code.",
  },
  {
    icon: Eye,
    title: "Live preview",
    description:
      "Watch your app render in real time as you iterate. No local setup required.",
  },
  {
    icon: Zap,
    title: "Instant iteration",
    description:
      "Refine layouts, wire up data, and polish details through conversation.",
  },
  {
    icon: Rocket,
    title: "Guided publishing",
    description:
      "Prepare GitHub and choose Vercel or Cloudflare, then verify the actual public app before sharing it.",
  },
  {
    icon: ShieldCheck,
    title: "Auth and data guidance",
    description:
      "Generate backend and authentication source with setup instructions, then configure and test the real database.",
  },
  {
    icon: Sparkles,
    title: "App Doctor and AI repair",
    description:
      "Inspect saved project files, see the first source blocker and approve an AI repair before rechecking.",
  },
];

export default function LandingPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.25_295/0.15),transparent_60%)]"
        />
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-24 text-center md:py-36">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="size-3" />
            {brandConfig.companyName} · AI app builder
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tighter text-balance md:text-6xl">
            Build production apps by{" "}
            <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
              chatting with AI
            </span>
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg text-balance">
            {siteConfig.description} Answer three simple questions, build an editable project,
            fix source issues with App Doctor, and follow your own launch checklist.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">
                Create an app with AI
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/demo">See how it works</Link>
            </Button>
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            <span>{brandConfig.ownershipLine}</span>
            <a
              href={brandConfig.contacts.whatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              WhatsApp {brandConfig.contacts.whatsapp.value}
            </a>
            <a
              href={brandConfig.contacts.primaryEmail.href}
              className="hover:text-primary transition-colors"
            >
              {brandConfig.contacts.primaryEmail.value}
            </a>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/20">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-12 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-xl font-semibold"><Stethoscope className="size-5 text-primary" /> You create it. BuildRx guides you through it.</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Describe the app in three answers, inspect its saved source for errors, review repair suggestions and see your next step from GitHub to hosting.
            </p>
          </div>
          <Button variant="outline" className="w-fit shrink-0" asChild>
            <Link href="/demo">Explore the product walkthrough <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
      </section>
      <section className="border-b bg-background">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-12 md:grid-cols-[1.2fr_.8fr] md:items-center">
          <div className="space-y-3">
            <Badge variant="secondary"><GraduationCap className="mr-1 size-4" /> BuildRx Software Engineering Academy</Badge>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Build Realistic Modern Apps by Chatting with AI</h2>
            <p className="text-muted-foreground">Hands-on laboratory coaching for Nigerian and international learners. Eight-week premium training, four engineering tracks, 20 guided labs, and a real app-creating workspace.</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link href="/academy">₦100,000 flagship course <ArrowRight className="ml-1 size-4" /></Link></Button>
              <Button asChild variant="outline"><Link href="/learn/labs"><FlaskConical className="mr-1 size-4" /> Practice labs</Link></Button>
              <Button asChild variant="outline"><Link href="/academy/library">Explore course library</Link></Button>
            </div>
          </div>
          <div className="rounded-xl border bg-background p-5">
            <p className="font-semibold">From idea to verifiable app</p>
            <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>Chat with AI about a real problem.</li>
              <li>Create a new editable BuildRx project.</li>
              <li>Practise and debug in the lab and studio.</li>
              <li>Review the source and push to GitHub.</li>
              <li>Deploy, verify, and present your capstone.</li>
            </ol>
          </div>
        </div>
      </section>
      {/* Features */}
      <section className="bg-muted/30 border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Everything you need to ship
            </h2>
            <p className="text-muted-foreground mt-3">
              A complete platform for turning ideas into deployed applications,
              developed and maintained by {brandConfig.companyName}.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} className="gap-2">
                <CardHeader>
                  <div className="bg-primary/10 text-primary mb-2 flex size-9 items-center justify-center rounded-lg">
                    <feature.icon className="size-4" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button variant="outline" asChild>
              <Link href="/features">
                Explore all features
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
          <Badge variant="outline">{brandConfig.companyName}</Badge>
          <h2 className="text-3xl font-semibold tracking-tight">
            Ready to build something?
          </h2>
          <p className="text-muted-foreground max-w-xl">
            Join builders shipping real products with nothing but a prompt,
            backed by the MABRIG Technologies ecosystem.
          </p>
          <Button size="lg" asChild>
            <Link href="/signup">
              Create your first app
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
