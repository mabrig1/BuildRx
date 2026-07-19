"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Settings, Share2, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Markdown } from "@/components/chat/markdown";
import { AgentSettingsDialog } from "@/components/agents/agent-settings-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface AgentDetail {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  icon: string;
  system_prompt: string;
  provider: string;
  model: string;
  tools: string[];
  visibility: "private" | "unlisted" | "public";
  share_slug: string | null;
}

interface Conversation {
  id: string;
  title: string | null;
  updated_at: string;
}

interface ToolStep {
  type: "tool_call";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result: string;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: ToolStep[];
}

export function AgentWorkspace({
  agent,
  isOwner,
}: {
  agent: AgentDetail;
  isOwner: boolean;
}) {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function loadConversations() {
    const response = await fetch(`/api/agents/${agent.id}/conversations`);
    const data = await response.json().catch(() => null);
    if (response.ok) setConversations(data.conversations);
  }

  async function openConversation(id: string) {
    setActiveId(id);
    setIsLoadingThread(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}/conversations/${id}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to load conversation");
      setMessages(rowsToDisplay(data.messages));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load conversation");
    } finally {
      setIsLoadingThread(false);
    }
  }

  function startNewConversation() {
    setActiveId(null);
    setMessages([]);
  }

  async function deleteConversation(id: string) {
    const response = await fetch(`/api/agents/${agent.id}/conversations/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Failed to delete conversation");
      return;
    }
    if (activeId === id) startNewConversation();
    void loadConversations();
  }

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setInput("");
    setIsSending(true);
    setMessages((current) => [
      ...current,
      { id: `temp-user-${Date.now()}`, role: "user", content: trimmed },
    ]);

    try {
      const response = await fetch(`/api/agents/${agent.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversationId: activeId ?? undefined }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "The agent couldn't respond.");

      setMessages((current) => [
        ...current,
        {
          id: `temp-assistant-${Date.now()}`,
          role: "assistant",
          content: data.text,
          steps: data.steps,
        },
      ]);

      if (!activeId) {
        setActiveId(data.conversationId);
        void loadConversations();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The agent couldn't respond.");
      setMessages((current) => current.slice(0, -1));
      setInput(trimmed);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
      {/* Conversations sidebar */}
      <div className="hidden min-h-0 flex-col gap-2 md:flex">
        <Button variant="outline" size="sm" onClick={startNewConversation}>
          <Plus />
          New chat
        </Button>
        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-1 pr-2">
            {(conversations ?? []).map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => void openConversation(conversation.id)}
                className={cn(
                  "group flex items-center justify-between gap-1 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  activeId === conversation.id ? "bg-muted" : "hover:bg-muted/60"
                )}
              >
                <span className="truncate">{conversation.title || "New chat"}</span>
                <Trash2
                  className="text-muted-foreground size-3.5 shrink-0 opacity-0 hover:text-destructive group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    void deleteConversation(conversation.id);
                  }}
                />
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat */}
      <div className="flex min-h-0 flex-col rounded-lg border">
        <div className="flex items-center justify-between border-b p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{agent.icon}</span>
            <div>
              <p className="text-sm font-medium">{agent.name}</p>
              {agent.description ? (
                <p className="text-muted-foreground text-xs">{agent.description}</p>
              ) : null}
            </div>
          </div>
          {isOwner ? (
            <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)}>
              <Settings className="size-4" />
            </Button>
          ) : null}
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoadingThread ? (
            <Loader2 className="text-muted-foreground mx-auto size-5 animate-spin" />
          ) : messages.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              Say hello to {agent.name}.
            </p>
          ) : (
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <Avatar className="mt-0.5 size-7 shrink-0">
                    <AvatarFallback>
                      {message.role === "user" ? "You" : agent.icon}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-4 py-3",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 border"
                    )}
                  >
                    {message.role === "user" ? (
                      <p className="text-sm break-words whitespace-pre-wrap">
                        {message.content}
                      </p>
                    ) : (
                      <>
                        {message.steps?.length ? (
                          <div className="mb-2 grid gap-1">
                            {message.steps.map((step) => (
                              <div
                                key={step.id}
                                className="text-muted-foreground flex items-center gap-1.5 text-xs"
                              >
                                <Wrench className="size-3" />
                                Called <code className="font-mono">{step.name}</code>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <Markdown content={message.content} />
                      </>
                    )}
                  </div>
                </div>
              ))}
              {isSending ? (
                <p className="text-muted-foreground text-xs">Thinking…</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <form
            className="bg-muted/30 mx-auto flex max-w-2xl items-end gap-2 rounded-xl border p-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={`Message ${agent.name}…`}
              rows={1}
              className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
              disabled={isSending}
            />
            <Button type="submit" size="icon" disabled={isSending || !input.trim()}>
              {isSending ? <Loader2 className="animate-spin" /> : <Share2 className="rotate-90" />}
            </Button>
          </form>
        </div>
      </div>

      {isOwner ? (
        <AgentSettingsDialog
          agent={agent}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      ) : null}
    </div>
  );
}

function rowsToDisplay(
  rows: {
    id: string;
    role: "user" | "assistant" | "tool";
    content: string;
    tool_calls: { id: string; name: string; arguments: Record<string, unknown> }[] | null;
    tool_call_id: string | null;
  }[]
): DisplayMessage[] {
  const display: DisplayMessage[] = [];
  const pendingSteps = new Map<string, ToolStep>();

  for (const row of rows) {
    if (row.role === "user") {
      display.push({ id: row.id, role: "user", content: row.content });
    } else if (row.role === "assistant" && row.tool_calls?.length) {
      // A tool-call turn is split across rows: this assistant row just
      // records which tools were called; the result rows follow.
      for (const call of row.tool_calls) {
        pendingSteps.set(call.id, {
          type: "tool_call",
          id: call.id,
          name: call.name,
          arguments: call.arguments,
          result: "",
        });
      }
    } else if (row.role === "tool") {
      const step = row.tool_call_id ? pendingSteps.get(row.tool_call_id) : undefined;
      if (step) step.result = row.content;
    } else if (row.role === "assistant") {
      display.push({
        id: row.id,
        role: "assistant",
        content: row.content,
        steps: pendingSteps.size > 0 ? Array.from(pendingSteps.values()) : undefined,
      });
      pendingSteps.clear();
    }
  }

  return display;
}
