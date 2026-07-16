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

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { siteConfig } from "@/lib/constants";

const features = [
  {
    icon: Bot,
    title: "AI-powered building",
    description:
      "Describe your app in plain English. Claude turns your ideas into working code.",
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
      "Ship straight to Vercel with a production-grade Next.js stack underneath.",
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
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">
                Get started
                <ArrowRight />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.25_295/0.15),transparent_60%)]"
          />
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-24 text-center md:py-36">
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="size-3" />
              Powered by Claude
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
                A complete platform for turning ideas into deployed
                applications.
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
          </div>
        </section>

        {/* CTA */}
        <section className="border-t">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Ready to build something?
            </h2>
            <p className="text-muted-foreground max-w-xl">
              Join builders shipping real products with nothing but a prompt.
            </p>
            <Button size="lg" asChild>
              <Link href="/signup">
                Create your first app
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
          <Logo />
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {siteConfig.name}. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
