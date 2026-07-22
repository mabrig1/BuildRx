"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowDown, Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import { ChatMessageItem } from "@/components/chat/chat-message-item";
import { PromptSuggestions } from "@/components/chat/prompt-suggestions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorFrom } from "@/lib/health/client-error";
import { AGENT_LABELS } from "@/lib/agents/types";
import type { AgentEvent, AgentName } from "@/lib/agents/types";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";
import type { ChatMessage, ProjectStatus } from "@/types";

export function ChatPanel({
  projectId,
  projectStatus,
  initialMessages,
  insertText,
  onBuildDeployed,
  className,
}: {
  projectId: string;
  /** "draft" means this project has never been built — the next message
   *  (or a prompt seeded at project creation) runs the agent build
   *  pipeline instead of a plain conversational reply. */
  projectStatus: ProjectStatus;
  initialMessages: ChatMessage[];
  /** Text pushed into the composer from outside (e.g. template picker). */
  insertText?: { text: string; nonce: number } | null;
  onBuildDeployed?: (previewUrl: string | null) => void;
  className?: string;
}) {
  const {
    messages,
    isStreaming,
    setMessages,
    addMessage,
    appendToLastMessage,
    updateMessage,
    setStreaming,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [stickToBottom, setStickToBottom] = useState(true);
  const [hasBuilt, setHasBuilt] = useState(projectStatus !== "draft");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(initialMessages);
    return () => useChatStore.getState().clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // A project seeded with a prompt at creation lands here with exactly
  // one user message and no reply — nothing else ever triggers the
  // build, so it just sits there. Run it automatically, once per
  // project, the same as pressing "Start build" would.
  useEffect(() => {
    if (projectStatus !== "draft") return;
    const last = initialMessages[initialMessages.length - 1];
    if (!last || last.role !== "user") return;
    void runBuild(last.content, { announceUser: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (insertText) {
      setInput(insertText.text);
      textareaRef.current?.focus();
    }
  }, [insertText]);

  // Auto-scroll: follow new content while the user is near the bottom.
  useEffect(() => {
    if (stickToBottom && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, stickToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setStickToBottom(distanceFromBottom < 80);
  }, []);

  /**
   * Runs the six-agent build pipeline (the same request the "Build app"
   * panel sends) and renders its progress inline as the assistant's
   * reply. This is what makes describing an app in chat actually build
   * it, instead of only getting a conversational response back.
   */
  async function runBuild(
    prompt: string,
    { announceUser }: { announceUser: boolean }
  ) {
    if (isStreaming) return;
    setHasBuilt(true);
    setStickToBottom(true);

    if (announceUser) {
      addMessage({
        id: `temp-user-${Date.now()}`,
        projectId,
        userId: null,
        role: "user",
        content: prompt,
        createdAt: new Date().toISOString(),
      });
    }

    const assistantId = `temp-assistant-${Date.now()}`;
    addMessage({
      id: assistantId,
      projectId,
      userId: null,
      role: "assistant",
      content: "_Starting the build…_",
      createdAt: new Date().toISOString(),
    });
    setStreaming(true);

    const lineForAgent: Partial<Record<AgentName, number>> = {};
    const lines: string[] = [];
    const render = () => updateMessage(assistantId, lines.join("\n"));

    const watchdog = new AbortController();
    const watchdogTimer = setTimeout(() => watchdog.abort(), 285_000);

    try {
      const response = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt }),
        signal: watchdog.signal,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw apiErrorFrom(data, "Failed to start the build");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n");
        buffer = chunks.pop() ?? "";
        for (const raw of chunks) {
          if (!raw.trim()) continue;
          let event: AgentEvent;
          try {
            event = JSON.parse(raw) as AgentEvent;
          } catch {
            continue;
          }
          switch (event.type) {
            case "agent_start":
            case "agent_complete": {
              const icon = event.type === "agent_start" ? "⏳" : "✅";
              const line = `${icon} **${AGENT_LABELS[event.agent]}** — ${event.message}`;
              if (event.agent in lineForAgent) {
                lines[lineForAgent[event.agent]!] = line;
              } else {
                lineForAgent[event.agent] = lines.length;
                lines.push(line);
              }
              render();
              break;
            }
            case "workflow_complete":
              lines.push(
                `\n🚀 **Build complete** — ${event.fileCount} files generated.`
              );
              render();
              window.dispatchEvent(new CustomEvent("vfs-changed", { detail: {} }));
              onBuildDeployed?.(event.previewUrl);
              break;
            case "error": {
              const line = event.agent
                ? `❌ **${AGENT_LABELS[event.agent]}** — ${event.message}`
                : `❌ ${event.message}`;
              lines.push(event.suggestedFix ? `${line} — ${event.suggestedFix}` : line);
              render();
              toast.error(event.message, { description: event.suggestedFix ?? event.cause });
              break;
            }
          }
        }
      }
    } catch (error) {
      const isWatchdogAbort = error instanceof DOMException && error.name === "AbortError";
      const message = isWatchdogAbort
        ? "The build took too long and was stopped."
        : error instanceof Error
          ? error.message
          : "Failed to start the build";
      lines.push(`❌ ${message}`);
      render();
      toast.error(message);
    } finally {
      clearTimeout(watchdogTimer);
      setStreaming(false);
      textareaRef.current?.focus();
    }
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || isStreaming) return;

    if (!hasBuilt) {
      setInput("");
      await runBuild(trimmed, { announceUser: true });
      return;
    }

    setInput("");
    setStickToBottom(true);
    addMessage({
      id: `temp-user-${Date.now()}`,
      projectId,
      userId: null,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    });
    addMessage({
      id: `temp-assistant-${Date.now()}`,
      projectId,
      userId: null,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
    });
    setStreaming(true);

    // Backstop for the server's own timeout (270s): if the connection
    // itself hangs (dropped response, network issue) the UI must not
    // spin forever either.
    const watchdog = new AbortController();
    const watchdogTimer = setTimeout(() => watchdog.abort(), 285_000);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, content: trimmed }),
        signal: watchdog.signal,
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw apiErrorFrom(data, "Failed to send message");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToLastMessage(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      const isWatchdogAbort = error instanceof DOMException && error.name === "AbortError";
      const message = isWatchdogAbort
        ? "The AI took too long to respond and the request was stopped."
        : error instanceof Error
          ? error.message
          : "Failed to send message";
      const suggestedFix = isWatchdogAbort
        ? "Try a shorter or more specific request."
        : error instanceof Error && "suggestedFix" in error
          ? (error as { suggestedFix?: string }).suggestedFix
          : undefined;
      toast.error(message, { description: suggestedFix });
      appendToLastMessage(
        `*${message}${suggestedFix ? ` — ${suggestedFix}` : ""}*`
      );
    } finally {
      clearTimeout(watchdogTimer);
      setStreaming(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  const lastIndex = messages.length - 1;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 overflow-y-auto px-4 py-6"
      >
        {messages.length === 0 ? (
          <PromptSuggestions onSelect={(prompt) => void sendMessage(prompt)} />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-6 pb-4">
            {messages.map((message, index) => (
              <ChatMessageItem
                key={message.id}
                message={message}
                isStreaming={
                  isStreaming &&
                  index === lastIndex &&
                  message.role === "assistant"
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Jump to bottom */}
      {!stickToBottom && messages.length > 0 ? (
        <div className="relative">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="absolute -top-12 left-1/2 size-8 -translate-x-1/2 rounded-full shadow-md"
            onClick={() => {
              setStickToBottom(true);
              scrollRef.current?.scrollTo({
                top: scrollRef.current.scrollHeight,
              });
            }}
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="size-4" />
          </Button>
        </div>
      ) : null}

      {/* Composer */}
      <div className="border-t p-3">
        <form
          className="bg-muted/30 mx-auto flex max-w-2xl items-end gap-2 rounded-xl border p-2 focus-within:ring-[3px] focus-within:ring-ring/20"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI to build or change something…"
            rows={1}
            className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
            disabled={isStreaming}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0"
            disabled={isStreaming || input.trim().length === 0}
            aria-label="Send message"
          >
            {isStreaming ? (
              <Loader2 className="animate-spin" />
            ) : (
              <SendHorizontal />
            )}
          </Button>
        </form>
        <p className="text-muted-foreground mt-1.5 text-center text-xs">
          Enter to send · Shift+Enter for a new line
        </p>
      </div>
    </div>
  );
}
