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
  // Only a confirmed successful build ("ready") switches into plain
  // conversational mode. "draft" (never attempted), "generating" (a
  // prior attempt was killed mid-flight and never reached its own error
  // handling), and "error" (a prior attempt failed cleanly) all leave
  // the project eligible for the next message to (re)try a real build —
  // otherwise a single failed attempt (e.g. a provider timeout) would
  // strand the project in chat-only mode forever with no way to retry.
  const [hasBuilt, setHasBuilt] = useState(projectStatus === "ready");
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
    /** Steps that fell back, so the finish can say so instead of "complete". */
    const degraded: string[] = [];
    const render = () => updateMessage(assistantId, lines.join("\n"));

    // Idle watchdog, not a total-time limit. The build streams an event
    // at every step boundary, so silence is what indicates a dead
    // connection — elapsed time doesn't. A build that is still reporting
    // progress must never be cut off by its own client: that is what
    // turned a working build into "The build took too long and was
    // stopped" while the server was still generating files.
    const IDLE_LIMIT_MS = 120_000;
    const watchdog = new AbortController();
    let watchdogTimer = setTimeout(() => watchdog.abort(), IDLE_LIMIT_MS);
    const keepAlive = () => {
      clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => watchdog.abort(), IDLE_LIMIT_MS);
    };

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
        keepAlive();
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
            case "heartbeat": {
              // Keeps the running step's line moving so a long model
              // call reads as work in progress, not a hang.
              const index = lineForAgent[event.agent];
              if (index !== undefined) {
                const seconds = Math.round(event.elapsedMs / 1000);
                lines[index] = lines[index].replace(/ \(\d+s\)$/, "") + ` (${seconds}s)`;
                render();
              }
              break;
            }
            case "verification": {
              const icons = { pass: "✅", warn: "⚠️", fail: "❌" } as const;
              lines.push(
                [
                  "\n**Verification**",
                  ...event.items.map(
                    (item) =>
                      `${icons[item.status]} ${item.label}${item.detail ? ` — ${item.detail}` : ""}`
                  ),
                ].join("\n")
              );
              render();
              break;
            }
            case "workflow_complete":
              // "Build complete" after four steps silently fell back to
              // scaffolds is how you end up with a confused user and an
              // app that isn't what they asked for. Say which one it is.
              lines.push(
                !event.verified
                  ? `\n❌ **Build saved but not released** — ${event.fileCount} files were written, but the functional verification gate failed. Fix the failed checks above and run the build again.`
                  : degraded.length === 0
                  ? `\n🚀 **Build complete** — ${event.fileCount} files generated.`
                  : [
                      `\n⚠️ **Build finished with ${degraded.length} step(s) degraded** — ${event.fileCount} files written, but parts of this app are built-in scaffolding rather than generated from your description:`,
                      ...degraded.map((item) => `- ${item}`),
                      "\nSee the **Fix** notes above, then run the build again.",
                    ].join("\n")
              );
              render();
              if (!event.verified) {
                setHasBuilt(false);
                toast.error("Build did not pass functional verification", {
                  description: "Review the failed checks above, then run it again.",
                });
              } else if (degraded.length > 0) {
                toast.warning(
                  `${degraded.length} build step(s) fell back to scaffolds`,
                  { description: "See the build log for why, and how to fix it." }
                );
              }
              window.dispatchEvent(new CustomEvent("vfs-changed", { detail: {} }));
              onBuildDeployed?.(event.previewUrl);
              break;
            case "agent_degraded": {
              // A degraded step still produces files, so it must not read
              // like a success. Say what was lost, why, and what to do —
              // "the model call failed" on its own just leaves the user
              // guessing whether they got an app or a template.
              degraded.push(event.message);
              const who = event.agent ? `**${AGENT_LABELS[event.agent]}** — ` : "";
              lines.push(
                [
                  `\n⚠️ ${who}${event.message}`,
                  `> **Why:** ${event.cause}`,
                  `> **Fix:** ${event.suggestedFix}`,
                ].join("\n")
              );
              render();
              break;
            }
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
      // The build keeps running on the server even after this connection
      // drops, so this reports a lost connection — not a lost build.
      const message = isWatchdogAbort
        ? "Lost contact with the build (no progress for two minutes). It may still be finishing — refresh in a moment to see the files."
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

    // Idle backstop: a reply that is still streaming tokens is alive, so
    // only silence should end it. Without this, a long answer was cut
    // off mid-sentence purely for taking a while.
    const IDLE_LIMIT_MS = 120_000;
    const watchdog = new AbortController();
    let watchdogTimer = setTimeout(() => watchdog.abort(), IDLE_LIMIT_MS);
    const keepAlive = () => {
      clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => watchdog.abort(), IDLE_LIMIT_MS);
    };

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
        keepAlive();
        appendToLastMessage(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      const isWatchdogAbort = error instanceof DOMException && error.name === "AbortError";
      const message = isWatchdogAbort
        ? "The AI stopped responding and the request was ended."
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
