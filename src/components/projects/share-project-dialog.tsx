"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PERSONAL = "__personal__";

interface TeamOption {
  id: string;
  name: string;
}

export function ShareProjectDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  currentTeamId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  currentTeamId: string | null;
}) {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamOption[] | null>(null);
  const [selected, setSelected] = useState(currentTeamId ?? PERSONAL);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(currentTeamId ?? PERSONAL);
    fetch("/api/teams")
      .then((res) => res.json())
      .then((data) => setTeams(data.teams ?? []))
      .catch(() => toast.error("Couldn't load your teams."));
  }, [open, currentTeamId]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const teamId = selected === PERSONAL ? null : selected;
      const response = await fetch(`/api/projects/${projectId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to update sharing");
      toast.success(teamId ? "Shared with team" : "Made personal again");
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update sharing");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share &quot;{projectName}&quot;</DialogTitle>
          <DialogDescription>
            Team members can view and edit a shared project. Only you can unshare it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-4">
          <Label>Visibility</Label>
          {teams === null ? (
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          ) : (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PERSONAL}>Personal (only you)</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {teams !== null && teams.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              You&apos;re not on any teams yet — create one from the Teams page first.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
