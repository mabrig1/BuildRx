import type { Metadata } from "next";
import { Bot, SendHorizontal, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

export const metadata: Metadata = {
  title: "AI Chat",
};

const suggestions = [
  "Build a landing page for a coffee shop",
  "Create a task tracker with due dates",
  "Make a personal portfolio with a blog",
];

export default function ChatPage() {
  return (
    <div className="mx-auto flex h-[calc(100svh-8.5rem)] w-full max-w-3xl flex-col gap-4">
      <ScrollArea className="flex-1">
        <div className="flex h-full flex-col items-center justify-center gap-6 py-16 text-center">
          <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
            <Bot className="size-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              What do you want to build?
            </h1>
            <p className="text-muted-foreground text-sm">
              Describe your app and AI will start building it with you.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => (
              <Badge
                key={suggestion}
                variant="outline"
                className="cursor-pointer px-3 py-1.5"
              >
                <Sparkles className="size-3" />
                {suggestion}
              </Badge>
            ))}
          </div>
        </div>
      </ScrollArea>

      <Card className="py-2">
        <CardContent className="px-2">
          <div className="flex items-end gap-2">
            <Textarea
              placeholder="Describe the app you want to build…"
              className="min-h-12 resize-none border-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <Button size="icon" className="mb-1 shrink-0" aria-label="Send">
              <SendHorizontal />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
