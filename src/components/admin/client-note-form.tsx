"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ClientNoteForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/clients/" + encodeURIComponent(clientId) + "/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Unable to save private note");
      setText("");
      toast.success("Private client note saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save note");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <label htmlFor="client-note" className="text-sm font-medium">Add private administrative note</label>
      <Textarea id="client-note" rows={3} maxLength={2000} value={text}
        placeholder="Record follow-up, next steps or an internal service note. Do not store secrets."
        onChange={e => setText(e.target.value)} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">Visible only to administrators · {text.length}/2000</p>
        <Button size="sm" type="button" onClick={save} disabled={busy || text.trim().length < 8}>
          {busy ? "Saving..." : "Save note"}
        </Button>
      </div>
    </div>
  );
}
