"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bug, CheckCircle2, MessageCircle, Rocket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { brandConfig } from "@/lib/constants";

const steps = [
  {
    title: "Describe your idea",
    heading: "Tell BuildRx what you want in everyday language",
    summary: "Start with a supermarket, school, booking system, or your own idea. The new guide turns three simple answers into a fuller app brief.",
    action: "Choose users, main job and design",
    illustration: "I want a supermarket app where customers can see products and place orders, while the shop manager tracks inventory.",
  },
  {
    title: "Build the app",
    heading: "BuildRx creates a real code project",
    summary: "The existing eleven-agent pipeline plans pages, creates application code, checks known defects, and attempts bounded repairs. A source check is not a live runtime test.",
    action: "AI source generation and checks",
    illustration: "Homepage  •  Catalog  •  Product details  •  Orders  •  Admin dashboard",
  },
  {
    title: "Check and repair",
    heading: "App Doctor tells you what needs attention",
    summary: "On an authenticated saved project, App Doctor checks actual files and shows a first actionable blocker, such as a missing import or unfinished starter page.",
    action: "Review findings, then approve a repair",
    illustration: "Example: Homepage still shows Hello World → Review AI repair → Recheck saved source",
  },
  {
    title: "Know what comes next",
    heading: "From your source code to a tested public app",
    summary: "A guided checklist helps you prepare GitHub, choose a database, use Vercel or Cloudflare, and test real functionality. Publishing remains user-controlled.",
    action: "GitHub → Database → Hosting → Live tests",
    illustration: "Do not advertise a public app before confirming its routes, sign-in and saved records.",
  },
] as const;

export function BuildRxProductTour() {
  const [selected, setSelected] = useState(0);
  const step = steps[selected];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {steps.map((item, index) => (
          <button key={item.title} type="button" aria-pressed={selected === index}
            onClick={() => setSelected(index)}
            className={"rounded-xl border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
              (selected === index ? "border-primary bg-primary/10" : "hover:border-primary/40 hover:bg-muted/40")}>
            <span className="text-muted-foreground text-xs">Step {index + 1}</span>
            <strong className="mt-1 block text-sm">{item.title}</strong>
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> BuildRx product walkthrough
          </span>
          <Badge variant="outline">Illustrative demo · No live build</Badge>
        </div>
        <div className="grid gap-6 p-5 md:grid-cols-[1.1fr_.9fr] md:p-8">
          <div className="space-y-4">
            <p className="text-primary text-xs font-semibold uppercase tracking-wider">{step.title}</p>
            <h3 className="text-2xl font-semibold tracking-tight">{step.heading}</h3>
            <p className="text-muted-foreground leading-relaxed">{step.summary}</p>
            <div className="flex flex-wrap gap-2">
              {selected === 0 ? <Badge variant="secondary"><MessageCircle className="size-3.5" /> Plain language</Badge> : null}
              {selected === 1 ? <Badge variant="secondary"><CheckCircle2 className="size-3.5" /> Bounded source checks</Badge> : null}
              {selected === 2 ? <Badge variant="secondary"><Bug className="size-3.5" /> Diagnoses first blocker</Badge> : null}
              {selected === 3 ? <Badge variant="secondary"><Rocket className="size-3.5" /> Guided launch</Badge> : null}
              <Badge variant="outline">{step.action}</Badge>
            </div>
          </div>
          <div className="flex min-h-48 flex-col justify-center rounded-xl border bg-background p-5">
            <p className="text-muted-foreground mb-3 text-xs uppercase tracking-wide">Example screen content</p>
            <p className="text-base font-medium">{step.illustration}</p>
            <div className="mt-5 flex items-center gap-2">
              {steps.map((_, i) => <span key={i} className={"h-1.5 flex-1 rounded-full " + (i <= selected ? "bg-primary" : "bg-muted")}/>)}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/20 px-5 py-4">
          <p className="text-muted-foreground max-w-sm text-xs">This tour illustrates the workflow; it does not simulate payment, deploy an app or test any customer database.</p>
          <div className="flex gap-2">
            {selected > 0 ? <Button variant="outline" size="sm" onClick={() => setSelected(i => i - 1)}>Previous</Button> : null}
            {selected < steps.length - 1 ?
              <Button size="sm" onClick={() => setSelected(i => i + 1)}>Next <ArrowRight className="size-3.5" /></Button> :
              <Button size="sm" asChild><Link href="/signup">Build my own app <ArrowRight className="size-3.5" /></Link></Button>}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild><Link href="/signup">Start my project <ArrowRight className="size-4" /></Link></Button>
        <Button variant="outline" asChild>
          <a href={brandConfig.contacts.whatsapp.href} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="size-4" /> Ask on WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
