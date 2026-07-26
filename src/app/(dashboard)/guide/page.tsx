import type { Metadata } from "next";
import { BookOpen, Lightbulb } from "lucide-react";

import { CopyPromptButton } from "@/components/guide/copy-prompt-button";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GUIDE_SECTIONS, PROMPT_EXAMPLES } from "@/lib/guide-content";

export const metadata: Metadata = {
  title: "Guide",
  description: "How to describe an app so the agent team can build it well.",
};

export default function GuidePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Building apps"
        description="What the agent team does, how to describe an app so it builds well, and how to read the result."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="size-4" />
            The short version
          </CardTitle>
          <CardDescription>
            Name your pages, components, and tables in your first message. Keep it
            to 4 pages, 6 components, and 4 tables — then grow the app from there.
          </CardDescription>
        </CardHeader>
      </Card>

      {GUIDE_SECTIONS.map((section) => (
        <Card key={section.id} id={section.id}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
            <CardDescription>{section.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
              {section.points.map((point) => (
                <li key={point} className="flex gap-2">
                  <span aria-hidden className="text-muted-foreground/60 select-none">
                    •
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" />
            Prompts you can copy
          </CardTitle>
          <CardDescription>
            Each of these is shaped to the pipeline&apos;s limits. Paste one as the
            first message in a new project, then edit it to fit your idea.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {PROMPT_EXAMPLES.map((example) => (
            <div key={example.title} className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{example.title}</p>
                  <p className="text-muted-foreground text-xs">{example.useCase}</p>
                </div>
                <CopyPromptButton prompt={example.prompt} label={example.title} />
              </div>
              <pre className="bg-muted text-muted-foreground max-w-full overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                {example.prompt}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
