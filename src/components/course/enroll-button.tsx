"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Provider = "paystack" | "flutterwave";

export function EnrollButton({
  provider,
  children,
  variant = "default",
}: {
  provider: Provider;
  children: React.ReactNode;
  variant?: "default" | "outline";
}) {
  const [busy, setBusy] = useState(false);

  async function enroll() {
    setBusy(true);
    try {
      const response = await fetch("/api/course/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        throw new Error(data?.error ?? "Unable to start enrollment checkout.");
      }
      window.location.assign(data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start checkout.");
      setBusy(false);
    }
  }

  return (
    <Button type="button" size="lg" variant={variant} onClick={enroll} disabled={busy}>
      {busy ? <Loader2 className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
