"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ModelSelector } from "@/components/ai/model-selector";
import type { AgentDetail } from "@/components/agents/agent-workspace";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AVAILABLE_TOOL_IDS, TOOL_DESCRIPTIONS, type ToolId } from "@/lib/ai-agents/tools";
import { cn } from "@/lib/utils";

interface ProviderOption {
  id: string;
  label: string;
  configured: boolean;
  models: { id: string; label: string }[];
}

interface KnowledgeFile {
  id: string;
  name: string;
  size_bytes: number;
  created_at: string;
}

export function AgentSettingsDialog({
  agent,
  open,
  onOpenChange,
}: {
  agent: AgentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [providers, setProviders] = useState<ProviderOption[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt);
  const [tools, setTools] = useState<ToolId[]>(agent.tools as ToolId[]);
  const [visibility, setVisibility] = useState(agent.visibility);
  const [model, setModel] = useState({ provider: agent.provider, model: agent.model });

  const [files, setFiles] = useState<KnowledgeFile[] | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [isAddingFile, setIsAddingFile] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch("/api/ai/providers")
      .then((res) => res.json())
      .then((data) => setProviders(data.providers))
      .catch(() => toast.error("Couldn't load AI providers."));
    void loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadFiles() {
    const response = await fetch(`/api/agents/${agent.id}/knowledge`);
    const data = await response.json().catch(() => null);
    if (response.ok) setFiles(data.files);
  }

  function toggleTool(id: ToolId) {
    setTools((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id]
    );
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description || undefined,
          systemPrompt,
          provider: model.provider,
          model: model.model,
          tools,
          visibility,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to save");
      toast.success("Saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  async function addFile() {
    if (!newFileName.trim() || !newFileContent.trim()) {
      toast.error("Name and content are both required.");
      return;
    }
    setIsAddingFile(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFileName.trim(), content: newFileContent }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to add file");
      setNewFileName("");
      setNewFileContent("");
      void loadFiles();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add file");
    } finally {
      setIsAddingFile(false);
    }
  }

  async function deleteFile(fileId: string) {
    const response = await fetch(`/api/agents/${agent.id}/knowledge/${fileId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      toast.error("Failed to remove file");
      return;
    }
    void loadFiles();
  }

  function copyShareLink() {
    if (!agent.share_slug) return;
    void navigator.clipboard.writeText(`${window.location.origin}/agents/share/${agent.share_slug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agent settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="grid gap-4 pt-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
              />
            </div>
            <div className="grid gap-2">
              <Label>System prompt</Label>
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={5}
                maxLength={8000}
              />
            </div>
            <div className="grid gap-2">
              <Label>Model</Label>
              {providers ? (
                <ModelSelector providers={providers} value={model} onChange={setModel} />
              ) : (
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              )}
            </div>
            <div className="grid gap-2">
              <Label>Tools</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {AVAILABLE_TOOL_IDS.map((id) => {
                  const isSelected = tools.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleTool(id)}
                      className={cn(
                        "rounded-lg border p-2 text-left text-xs transition-colors",
                        isSelected ? "bg-primary/10 border-primary" : "hover:bg-muted"
                      )}
                    >
                      <span className="block font-medium">{id}</span>
                      <span className="text-muted-foreground block">
                        {TOOL_DESCRIPTIONS[id]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private — only you</SelectItem>
                  <SelectItem value="unlisted">Unlisted — shareable link</SelectItem>
                  <SelectItem value="public">Public — listed in the marketplace</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="knowledge" className="grid gap-4 pt-4">
            <div className="grid gap-2">
              {files === null ? (
                <Loader2 className="text-muted-foreground size-4 animate-spin" />
              ) : files.length === 0 ? (
                <p className="text-muted-foreground text-sm">No knowledge files yet.</p>
              ) : (
                files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="truncate">{file.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        {Math.ceil(file.size_bytes / 1024)} KB
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => void deleteFile(file.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="grid gap-2 rounded-lg border p-3">
              <Label>Add a text file (max 50,000 characters)</Label>
              <Input
                placeholder="File name, e.g. FAQ.md"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                maxLength={200}
              />
              <Textarea
                placeholder="Paste the content here…"
                value={newFileContent}
                onChange={(e) => setNewFileContent(e.target.value)}
                rows={5}
                maxLength={50_000}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={addFile} disabled={isAddingFile}>
                  {isAddingFile ? <Loader2 className="animate-spin" /> : null}
                  Add file
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="share" className="grid gap-4 pt-4">
            {agent.share_slug ? (
              <div className="flex items-center gap-2">
                <Input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}/agents/share/${agent.share_slug}`} />
                <Button variant="outline" size="icon" onClick={copyShareLink}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Set visibility to &quot;Unlisted&quot; or &quot;Public&quot; on the General
                tab and save to generate a share link.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
