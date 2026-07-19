"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Copy, ImageIcon, Loader2, Mic, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Markdown } from "@/components/chat/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/content/prompts";

export interface ContentDetailData {
  id: string;
  type: ContentType;
  title: string;
  content: string;
  cover_image_data_url: string | null;
  status: "ready" | "failed";
  error: string | null;
}

export function ContentDetail({ piece }: { piece: ContentDetailData }) {
  const router = useRouter();
  const [content, setContent] = useState(piece.content);
  const [coverImage, setCoverImage] = useState(piece.cover_image_data_url);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);

  const dirty = content !== piece.content;

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/content/${piece.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Failed to save");
      toast.success("Saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/content/${piece.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Regeneration failed");
      setContent(data.content.content);
      toast.success("Regenerated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Regeneration failed");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleGenerateCover() {
    setIsGeneratingCover(true);
    try {
      const response = await fetch(`/api/content/${piece.id}/cover-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Couldn't generate a cover image");
      setCoverImage(data.coverImageDataUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't generate a cover image");
    } finally {
      setIsGeneratingCover(false);
    }
  }

  function handleCopy() {
    void navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-4">
      {piece.status === "failed" ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
            <p>{piece.error ?? "Generation failed for this piece."}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{CONTENT_TYPE_LABELS[piece.type]}</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            Copy
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleRegenerate()} disabled={isRegenerating}>
            {isRegenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Regenerate
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleGenerateCover()} disabled={isGeneratingCover}>
            {isGeneratingCover ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
            {coverImage ? "New cover image" : "Generate cover image"}
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="sm" disabled>
                  <Mic className="size-3.5" />
                  Voice
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Voice generation isn&apos;t available yet — placeholder for a future text-to-speech integration.
            </TooltipContent>
          </Tooltip>
          {dirty ? (
            <Button size="sm" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save
            </Button>
          ) : null}
        </div>
      </div>

      {coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated data: URL, not a static asset
        <img src={coverImage} alt="" className="max-h-64 w-full rounded-lg border object-cover" />
      ) : null}

      <Tabs defaultValue="preview">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
        </TabsList>
        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <Markdown content={content} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="edit" className="mt-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={20}
            className="font-mono text-sm"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
