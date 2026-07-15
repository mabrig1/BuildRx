import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Monitor, RefreshCw, Smartphone, Tablet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Live Preview",
};

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft />
            Back to workspace
          </Link>
        </Button>
        <Badge variant="secondary" className="ml-2">
          Live Preview
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Desktop viewport">
            <Monitor className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Tablet viewport">
            <Tablet className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Mobile viewport">
            <Smartphone className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Refresh preview">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </header>

      <main className="bg-muted/40 flex flex-1 items-center justify-center p-6">
        <div className="bg-background flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed text-center">
          <Monitor className="text-muted-foreground size-10" />
          <div className="space-y-1">
            <p className="font-medium">Preview not available yet</p>
            <p className="text-muted-foreground text-sm">
              Your generated app will render here once it&apos;s built.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
