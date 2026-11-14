"use client";

import { useState } from "react";
import { Sparkles, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EASY_BRIEF_DEFAULT, canComposeEasyBrief, composeEasyBrief, suggestedProjectName,
  type DataMode, type DesignMode, type EasyBriefInput,
} from "@/lib/projects/easy-brief";

export function EasyBriefBuilder({
  onUse,
}: {
  onUse: (result: { name: string; description: string; prompt: string }) => void;
}) {
  const [answer, setAnswer] = useState<EasyBriefInput>(EASY_BRIEF_DEFAULT);
  const update = <K extends keyof EasyBriefInput>(key: K, value: EasyBriefInput[K]) =>
    setAnswer(old => ({ ...old, [key]: value }));
  const valid = canComposeEasyBrief(answer);

  function generate() {
    try {
      onUse({
        name: suggestedProjectName(answer.idea),
        description: answer.idea.trim(),
        prompt: composeEasyBrief(answer),
      });
      toast.success("Your app specification is ready. Review it below, then create the project.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Complete your idea first");
    }
  }

  return (
    <details className="rounded-xl border border-primary/30 bg-primary/5 p-4" open>
      <summary className="cursor-pointer text-sm font-semibold">
        <span className="inline-flex items-center gap-2"><Sparkles className="size-4 text-primary" /> New here? Build your app idea in three easy answers</span>
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-muted-foreground text-sm">
          You don&apos;t need to know coding, databases or how to write AI prompts.
          Describe the real job your app must do; BuildRx will prepare an editable app brief.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="easy-idea">1. What app do you want?</Label>
          <Textarea id="easy-idea" value={answer.idea} maxLength={500} rows={2}
            placeholder="I want a supermarket app that shows goods and lets people order..."
            onChange={e => update("idea", e.target.value)} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="easy-audience">2. Who will use it?</Label>
            <Input id="easy-audience" value={answer.audience} maxLength={150}
              placeholder="Customers and store manager"
              onChange={e => update("audience", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="easy-job">3. What should they be able to do?</Label>
            <Input id="easy-job" value={answer.mainJob} maxLength={500}
              placeholder="Browse products, order, manage stock"
              onChange={e => update("mainJob", e.target.value)} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="easy-data">Does the app save information?</Label>
            <select id="easy-data" className="border-input bg-background h-10 rounded-md border px-2 text-sm"
              value={answer.dataMode} onChange={e => update("dataMode", e.target.value as DataMode)}>
              <option value="records">Yes, customer or business records</option>
              <option value="orders">Yes, products and orders</option>
              <option value="accounts">Yes, users and profiles</option>
              <option value="none">No, just pages and information</option>
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="easy-design">Preferred visual style</Label>
            <select id="easy-design" className="border-input bg-background h-10 rounded-md border px-2 text-sm"
              value={answer.design} onChange={e => update("design", e.target.value as DesignMode)}>
              <option value="modern">Modern and premium</option>
              <option value="clean">Simple and clean</option>
              <option value="bold">Bold and colorful</option>
            </select>
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
          <input className="mt-1" type="checkbox" checked={answer.payments}
            onChange={e => update("payments", e.target.checked)} />
          <span>This app should eventually accept online payments
            <span className="text-muted-foreground block text-xs">BuildRx will prepare provider-ready code, not activate payments without verified setup.</span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={generate} disabled={!valid}>
            <WandSparkles className="size-4" /> Create my app plan
          </Button>
          <p className="text-muted-foreground text-xs">No AI credit is used to prepare this brief. You can edit it before creating the project.</p>
        </div>
      </div>
    </details>
  );
}
