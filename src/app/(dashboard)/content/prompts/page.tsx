import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PromptLibrary } from "@/components/content/prompt-library";
import { PageHeader } from "@/components/layout/page-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Prompt Library" };

export default async function PromptLibraryPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/content/prompts");
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Prompt Library"
        description="Save reusable prompts, or start from a template."
      />
      <PromptLibrary />
    </div>
  );
}
