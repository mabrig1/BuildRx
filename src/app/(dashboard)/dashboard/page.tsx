import type { Metadata } from "next";
import Link from "next/link";
import { Bot, FolderKanban, Plus, Rocket } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Dashboard",
};

const stats = [
  { label: "Projects", value: "0", icon: FolderKanban },
  { label: "AI messages this month", value: "0", icon: Bot },
  { label: "Deployments", value: "0", icon: Rocket },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="An overview of your projects and activity."
      >
        <Button asChild>
          <Link href="/projects">
            <Plus />
            New project
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="gap-2">
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <stat.icon className="size-4" />
                {stat.label}
              </CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {stat.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Get started</CardTitle>
          <CardDescription>
            Create your first project and describe the app you want to build.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-12 text-center">
            <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
              <Bot className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No projects yet</p>
              <p className="text-muted-foreground text-sm">
                Start a conversation with AI to build your first app.
              </p>
            </div>
            <Button asChild>
              <Link href="/projects">
                <Plus />
                Create project
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
