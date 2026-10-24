"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FeedbackRecord {
  id: string;
  createdAt: string;
  rating: number | null;
  note: string | null;
}

/**
 * Explicit user-consent feedback loop inspired by the video demo.
 * Saves comments privately; only the "Use in next build" button adds
 * feedback to the model prompt. No automatic retries or deploys.
 */
export function BuildFeedbackPanel({
  projectId,
  onApply,
}: {
  projectId: string;
  onApply: (note: string) => void;
}) {
  const [rating, setRating] = useState(4);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/agents/feedback?projectId=${encodeURIComponent(projectId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Feedback requires configured Supabase and its owner-read migration");
        return response.json() as Promise<{ feedback: FeedbackRecord[] }>;
      })
      .then((result) => {
        if (alive) setItems(result.feedback);
      })
      .catch(() => {
        if (alive) setAvailable(false);
      });
    return () => { alive = false; };
  }, [projectId]);

  async function submit() {
    if (note.trim().length < 8) {
      toast.error("Describe what should improve in at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/agents/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, rating, note: note.trim() }),
      });
      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save feedback");
      toast.success("Feedback saved privately");
      const savedNote = note.trim();
      setItems((prev) => [{
        id: `local-${Date.now()}`, createdAt: new Date().toISOString(),
        rating, note: savedNote,
      }, ...prev].slice(0, 20));
      setNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save feedback");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-3 rounded-lg border p-3" aria-label="Build feedback loop">
      <div>
        <h3 className="text-sm font-semibold">Feedback → next build</h3>
        <p className="text-muted-foreground text-xs">
          Evaluate this build. Feedback stays private and reaches AI only when you choose to apply it.
          No deployment is triggered.
        </p>
      </div>
      {!available ? (
        <p className="text-muted-foreground text-xs" role="status">
          Private feedback is unavailable until Supabase and the owner-read migration are active.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2" role="group" aria-label="Build rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <Button
                key={value}
                type="button"
                variant={rating === value ? "default" : "outline"}
                size="sm"
                onClick={() => setRating(value)}
                aria-label={`Rate ${value} out of 5`}
                aria-pressed={rating === value}
              >
                {value}
              </Button>
            ))}
          </div>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={800}
            placeholder="What failed or should improve? Do not include credentials or personal data."
            aria-label="Build feedback"
            className="min-h-20"
          />
          <Button onClick={submit} disabled={loading || note.trim().length < 8} size="sm">
            {loading ? "Saving feedback…" : "Save private feedback"}
          </Button>
          {items.length > 0 && (
            <div className="grid gap-2 border-t pt-2">
              <p className="text-xs font-medium">Recent feedback</p>
              {items.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-md bg-muted/40 p-2">
                  <p className="text-xs whitespace-pre-wrap break-words">{item.note}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">
                      {item.rating ?? "—"}/5
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!item.note}
                      onClick={() => {
                        if (!item.note) return;
                        onApply(item.note);
                        toast.message("Feedback added to the build prompt; start a new build when ready.");
                      }}
                    >
                      Use in next build
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
