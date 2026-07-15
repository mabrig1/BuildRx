"use client";

import { Bot, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const suggestions = [
  "Build a landing page for a coffee shop",
  "Create a task tracker with due dates",
  "Make a personal portfolio with a blog",
  "Build a recipe collection app",
];

export function PromptSuggestions({
  onSelect,
}: {
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
        <Bot className="size-7" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          What do you want to build?
        </h2>
        <p className="text-muted-foreground text-sm">
          Describe your app and AI will start building it with you.
        </p>
      </div>
      <div className="flex max-w-md flex-wrap justify-center gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onSelect(suggestion)}
            className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px]"
          >
            <Badge
              variant="outline"
              className="hover:bg-accent cursor-pointer px-3 py-1.5 transition-colors"
            >
              <Sparkles className="size-3" />
              {suggestion}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
