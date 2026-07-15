import type { Metadata } from "next";
import { FolderKanban, Plus } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Projects",
};

export default function ProjectsPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Create, manage, and deploy your AI-built apps."
      >
        <Button>
          <Plus />
          New project
        </Button>
      </PageHeader>

      <Input placeholder="Search projects…" className="max-w-sm" />

      <Card>
        <CardContent>
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
            <div className="bg-muted flex size-12 items-center justify-center rounded-full">
              <FolderKanban className="text-muted-foreground size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">No projects yet</p>
              <p className="text-muted-foreground text-sm">
                Projects you create will appear here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
