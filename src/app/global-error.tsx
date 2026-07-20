"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Catches crashes in the root layout itself (fonts, providers, etc.) —
 * segment-level error.tsx boundaries can't catch those since they render
 * inside the layout. Must render its own <html>/<body>; kept deliberately
 * minimal since the app's providers may be exactly what's broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="max-w-md text-sm text-neutral-500">
            The app hit an unexpected error and couldn&apos;t recover on its
            own. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
