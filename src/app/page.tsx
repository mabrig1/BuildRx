import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Eye,
  Rocket,
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
    title: "One-click deploy",
    description:
      "Ship straight to Vercel, Netlify, or Railway with a production-grade stack underneath.",
  },
  {
    icon: ShieldCheck,
    title: "Auth & data built in",
    description:
      "Supabase authentication and Postgres come pre-wired with row-level security.",
  },
  {
    icon: Sparkles,
    title: "Beautiful by default",
    description:
      "Every generated app starts from a polished, accessible design system.",
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
            {siteConfig.description} From idea to deployed product — no
            boilerplate, no setup, no friction.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">
                Start building free
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/dashboard">View dashboard</Link>
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
