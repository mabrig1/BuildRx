"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CONTENT_TYPE_LABELS, type ContentType } from "@/lib/content/prompts";
import { PROMPT_TEMPLATES } from "@/lib/content/templates";

type PromptCategory = ContentType | "general";

interface SavedPrompt {
  id: string;
  title: string;
  category: PromptCategory;
  prompt_text: string;
}

const CATEGORY_OPTIONS: { value: PromptCategory; label: string }[] = [
  { value: "general", label: "General" },
  ...(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((type) => ({
    value: type,
    label: CONTENT_TYPE_LABELS[type],
  })),
];

function categoryLabel(category: PromptCategory) {
  return CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text);
  toast.success("Copied");
}

export function PromptLibrary() {
  const [prompts, setPrompts] = useState<SavedPrompt[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SavedPrompt | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PromptCategory>("general");
  const [promptText, setPromptText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    fetch("/api/prompt-library")
      .then((res) => res.json())
      .then((data) => setPrompts(data.prompts ?? []))
      .catch(() => toast.error("Couldn't load your saved prompts."));
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setEditing(null);
    setTitle("");
    setCategory("general");
    setPromptText("");
    setDialogOpen(true);
  }

  function openEdit(prompt: SavedPrompt) {
    setEditing(prompt);
    setTitle(prompt.title);
    setCategory(prompt.category);
    setPromptText(prompt.prompt_text);
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !promptText.trim()) {
      toast.error("Add a title and prompt text.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(
        editing ? `/api/prompt-library/${editing.id}` : "/api/prompt-library",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, category, promptText }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to save prompt");
      toast.success(editing ? "Prompt updated" : "Prompt saved");
      setDialogOpen(false);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save prompt");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const response = await fetch(`/api/prompt-library/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete prompt");
      setPrompts((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
      toast.success("Deleted");
    } catch {
      toast.error("Failed to delete prompt");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your prompts</h2>
          <Button size="sm" onClick={openNew}>
            <Plus className="size-3.5" />
            New prompt
          </Button>
        </div>

        {prompts === null ? (
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        ) : prompts.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed py-12 text-center text-sm">
            No saved prompts yet — save one below or create your own.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {prompts.map((prompt) => (
              <Card key={prompt.id} className="gap-2 p-4">
                <CardContent className="flex flex-col gap-2 p-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{prompt.title}</p>
                    <Badge variant="outline">{categoryLabel(prompt.category)}</Badge>
                  </div>
                  <p className="text-muted-foreground line-clamp-3 text-sm">{prompt.prompt_text}</p>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => copyText(prompt.prompt_text)}>
                      <Copy className="size-3.5" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(prompt)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDelete(prompt.id)}
                      disabled={deletingId === prompt.id}
                    >
                      {deletingId === prompt.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Starter prompts</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {PROMPT_TEMPLATES.map((template) => (
            <Card key={template.id} className="gap-2 p-4">
              <CardContent className="flex flex-col gap-2 p-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{template.title}</p>
                  <Badge variant="outline">{categoryLabel(template.category)}</Badge>
                </div>
                <p className="text-muted-foreground line-clamp-3 text-sm">{template.promptText}</p>
                <div>
                  <Button variant="outline" size="sm" onClick={() => copyText(template.promptText)}>
                    <Copy className="size-3.5" />
                    Copy
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit prompt" : "New prompt"}</DialogTitle>
              <DialogDescription>
                Save a reusable prompt you can copy into any writer.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="prompt-title">Title</Label>
                <Input id="prompt-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as PromptCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prompt-text">Prompt</Label>
                <Textarea
                  id="prompt-text"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
