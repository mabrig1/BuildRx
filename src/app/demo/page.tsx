import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { BuildRxProductTour } from "@/components/marketing/buildrx-product-tour";
import { Badge } from "@/components/ui/badge";
export const metadata: Metadata = {
  title: "See How BuildRx Works | MABRIG Technologies",
  description: "Explore an honest interactive walkthrough: describe an app, build with AI, check errors with App Doctor and learn what to do after creating the app.",
};

export default function DemoPage() {
  return <MarketingShell>
    <main className="mx-auto max-w-6xl space-y-9 px-4 py-12 md:py-20">
      <div className="mx-auto max-w-3xl space-y-3 text-center">
        <Badge variant="secondary"><Sparkles className="size-3" /> How BuildRx works</Badge>
        <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">From a simple idea to an app you can verify</h1>
        <p className="text-muted-foreground text-lg">
          Explore the workflow before creating an account. This is an interactive walkthrough of the real product journey, not a fabricated live customer app.
        </p>
      </div>
      <BuildRxProductTour />
    </main>
  </MarketingShell>;
}
