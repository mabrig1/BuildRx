"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TeamHeaderActions({
  teamId,
  initialName,
  isOwner,
}: {
  teamId: string;
  initialName: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOwner) return null;

  async function handleRename(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Give it a name.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error("Failed to update");
      toast.success("Saved");
      setRenameOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Team deleted");
      router.push("/teams");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Team actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Rename team</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label htmlFor="edit-team-name">Name</Label>
              <Input id="edit-team-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
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

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this team?</DialogTitle>
            <DialogDescription>
              This removes all members and pending invites, and unshares any projects shared with
              this team (they become personal again). This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
