import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PreviewPanel } from "@/components/preview/preview-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFileSystem } from "@/lib/files/manager";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Live Preview",
};

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  let previewUrl: string | null = null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("preview_url")
      .eq("id", projectId)
      .maybeSingle();
    previewUrl = project?.preview_url ?? null;
  } else {
    // Demo mode: point at the in-memory preview when it exists.
    const file = await getFileSystem(projectId)
      .read("preview/index.html")
      .catch(() => null);
    previewUrl = file ? `/api/preview/${projectId}` : null;
  }

  return (
    <div className="flex h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}`}>
            <ArrowLeft />
            Back to workspace
          </Link>
        </Button>
        <Badge variant="secondary">Live Preview</Badge>
      </header>
      <PreviewPanel
        projectId={projectId}
        previewUrl={previewUrl}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
