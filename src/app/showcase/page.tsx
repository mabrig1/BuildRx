import type { Metadata } from "next";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { curatedDesignShowcase } from "@/lib/agents/design-showcase";
import { DesignShowcaseGallery } from "@/components/marketing/design-showcase-gallery";

export const metadata:Metadata={
  title:"Explore Real BuildRx Design Kits | MABRIG Technologies",
  description:"Try seven interactive app design templates: courier, retail, restaurant, school, bookings, research and CRM. Free demo; no checkout or live records.",
};

export default function DesignShowcasePage() {
  const samples=curatedDesignShowcase();
  return <MarketingShell>
    <main className="mx-auto max-w-[1510px] px-4 py-12 sm:px-6 md:py-20">
      <div className="mx-auto mb-11 max-w-3xl text-center">
        <p className="text-primary text-xs font-bold uppercase tracking-[.2em]">Template-first AI building</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">The first screen should make people say wow.</h1>
        <p className="text-muted-foreground mt-4 text-base">Explore seven professionally structured, editable app designs before creating an account. Try desktop and mobile views; click the real demo controls.</p>
      </div>
      <DesignShowcaseGallery samples={samples}/>
    </main>
  </MarketingShell>;
}
