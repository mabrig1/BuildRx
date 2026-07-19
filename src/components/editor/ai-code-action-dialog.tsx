"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ModelSelector } from "@/components/ai/model-selector";
import { Markdown } from "@/components/chat/markdown";
import { setupMonaco } from "@/components/editor/monaco-setup";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const MonacoDiffEditor = dynamic(
  async () => {
    await setupMonaco();
    return (await import("@monaco-editor/react")).DiffEditor;
  },
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading diff…
      </div>
    ),
  }
);

export type AiCodeAction = "explain" | "debug" | "refactor" | "tests" | "docs";

const ACTION_LABELS: Record<AiCodeAction, string> = {
  explain: "Explain code",
  debug: "Debug code",
  refactor: "Refactor code",
  tests: "Generate tests",
  docs: "Generate documentation",
};

const AUTO_RUN: Record<AiCodeAction, boolean> = {
  explain: true,
  debug: false,
  refactor: false,
  tests: true,
  docs: true,
};

interface ProviderOption {
  id: string;
  label: string;
  configured: boolean;
  defaultModel: string;
  models: { id: string; label: string }[];
}

interface ActionResult {
  explanation?: string;
  code?: string | null;
  testCode?: string;
  suggestedFileName?: string;
}

export function AiCodeActionDialog({
  action,
  open,
  onOpenChange,
  filePath,
  code,
  language,
  projectId,
  onApply,
  onSaveAsNewFile,
}: {
  action: AiCodeAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string;
  code: string;
  language: string;
  projectId: string;
  onApply: (newContent: string) => void;
  onSaveAsNewFile?: (path: string, content: string) => Promise<void>;
}) {
  const { resolvedTheme } = useTheme();
  const [providers, setProviders] = useState<ProviderOption[] | null>(null);
  const [model, setModel] = useState<{ provider: string; model: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [instruction, setInstruction] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setErrorMessage("");
    setInstruction("");
    fetch("/api/ai/providers")
      .then((res) => res.json())
      .then((data) => {
        setProviders(data.providers);
        const configured = (data.providers as ProviderOption[]).find((p) => p.configured);
        if (configured) {
          setModel({ provider: configured.id, model: configured.defaultModel });
        }
      })
      .catch(() => toast.error("Couldn't load AI providers."));
  }, [open]);

  useEffect(() => {
    if (open && model && AUTO_RUN[action] && !result && !isRunning) {
      void run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, model]);

  async function run() {
    if (!model) return;
    if (action === "refactor" && !instruction.trim()) {
      toast.error("Describe what to refactor first.");
      return;
    }

    setIsRunning(true);
    try {
      const endpoint = `/api/ai/code/${action === "tests" ? "tests" : action}`;
      const body: Record<string, unknown> = {
        code,
        language,
        provider: model.provider,
        model: model.model,
        projectId,
      };
      if (action === "debug" && errorMessage.trim()) body.errorMessage = errorMessage.trim();
      if (action === "refactor") body.instruction = instruction.trim();
      if (action === "tests") body.filePath = filePath;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Request failed");
      setResult(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleApply() {
    if (!result?.code) return;
    onApply(result.code);
    onOpenChange(false);
    toast.success("Applied — remember to save.");
  }

  async function handleSaveTests() {
    if (!result?.testCode || !onSaveAsNewFile) return;
    const path = result.suggestedFileName ?? `${filePath}.test.ts`;
    setIsSaving(true);
    try {
      await onSaveAsNewFile(path, result.testCode);
      onOpenChange(false);
      toast.success(`Saved ${path}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save test file");
    } finally {
      setIsSaving(false);
    }
  }

  const needsInputFirst = (action === "debug" || action === "refactor") && !result;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            {ACTION_LABELS[action]}
          </DialogTitle>
          <DialogDescription className="truncate font-mono text-xs">{filePath}</DialogDescription>
        </DialogHeader>

        {providers ? (
          <ModelSelector providers={providers} value={model} onChange={setModel} disabled={isRunning} />
        ) : (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        )}

        {needsInputFirst ? (
          <div className="grid gap-3">
            {action === "debug" ? (
              <Textarea
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                placeholder="Optional: paste the error message or describe the symptom…"
                rows={3}
              />
            ) : (
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder='What should change? e.g. "extract this into smaller functions" or "add error handling"'
                rows={3}
              />
            )}
            <Button onClick={() => void run()} disabled={isRunning} className="w-fit">
              {isRunning ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Run
            </Button>
          </div>
        ) : null}

        {isRunning && !needsInputFirst ? (
          <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2 py-12 text-sm">
            <Loader2 className="size-5 animate-spin" />
            Working…
          </div>
        ) : null}

        {result ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            {result.explanation ? <Markdown content={result.explanation} /> : null}

            {action === "explain" ? null : action === "tests" ? (
              <pre className="bg-muted/50 max-h-80 overflow-auto rounded-md border p-3 text-xs">
                {result.testCode}
              </pre>
            ) : result.code ? (
              <div className="h-80 overflow-hidden rounded-md border">
                <MonacoDiffEditor
                  original={code}
                  modified={result.code}
                  language={language}
                  theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
                  options={{ fontSize: 12, minimap: { enabled: false }, readOnly: true }}
                />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No code change to show — see the explanation above.
              </p>
            )}
          </div>
        ) : null}

        <DialogFooter>
          {action === "tests" && result?.testCode ? (
            <Button onClick={() => void handleSaveTests()} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Check />}
              Save as {result.suggestedFileName ?? "test file"}
            </Button>
          ) : null}
          {(action === "debug" || action === "refactor" || action === "docs") && result?.code ? (
            <Button onClick={() => void handleApply()}>
              <Check />
              Apply to file
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
