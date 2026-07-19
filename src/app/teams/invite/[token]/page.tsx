"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface InviteDetails {
  email: string;
  role: string;
  status: string;
  valid: boolean;
  teamName: string;
}

export default function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/teams/invites/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Invite not found");
        setInvite(data.invite);
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Invite not found"));
  }, [token]);

  async function handleAccept() {
    setIsAccepting(true);
    setAcceptError(null);
    try {
      const response = await fetch(`/api/teams/invites/${token}`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/teams/invite/${token}`)}`);
        return;
      }
      if (!response.ok) throw new Error(data?.error ?? "Failed to accept invite");
      router.push(`/teams/${data.teamId}`);
    } catch (error) {
      setAcceptError(error instanceof Error ? error.message : "Failed to accept invite");
    } finally {
      setIsAccepting(false);
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.25_295/0.12),transparent_55%)]"
      />
      <Logo />
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Team invite</CardTitle>
            {invite ? (
              <CardDescription>
                You&apos;ve been invited to join <strong>{invite.teamName}</strong> as{" "}
                {invite.role === "admin" ? "an admin" : "a member"}.
              </CardDescription>
            ) : (
              <CardDescription>Loading invite details…</CardDescription>
            )}
          </CardHeader>
          <CardContent className="grid gap-4">
            {loadError ? (
              <p className="border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <XCircle className="size-4 shrink-0" />
                {loadError}
              </p>
            ) : !invite ? (
              <Loader2 className="text-muted-foreground mx-auto size-5 animate-spin" />
            ) : !invite.valid ? (
              <p className="border-destructive/50 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <XCircle className="size-4 shrink-0" />
                This invite has {invite.status === "accepted" ? "already been accepted" : "expired or been revoked"}.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground text-sm">
                  Sent to <strong>{invite.email}</strong> — sign in with that email to accept.
                </p>
                {acceptError ? (
                  <p className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                    {acceptError}
                  </p>
                ) : null}
                <Button onClick={() => void handleAccept()} disabled={isAccepting}>
                  {isAccepting ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <CheckCircle2 />
                  )}
                  Accept invite
                </Button>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Link href="/dashboard" className="text-muted-foreground text-sm hover:underline">
              Back to dashboard
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
