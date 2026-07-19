import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { ContentForm } from "@/components/content/content-form";
import { PageHeader } from "@/components/layout/page-header";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New content" };

export default async function NewContentPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/content/new");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader title="New content" description="Pick a writer and fill in the details." />
      <Suspense>
        <ContentForm />
      </Suspense>
    </div>
  );
}
