"use client";

import { useState, useTransition } from "react";
import { Bot, Check, Copy, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { updateChatMessage } from "@/app/(workspace)/actions";
import { Markdown } from "@/components/chat/markdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";
import type { ChatMessage } from "@/types";

export function ChatMessageItem({
  message,
  isStreaming = false,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const updateMessage = useChatStore((s) => s.updateMessage);

  const isUser = message.role === "user";
  // Optimistic messages (not yet persisted) have temp ids — not editable.
  const isPersisted = !message.id.startsWith("temp-");

  function handleCopy() {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleSave() {
    const content = draft.trim();
    if (!content || content === message.content) {
      setIsEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await updateChatMessage({
        messageId: message.id,
        content,
      });
      if ("error" in result) {
        toast.error(result.error);
      } else {
        updateMessage(message.id, content);
        toast.success("Message updated");
      }
      setIsEditing(false);
    });
  }

  return (
    <div
      className={cn(
        "group flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="mt-0.5 size-7 shrink-0">
        <AvatarFallback
          className={cn(
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
          )}
        >
          {isUser ? (
            <span className="text-xs font-medium">You</span>
          ) : (
            <Bot className="size-4" />
          )}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "relative min-w-0 max-w-[85%] rounded-xl px-4 py-3",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted/50 border"
        )}
      >
        {isEditing ? (
          <div className="grid w-full min-w-64 gap-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="bg-background text-foreground min-h-20"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  setDraft(message.content);
                  setIsEditing(false);
                }}
                disabled={isPending}
              >
                <X />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleSave}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="animate-spin" /> : <Check />}
                Save
              </Button>
            </div>
          </div>
        ) : isUser ? (
          <p className="text-sm break-words whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <>
            <Markdown content={message.content} />
            {isStreaming ? (
              <span className="bg-foreground ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm align-text-bottom" />
            ) : null}
          </>
        )}

        {!isEditing && !isStreaming ? (
          <div
            className={cn(
              "absolute -bottom-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100",
              isUser ? "right-2" : "left-2"
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="bg-background size-6 rounded-full shadow-sm"
              onClick={handleCopy}
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="size-3" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
            {isUser && isPersisted ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="bg-background size-6 rounded-full shadow-sm"
                onClick={() => setIsEditing(true)}
                aria-label="Edit message"
              >
                <Pencil className="size-3" />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
