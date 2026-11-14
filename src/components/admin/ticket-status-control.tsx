"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ticketStatuses, type TicketStatus } from "@/lib/clients/admin-data";

const labels: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting: "Waiting",
  resolved: "Resolved",
  closed: "Closed",
};

export function TicketStatusControl({ id, status, priority }: {
  id: string;
  status: TicketStatus;
  priority: "normal" | "high" | "urgent";
}) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [nextPriority, setNextPriority] = useState(priority);
  const [busy, setBusy] = useState(false);
  const changed = nextStatus !== status || nextPriority !== priority;
  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/tickets/" + encodeURIComponent(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, priority: nextPriority }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Ticket update failed");
      toast.success("Ticket updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ticket update failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Ticket status and priority">
      <select aria-label="Status" className="border-input bg-background h-9 rounded-md border px-2 text-xs"
        value={nextStatus} onChange={event => setNextStatus(event.target.value as TicketStatus)}>
        {ticketStatuses.map(value => <option key={value} value={value}>{labels[value]}</option>)}
      </select>
      <select aria-label="Priority" className="border-input bg-background h-9 rounded-md border px-2 text-xs"
        value={nextPriority} onChange={event => setNextPriority(event.target.value as typeof nextPriority)}>
        <option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
      </select>
      <Button type="button" size="sm" variant="outline" onClick={save} disabled={busy || !changed}>
        {busy ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}
