"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ModelSelector } from "@/components/ai/model-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/content/prompts";

interface ProviderOption {
  id: string;
  label: string;
  configured: boolean;
  defaultModel: string;
  models: { id: string; label: string }[];
}

const WRITER_TYPES = Object.keys(CONTENT_TYPE_LABELS) as ContentType[];

export function ContentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = WRITER_TYPES.includes(searchParams.get("type") as ContentType)
    ? (searchParams.get("type") as ContentType)
    : "blog_post";

  const [type, setType] = useState<ContentType>(initialType);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [keywords, setKeywords] = useState("");
  const [wordCount, setWordCount] = useState<"short" | "medium" | "long">("medium");
  const [platform, setPlatform] = useState("");
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [purpose, setPurpose] = useState("marketing");
  const [callToAction, setCallToAction] = useState("");
  const [product, setProduct] = useState("");
  const [chapterCount, setChapterCount] = useState(5);
  const [videoLength, setVideoLength] = useState<"short" | "long">("short");

  const [providers, setProviders] = useState<ProviderOption[] | null>(null);
  const [model, setModel] = useState<{ provider: string; model: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!model) {
      toast.error("Choose a model.");
      return;
    }
    if (type !== "ad_copy" && !topic.trim()) {
      toast.error("Add a topic.");
      return;
    }
    if (type === "ad_copy" && !product.trim()) {
      toast.error("Describe the product or service.");
      return;
    }

    const inputs: Record<string, unknown> = { tone: tone || undefined, targetAudience: targetAudience || undefined };
    if (type === "blog_post") {
      Object.assign(inputs, { topic, keywords: keywords || undefined, wordCount });
    } else if (type === "ebook") {
      Object.assign(inputs, { topic, chapterCount });
    } else if (type === "social_post") {
      Object.assign(inputs, { topic, platform: platform || undefined, includeHashtags });
    } else if (type === "email") {
      Object.assign(inputs, { topic, purpose, callToAction: callToAction || undefined });
    } else if (type === "ad_copy") {
      Object.assign(inputs, { product, platform: platform || undefined, callToAction: callToAction || undefined });
    } else if (type === "video_script") {
      Object.assign(inputs, { topic, platform: platform || undefined, videoLength });
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, inputs, provider: model.provider, model: model.model }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Generation failed");
      toast.success("Generated");
      router.push(`/content/${data.content.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Writer</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={type} onValueChange={(v) => setType(v as ContentType)}>
            <TabsList className="flex-wrap">
              {WRITER_TYPES.map((t) => (
                <TabsTrigger key={t} value={t}>
                  {CONTENT_TYPE_LABELS[t]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {type === "ad_copy" ? (
            <div className="grid gap-2">
              <Label htmlFor="product">Product / service</Label>
              <Input id="product" value={product} onChange={(e) => setProduct(e.target.value)} />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="topic">Topic</Label>
              <Textarea id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="tone">Tone</Label>
              <Input
                id="tone"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g. friendly, professional, witty"
              />
            </div>
            {type !== "ad_copy" ? (
              <div className="grid gap-2">
                <Label htmlFor="audience">Target audience</Label>
                <Input
                  id="audience"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {type === "blog_post" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="keywords">Keywords (optional)</Label>
                <Input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Length</Label>
                <Select value={wordCount} onValueChange={(v) => setWordCount(v as typeof wordCount)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short (~500 words)</SelectItem>
                    <SelectItem value="medium">Medium (~1000 words)</SelectItem>
                    <SelectItem value="long">Long (~1800 words)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {type === "ebook" ? (
            <div className="grid gap-2">
              <Label htmlFor="chapters">Chapters (3-8)</Label>
              <Input
                id="chapters"
                type="number"
                min={3}
                max={8}
                value={chapterCount}
                onChange={(e) => setChapterCount(Number(e.target.value))}
              />
              <p className="text-muted-foreground text-xs">
                Generated as an outline first, then one chapter at a time — this can take a
                minute or two.
              </p>
            </div>
          ) : null}

          {type === "social_post" || type === "ad_copy" || type === "video_script" ? (
            <div className="grid gap-2">
              <Label htmlFor="platform">Platform</Label>
              <Input
                id="platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder={type === "video_script" ? "YouTube, TikTok, Reels…" : "X, LinkedIn, Instagram…"}
              />
            </div>
          ) : null}

          {type === "social_post" ? (
            <div className="flex items-center justify-between">
              <Label htmlFor="hashtags">Include hashtags</Label>
              <Switch id="hashtags" checked={includeHashtags} onCheckedChange={setIncludeHashtags} />
            </div>
          ) : null}

          {type === "email" ? (
            <div className="grid gap-2">
              <Label>Purpose</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="newsletter">Newsletter</SelectItem>
                  <SelectItem value="welcome">Welcome</SelectItem>
                  <SelectItem value="follow-up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {type === "email" || type === "ad_copy" ? (
            <div className="grid gap-2">
              <Label htmlFor="cta">Call to action (optional)</Label>
              <Input id="cta" value={callToAction} onChange={(e) => setCallToAction(e.target.value)} />
            </div>
          ) : null}

          {type === "video_script" ? (
            <div className="grid gap-2">
              <Label>Length</Label>
              <Select value={videoLength} onValueChange={(v) => setVideoLength(v as typeof videoLength)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short-form (under 60s)</SelectItem>
                  <SelectItem value="long">Long-form (3-8 min)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model</CardTitle>
        </CardHeader>
        <CardContent>
          {providers ? (
            <ModelSelector providers={providers} value={model} onChange={setModel} />
          ) : (
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          Generate
        </Button>
      </div>
    </form>
  );
}
