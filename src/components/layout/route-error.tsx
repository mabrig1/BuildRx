"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Shared body for Next.js route-segment error.tsx boundaries. Logs to the
 * console (server-side errors are already captured by the platform; this
 * covers client-render errors too) and offers both a retry (re-renders the
 * segment without a full reload) and a way back to a known-good page.
 */
export function RouteError({
  error,
  reset,
  homeHref = "/dashboard",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="bg-destructive/10 text-destructive rounded-full p-3">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="text-muted-foreground max-w-md text-sm">
        An unexpected error occurred while loading this page. You can try
        again, or head back to somewhere safe.
      </p>
      {error.digest && (
        <p className="text-muted-foreground font-mono text-xs">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button asChild>
          <Link href={homeHref}>Back home</Link>
        </Button>
      </div>
    </div>
  );
}
