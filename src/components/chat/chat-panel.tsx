"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  SendHorizontal,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ChatMessageItem } from "@/components/chat/chat-message-item";
import { PromptSuggestions } from "@/components/chat/prompt-suggestions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chat-store";
import type { ChatMessage } from "@/types";

export function ChatPanel({
  projectId,
  initialMessages,
  insertText,
  className,
}: {
  projectId: string;
  initialMessages: ChatMessage[];
  /** Text pushed into the composer from outside (e.g. template picker). */
  insertText?: { text: string; nonce: number } | null;
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
  const [attachedImage, setAttachedImage] = useState<{
    dataUrl: string;
    name: string;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setMessages(initialMessages);
    return () => useChatStore.getState().clear();
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

  async function generateImageMessage(prompt: string) {
    if (!prompt) {
      toast.error("Add a prompt after /image, e.g. /image a friendly robot mascot");
      return;
    }
    if (isStreaming) return;

    setStickToBottom(true);
    addMessage({
      id: `temp-user-${Date.now()}`,
      projectId,
      userId: null,
      role: "user",
      content: `/image ${prompt}`,
      createdAt: new Date().toISOString(),
    });
    const assistantId = `temp-assistant-${Date.now()}`;
    addMessage({
      id: assistantId,
      projectId,
      userId: null,
      role: "assistant",
      content: "Generating image…",
      createdAt: new Date().toISOString(),
    });
    setStreaming(true);

    try {
      const response = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, projectId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Image generation failed");
      }
      updateMessage(assistantId, `![${prompt}](${data.imageDataUrl})`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Image generation failed";
      toast.error(message);
      updateMessage(assistantId, `*${message}*`);
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
    }
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim();

    const imageCommand = /^\/image\s+(.+)/i.exec(trimmed);
    if (imageCommand) {
      setInput("");
      void generateImageMessage(imageCommand[1].trim());
      return;
    }

    const image = attachedImage;
    if ((!trimmed && !image) || isStreaming) return;

    setInput("");
    setAttachedImage(null);
    setStickToBottom(true);
    addMessage({
      id: `temp-user-${Date.now()}`,
      projectId,
      userId: null,
      role: "user",
      content: image ? `${trimmed}\n\n📎 ${image.name}`.trim() : trimmed,
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

    // An attached image is analyzed first so its description can ride
    // along as context for the chat model, which has no vision of its own.
    let payloadContent = trimmed;
    if (image) {
      try {
        const visionResponse = await fetch("/api/ai/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: image.dataUrl,
            prompt: trimmed || undefined,
            projectId,
          }),
        });
        const visionData = await visionResponse.json().catch(() => null);
        if (visionResponse.ok && visionData?.text) {
          payloadContent = trimmed
            ? `${trimmed}\n\n[Attached image — analysis]\n${visionData.text}`
            : `Build this:\n\n${visionData.text}`;
        } else if (!trimmed) {
          throw new Error(visionData?.error ?? "Couldn't analyze the image");
        } else {
          toast.error(
            visionData?.error ??
              "Couldn't analyze the attached image — continuing without it."
          );
        }
      } catch (error) {
        if (!trimmed) {
          setStreaming(false);
          appendToLastMessage(
            `*${error instanceof Error ? error.message : "Couldn't analyze the attached image."} Add a note about what to build, or try again.*`
          );
          textareaRef.current?.focus();
          return;
        }
        toast.error(
          "Couldn't analyze the attached image — continuing without it."
        );
      }
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, content: payloadContent }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to send message");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToLastMessage(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to send message";
      toast.error(message);
      appendToLastMessage(`*${message}*`);
    } finally {
      setStreaming(false);
      textareaRef.current?.focus();
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please attach an image file.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("Image is too large (max 6MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage({ dataUrl: reader.result as string, name: file.name });
    };
    reader.onerror = () => toast.error("Couldn't read that file.");
    reader.readAsDataURL(file);
  }

  async function transcribeRecording() {
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    audioChunksRef.current = [];
    if (blob.size === 0) return;

    setIsTranscribing(true);
    try {
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      form.append("projectId", projectId);
      const response = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Transcription failed");
      }
      if (data?.text) {
        setInput((prev) => (prev ? `${prev} ${data.text}` : data.text));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Transcription failed"
      );
    } finally {
      setIsTranscribing(false);
      textareaRef.current?.focus();
    }
  }

  async function toggleRecording() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      toast.error("Voice input isn't supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        void transcribeRecording();
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      toast.error("Microphone access was denied.");
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
        <div className="mx-auto max-w-2xl">
          {attachedImage ? (
            <div className="bg-muted/30 mb-2 flex items-center gap-2 rounded-lg border p-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob/data URL preview */}
              <img
                src={attachedImage.dataUrl}
                alt={attachedImage.name}
                className="size-9 rounded object-cover"
              />
              <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                {attachedImage.name}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => setAttachedImage(null)}
                aria-label="Remove attachment"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : null}
          <form
            className="bg-muted/30 flex items-end gap-1 rounded-xl border p-2 focus-within:ring-[3px] focus-within:ring-ring/20"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(input);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              disabled={isStreaming}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach an image"
              title="Attach a screenshot or design to build from"
            >
              <Paperclip className="size-4" />
            </Button>
            <Button
              type="button"
              variant={isRecording ? "destructive" : "ghost"}
              size="icon"
              className="shrink-0"
              disabled={isStreaming || isTranscribing}
              onClick={() => void toggleRecording()}
              aria-label={isRecording ? "Stop recording" : "Record voice input"}
              title={isRecording ? "Stop recording" : "Speak your prompt"}
            >
              {isTranscribing ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isRecording ? (
                <Square className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
            </Button>
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI to build or change something… (try /image a logo for a coffee shop)"
              rows={1}
              className="max-h-40 min-h-10 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
              disabled={isStreaming}
            />
            <Button
              type="submit"
              size="icon"
              className="shrink-0"
              disabled={
                isStreaming || (input.trim().length === 0 && !attachedImage)
              }
              aria-label="Send message"
            >
              {isStreaming ? (
                <Loader2 className="animate-spin" />
              ) : input.trim().toLowerCase().startsWith("/image ") ? (
                <ImageIcon />
              ) : (
                <SendHorizontal />
              )}
            </Button>
          </form>
        </div>
        <p className="text-muted-foreground mt-1.5 text-center text-xs">
          Enter to send · Shift+Enter for a new line · 📎 attach a design ·
          🎤 speak your prompt
        </p>
      </div>
    </div>
  );
}
