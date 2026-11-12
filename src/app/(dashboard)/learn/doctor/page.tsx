import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { BuildDoctor } from "@/components/learn/build-doctor";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Build Doctor",
  description: "Understand common CI, Next.js, Vercel and Cloudflare errors with private, local-only guidance.",
};
export const dynamic = "force-dynamic";

export default async function BuildDoctorPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/learn/doctor");
  }
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <PageHeader
        title="BuildRx Build Doctor"
        description="Find the first useful failure, understand what it means, and choose the smallest reversible repair."
      >
        <Badge variant="secondary" className="gap-1.5">
          <ShieldCheck className="size-3.5" /> Local-only log analysis
        </Badge>
      </PageHeader>
      <BuildDoctor />
    </div>
  );
}
