import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { StarterVault } from "@/components/projects/starter-vault";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Beginner App Template Vault | BuildRx",
  description: "Start with approved, editable source code from BuildRx or immutable MIT-licensed GitHub examples.",
};

export default function TemplatesPage() {
  return <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
    <PageHeader title="Starter App Template Vault"
      description="Choose a real code template, copy it into your project, and make it yours. No terminal or GitHub account required.">
      <Button variant="outline" asChild><Link href="/projects">My projects</Link></Button>
    </PageHeader>
    <StarterVault />
  </div>;
}
