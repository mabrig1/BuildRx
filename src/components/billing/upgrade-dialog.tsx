"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpCircle, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PROVIDERS = [
  {
    id: "paystack" as const,
    name: "Paystack",
    description: "Cards, bank transfer, USSD, mobile money",
  },
  {
    id: "flutterwave" as const,
    name: "Flutterwave",
    description: "Cards, bank, mobile money across Africa",
  },
];

export function UpgradeDialog({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function checkout(provider: "paystack" | "flutterwave") {
    setBusy(provider);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro", provider }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to start checkout");
      }
      if (data.simulated) {
        toast.success("Upgraded to Pro (demo checkout)");
        setOpen(false);
        router.refresh();
        return;
      }
      window.location.href = data.url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start checkout"
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" disabled={disabled}>
          <ArrowUpCircle />
          Upgrade to Pro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Choose a payment provider</DialogTitle>
          <DialogDescription>
            Pro is $25/month. You&apos;ll complete payment on the
            provider&apos;s secure checkout page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() => void checkout(provider.id)}
              disabled={busy !== null}
              className="hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-60"
            >
              <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
                {busy === provider.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CreditCard className="size-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{provider.name}</p>
                <p className="text-muted-foreground text-xs">
                  {provider.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CancelSubscriptionButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    try {
      const response = await fetch("/api/billing/cancel", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Failed to cancel");
      toast.success(
        "Subscription will cancel at the end of the billing period"
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to cancel");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void cancel()}
      disabled={busy}
    >
      {busy ? <Loader2 className="animate-spin" /> : null}
      Cancel subscription
    </Button>
  );
}
