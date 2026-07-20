"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

function CreateKeyDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setName("");
    setNewSecret(null);
    setCopied(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Give it a name.");
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to create key");
      setNewSecret(data.secret);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create key");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCopy() {
    if (!newSecret) return;
    void navigator.clipboard.writeText(newSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Create key
        </Button>
      </DialogTrigger>
      <DialogContent>
        {newSecret ? (
          <>
            <DialogHeader>
              <DialogTitle>Copy your key now</DialogTitle>
              <DialogDescription>
                This is the only time it&apos;s shown — it can&apos;t be retrieved again if you
                lose it (you&apos;d need to create a new one).
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 py-4">
              <Input readOnly value={newSecret} className="font-mono text-xs" />
              <button
                type="button"
                onClick={handleCopy}
                className="hover:bg-muted flex shrink-0 items-center justify-center rounded-md border px-3"
                aria-label="Copy API key"
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </div>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                For programmatic access to the <code className="bg-muted rounded px-1">/api/v1/*</code> endpoints.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. CI pipeline"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                Create
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<ApiKeyRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetch("/api/keys")
      .then((res) => res.json())
      .then((data) => setKeys(data.keys ?? []))
      .catch(() => toast.error("Couldn't load API keys."));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRevoke(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/keys/${id}`, { method: "PATCH" });
      if (!response.ok) throw new Error();
      toast.success("Key revoked");
      load();
    } catch {
      toast.error("Failed to revoke key");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    try {
      const response = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("Key deleted");
      load();
    } catch {
      toast.error("Failed to delete key");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            Manage keys for programmatic access to the platform&apos;s API.
          </CardDescription>
        </div>
        <CreateKeyDialog onCreated={load} />
      </CardHeader>
      <CardContent>
        {keys === null ? (
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        ) : keys.length === 0 ? (
          <p className="text-muted-foreground text-sm">No API keys yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {keys.map((key) => {
              const isRevoked = Boolean(key.revoked_at);
              const busy = busyId === key.id;
              return (
                <div key={key.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{key.name}</p>
                    <p className="text-muted-foreground truncate font-mono text-xs">
                      {key.key_prefix}…
                    </p>
                  </div>
                  <div className="text-muted-foreground hidden text-xs sm:block">
                    {key.last_used_at ? `Last used ${formatDate(key.last_used_at)}` : "Never used"}
                  </div>
                  {isRevoked ? (
                    <Badge variant="outline">Revoked</Badge>
                  ) : (
                    <Button variant="outline" size="sm" disabled={busy} onClick={() => handleRevoke(key.id)}>
                      {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      Revoke
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${key.name}`}
                    disabled={busy}
                    onClick={() => handleDelete(key.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
