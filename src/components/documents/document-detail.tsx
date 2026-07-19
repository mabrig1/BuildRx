"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw, Send, Sparkles, Table2 } from "lucide-react";
import { toast } from "sonner";

import { Markdown } from "@/components/chat/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export interface DocumentDetailData {
  id: string;
  name: string;
  file_type: "pdf" | "docx" | "xlsx" | "image";
  status: "processing" | "ready" | "failed";
  extracted_text: string;
  tables: { name: string; rows: string[][] }[];
  summary: string | null;
  tables_markdown: string | null;
  report_markdown: string | null;
  warning: string | null;
  error: string | null;
}

interface QaPair {
  question: string;
  answer: string;
}

export function DocumentDetail({ document }: { document: DocumentDetailData }) {
  const router = useRouter();
  const [summary, setSummary] = useState(document.summary);
  const [tablesMarkdown, setTablesMarkdown] = useState(document.tables_markdown);
  const [report, setReport] = useState(document.report_markdown);
  const [question, setQuestion] = useState("");
  const [qaHistory, setQaHistory] = useState<QaPair[]>([]);

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isExtractingTables, setIsExtractingTables] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  const hasText = document.extracted_text.trim().length > 0;

  async function runAction<T>(
    endpoint: string,
    setLoading: (v: boolean) => void,
    onSuccess: (data: T) => void
  ) {
    setLoading(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Request failed");
      onSuccess(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function askQuestion() {
    const trimmed = question.trim();
    if (!trimmed || isAsking) return;
    setIsAsking(true);
    try {
      const response = await fetch(`/api/documents/${document.id}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Couldn't answer that question.");
      setQaHistory((current) => [...current, { question: trimmed, answer: data.answer }]);
      setQuestion("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't answer that question.");
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {document.status === "failed" ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
            <p>{document.error ?? "Extraction failed for this document."}</p>
          </CardContent>
        </Card>
      ) : null}
      {document.warning ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 py-4 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p>{document.warning}</p>
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="text">Extracted text</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="ask">Ask</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <Card>
            <CardContent className="grid gap-3 pt-6">
              {summary ? (
                <Markdown content={summary} />
              ) : (
                <p className="text-muted-foreground text-sm">No summary yet.</p>
              )}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasText || isSummarizing}
                  onClick={() =>
                    runAction<{ summary: string }>(
                      `/api/documents/${document.id}/summarize`,
                      setIsSummarizing,
                      (data) => {
                        setSummary(data.summary);
                        router.refresh();
                      }
                    )
                  }
                >
                  {isSummarizing ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <RefreshCw />
                  )}
                  {summary ? "Regenerate summary" : "Generate summary"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {hasText ? (
                <pre className="max-h-[60vh] overflow-auto text-sm whitespace-pre-wrap">
                  {document.extracted_text}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm">No extracted text.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tables" className="mt-4 grid gap-4">
          {document.tables.length > 0 ? (
            document.tables.map((table) => (
              <Card key={table.name}>
                <CardContent className="overflow-x-auto pt-6">
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                    <Table2 className="size-4" />
                    {table.name}
                  </p>
                  <table className="w-full border-collapse text-sm">
                    <tbody>
                      {table.rows.map((row, i) => (
                        <tr key={i} className={i === 0 ? "font-medium" : undefined}>
                          {row.map((cell, j) => (
                            <td key={j} className="border px-2 py-1">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="grid gap-3 pt-6">
                {tablesMarkdown ? (
                  <Markdown content={tablesMarkdown} />
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No tables detected yet — this document type needs AI to find
                    tabular data (exact for spreadsheets, best-effort here).
                  </p>
                )}
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasText || isExtractingTables}
                    onClick={() =>
                      runAction<{ tablesMarkdown: string }>(
                        `/api/documents/${document.id}/extract-tables`,
                        setIsExtractingTables,
                        (data) => setTablesMarkdown(data.tablesMarkdown)
                      )
                    }
                  >
                    {isExtractingTables ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Sparkles />
                    )}
                    Find tables
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <Card>
            <CardContent className="grid gap-3 pt-6">
              {report ? (
                <Markdown content={report} />
              ) : (
                <p className="text-muted-foreground text-sm">No report yet.</p>
              )}
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasText || isGeneratingReport}
                  onClick={() =>
                    runAction<{ report: string }>(
                      `/api/documents/${document.id}/report`,
                      setIsGeneratingReport,
                      (data) => setReport(data.report)
                    )
                  }
                >
                  {isGeneratingReport ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Sparkles />
                  )}
                  {report ? "Regenerate report" : "Generate report"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ask" className="mt-4 grid gap-4">
          {qaHistory.map((qa, index) => (
            <Card key={index}>
              <CardContent className="grid gap-2 pt-6">
                <p className="text-sm font-medium">{qa.question}</p>
                <Markdown content={qa.answer} />
              </CardContent>
            </Card>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void askQuestion();
            }}
          >
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={hasText ? "Ask a question about this document…" : "No extracted text to ask about"}
              rows={2}
              disabled={!hasText || isAsking}
              className="flex-1 resize-none"
            />
            <Button type="submit" size="icon" disabled={!hasText || isAsking || !question.trim()}>
              {isAsking ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
