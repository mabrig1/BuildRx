import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Code2,
  Download,
  Eye,
  GitBranch,
  LayoutDashboard,
  Lock,
  Rocket,
  Workflow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything BuildRx ships with: AI agents, in-browser IDE, live preview, GitHub, one-click deploys, and more.",
};

const featureGroups = [
  {
    heading: "Build with AI",
    features: [
      {
        icon: Bot,
        title: "AI chat workspace",
        description:
          "Streaming, project-aware chat with history, message editing, and markdown + code rendering. Powered by a fast reasoning model tuned for interactive work.",
      },
      {
        icon: Workflow,
        title: "Multi-agent pipeline",
        description:
          "Six specialized agents — Planner, UI, Database, Coding, Debug, Deployment — collaborate to turn one prompt into a complete project.",
      },
      {
        icon: Eye,
        title: "Live preview",
        description:
          "Instant-refresh preview with device viewports, an error console, fullscreen mode, and an in-browser WebContainer runtime.",
      },
    ],
  },
  {
    heading: "Own the code",
    features: [
      {
        icon: Code2,
        title: "In-browser IDE",
        description:
          "A full Monaco editor with file explorer, tabs, auto-save, search & replace, and a terminal — no local setup.",
      },
      {
        icon: GitBranch,
        title: "GitHub integration",
        description:
          "Connect your account, create repositories, push and pull code, and browse commit history without leaving the app.",
      },
      {
        icon: Download,
        title: "Zip export",
        description:
          "Download any project's complete source as a zip archive in one click. Your code is never locked in.",
      },
    ],
  },
  {
    heading: "Ship to production",
    features: [
      {
        icon: Rocket,
        title: "One-click deployment",
        description:
          "Deploy to Vercel, Netlify, or Railway with live build logs, deployment history, status tracking, and custom domains.",
      },
      {
        icon: Lock,
        title: "Auth & data built in",
        description:
          "Supabase authentication (email + Google) and Postgres with row-level security come pre-wired in every workspace.",
      },
      {
        icon: LayoutDashboard,
        title: "Project management",
        description:
          "A clean dashboard with search, duplicate, delete, usage analytics, and per-project deployment status.",
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="border-b">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 px-4 py-16 text-center md:py-24">
          <h1 className="text-4xl font-semibold tracking-tighter md:text-5xl">
            Features
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg text-balance">
            Everything between your idea and a deployed product — chat, agents,
            editor, preview, and shipping — in one workspace.
          </p>
        </div>
      </section>

      {featureGroups.map((group, index) => (
        <section
          key={group.heading}
          className={index % 2 === 1 ? "bg-muted/30 border-y" : undefined}
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-16">
            <h2 className="mb-8 text-2xl font-semibold tracking-tight">
              {group.heading}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.features.map((feature) => (
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
      ))}

      <section>
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">
            See it in action
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/signup">
                Start building free
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
