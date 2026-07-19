"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { ModelSelector } from "@/components/ai/model-selector";
import { Markdown } from "@/components/chat/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ProviderOption {
  id: string;
  label: string;
  configured: boolean;
  defaultModel: string;
  models: { id: string; label: string }[];
}

interface Citation {
  documentId: string;
  documentName: string;
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

export function KnowledgeBaseChat({ knowledgeBaseId }: { knowledgeBaseId: string }) {
  const [providers, setProviders] = useState<ProviderOption[] | null>(null);
  const [model, setModel] = useState<{ provider: string; model: string } | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai/providers")
      .then((res) => res.json())
      .then((data) => {
        setProviders(data.providers);
        const configured = (data.providers as ProviderOption[]).find((p) => p.configured);
        if (configured) setModel({ provider: configured.id, model: configured.defaultModel });
      })
      .catch(() => toast.error("Couldn't load AI providers."));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function handleSend() {
    if (!message.trim() || !model || isSending) return;

    const question = message.trim();
    setTurns((prev) => [...prev, { role: "user", content: question }]);
    setMessage("");
    setIsSending(true);

    try {
      const response = await fetch(`/api/rag/knowledge-bases/${knowledgeBaseId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, provider: model.provider, model: model.model }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Chat failed");
      setTurns((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, citations: data.citations },
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chat failed");
      setTurns((prev) => prev.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {providers ? (
        <ModelSelector providers={providers} value={model} onChange={setModel} />
      ) : (
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
      )}

      <Card className="flex-1 gap-0 overflow-hidden p-0">
        <CardContent className="flex h-96 flex-col gap-4 overflow-y-auto p-4">
          {turns.length === 0 ? (
            <p className="text-muted-foreground m-auto text-center text-sm">
              Ask a question — answers are grounded in this knowledge base&apos;s documents, with
              citations.
            </p>
          ) : (
            turns.map((turn, i) => (
              <div key={i} className={turn.role === "user" ? "self-end" : "self-start"}>
                <div
                  className={
                    turn.role === "user"
                      ? "bg-primary text-primary-foreground max-w-md rounded-lg px-3 py-2 text-sm"
                      : "bg-muted max-w-lg rounded-lg px-3 py-2 text-sm"
                  }
                >
                  {turn.role === "assistant" ? (
                    <Markdown content={turn.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{turn.content}</p>
                  )}
                </div>
                {turn.citations && turn.citations.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {turn.citations.map((citation) => (
                      <Badge key={citation.documentId} variant="outline" className="text-xs">
                        {citation.documentName}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
          {isSending ? (
            <Loader2 className="text-muted-foreground size-4 animate-spin self-start" />
          ) : null}
          <div ref={bottomRef} />
        </CardContent>
      </Card>

      <div className="flex items-end gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Ask about these documents…"
          rows={2}
          className="resize-none"
        />
        <Button onClick={() => void handleSend()} disabled={isSending || !message.trim()}>
          {isSending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
    </div>
  );
}
