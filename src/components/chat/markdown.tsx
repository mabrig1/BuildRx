"use client";

import { memo, useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CodeBlock({
  language,
  code,
}: {
  language: string | null;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="bg-muted/50 my-3 overflow-hidden rounded-lg border">
      <div className="bg-muted/80 flex h-9 items-center justify-between border-b pr-1 pl-3">
        <span className="text-muted-foreground font-mono text-xs">
          {language ?? "code"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={handleCopy}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export const Markdown = memo(function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed",
        "[&>p]:mb-3 [&>p:last-child]:mb-0",
        "[&>ul]:mb-3 [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:mt-1",
        "[&>ol]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol>li]:mt-1",
        "[&>h1]:mt-4 [&>h1]:mb-2 [&>h1]:text-lg [&>h1]:font-semibold",
        "[&>h2]:mt-4 [&>h2]:mb-2 [&>h2]:text-base [&>h2]:font-semibold",
        "[&>h3]:mt-3 [&>h3]:mb-1.5 [&>h3]:font-semibold",
        "[&>blockquote]:border-border [&>blockquote]:text-muted-foreground [&>blockquote]:mb-3 [&>blockquote]:border-l-2 [&>blockquote]:pl-3",
        "[&_a]:underline [&_a]:underline-offset-4",
        "[&_table]:mb-3 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:px-2 [&_td]:py-1",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { className: codeClassName, children } = props;
            const match = /language-(\w+)/.exec(codeClassName ?? "");
            const code = String(children).replace(/\n$/, "");
            // Block code has a language class or a newline; inline doesn't.
            if (match || code.includes("\n")) {
              return <CodeBlock language={match?.[1] ?? null} code={code} />;
            }
            return (
              <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            );
          },
          pre({ children }) {
            // CodeBlock renders its own <pre>.
            return <>{children}</>;
          },
          table({ children }) {
            // Wide tables scroll inside their own container instead of
            // stretching the page on small screens.
            return (
              <div className="overflow-x-auto">
                <table>{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
