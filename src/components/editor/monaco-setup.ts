"use client";

import { loader } from "@monaco-editor/react";

let configured = false;

/**
 * Configures @monaco-editor/react to use the locally-bundled
 * monaco-editor (no CDN) with web workers served by the bundler.
 * Must run in the browser before the first <Editor> mounts.
 */
export async function setupMonaco(): Promise<void> {
  if (configured || typeof window === "undefined") return;
  configured = true;

  const monaco = await import("monaco-editor");

  self.MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
      switch (label) {
        case "json":
          return new Worker(
            new URL(
              "monaco-editor/esm/vs/language/json/json.worker.js",
              import.meta.url
            )
          );
        case "css":
        case "scss":
        case "less":
          return new Worker(
            new URL(
              "monaco-editor/esm/vs/language/css/css.worker.js",
              import.meta.url
            )
          );
        case "html":
        case "handlebars":
        case "razor":
          return new Worker(
            new URL(
              "monaco-editor/esm/vs/language/html/html.worker.js",
              import.meta.url
            )
          );
        case "typescript":
        case "javascript":
          return new Worker(
            new URL(
              "monaco-editor/esm/vs/language/typescript/ts.worker.js",
              import.meta.url
            )
          );
        default:
          return new Worker(
            new URL(
              "monaco-editor/esm/vs/editor/editor.worker.js",
              import.meta.url
            )
          );
      }
    },
  };

  // Generated project files reference modules that don't exist in the
  // editor's TS context — keep semantic diagnostics quiet rather than
  // noisy. The typescript namespace is typed as deprecated in recent
  // monaco builds but still present at runtime in the full bundle.
  interface TsDefaults {
    setDiagnosticsOptions(options: Record<string, unknown>): void;
    setCompilerOptions(options: Record<string, unknown>): void;
  }
  const ts = (
    monaco.languages as unknown as {
      typescript?: { typescriptDefaults?: TsDefaults };
    }
  ).typescript;
  ts?.typescriptDefaults?.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: false,
  });
  ts?.typescriptDefaults?.setCompilerOptions({
    jsx: 4, // ReactJSX
    allowNonTsExtensions: true,
  });

  loader.config({ monaco });
}

export function monacoLanguageFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
      return "typescript";
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
      return "javascript";
    case "css":
      return "css";
    case "html":
      return "html";
    case "json":
      return "json";
    case "sql":
      return "sql";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}
