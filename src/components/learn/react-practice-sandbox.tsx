"use client";

import {
  SandpackLayout,
  SandpackPreview,
  SandpackProvider,
} from "@codesandbox/sandpack-react";

import type { ReactDemoFiles } from "@/lib/learn/studio-react-demo";

/**
 * Deliberately mounted ONLY after explicit user consent and a new "Run demo"
 * action. Sandpack loads its bundler in an external-origin iframe. It is not
 * an offline/local-only runner and does not execute the user's Next.js backend.
 */
export function ReactPracticeSandbox({ files }: { files: ReactDemoFiles }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <SandpackProvider
        template="react"
        files={files}
        options={{ autorun: true, autoReload: false }}
      >
        <SandpackLayout>
          <SandpackPreview
            showNavigator={false}
            showRefreshButton
            showOpenInCodeSandbox={false}
            showOpenNewtab={false}
            showSandpackErrorOverlay
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
