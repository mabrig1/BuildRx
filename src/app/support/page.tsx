import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { SupportRequest } from "@/components/support/support-request";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Support Center | BuildRx",
  description: "Get help with BuildRx AI app building, the paid Engineering Academy, coding labs, deployment, billing and account recovery.",
};

export default function SupportPage() {
  return (
    <MarketingShell>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 md:py-16">
        <div className="max-w-3xl space-y-3">
          <Badge variant="secondary" className="gap-2"><MessageCircle className="size-3.5" /> Support tickets, WhatsApp & email</Badge>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">BuildRx Support Center</h1>
          <p className="text-muted-foreground text-lg">
            Need help building an app, joining the Software Engineering Academy, troubleshooting a release,
            or recovering access? Sign in to create a tracked ticket, or contact MABRIG Technologies on WhatsApp.
          </p>
        </div>
        <SupportRequest />
      </div>
    </MarketingShell>
  );
}
