"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function InviteDialog({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setEmail("");
    setRole("member");
    setAcceptUrl(null);
    setCopied(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to create invite");
      setAcceptUrl(data.acceptUrl);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create invite");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCopy() {
    if (!acceptUrl) return;
    void navigator.clipboard.writeText(acceptUrl);
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
        <Button variant="outline" size="sm">
          <UserPlus />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        {acceptUrl ? (
          <>
            <DialogHeader>
              <DialogTitle>Invite created</DialogTitle>
              <DialogDescription>
                There&apos;s no email sending set up on this deployment — share this link with{" "}
                {email} directly.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 py-4">
              <Input readOnly value={acceptUrl} className="font-mono text-xs" />
              <button
                type="button"
                onClick={handleCopy}
                className="hover:bg-muted flex shrink-0 items-center justify-center rounded-md border px-3"
                aria-label="Copy invite link"
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
              <DialogTitle>Invite a teammate</DialogTitle>
              <DialogDescription>They&apos;ll need to accept with a matching email.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-email">Email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  autoFocus
                />
              </div>
              <div className="grid gap-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                Create invite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
