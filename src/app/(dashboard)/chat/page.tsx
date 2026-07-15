import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bot } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "AI Chat",
};

/**
 * The AI chat lives in a project workspace. This route sends the user to
 * their most recent project, or prompts them to create one.
 */
export default async function ChatPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect("/login?next=/chat");
    }

    const { data: latest } = await supabase
      .from("projects")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      redirect(`/projects/${latest.id}`);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        title="AI Chat"
        description="Chat with AI inside a project workspace."
      />
      <Card>
        <CardContent>
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
              <Bot className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="font-medium">Start your first conversation</p>
              <p className="text-muted-foreground text-sm">
                Create a project to open the AI chat workspace.
              </p>
            </div>
            <CreateProjectDialog />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
