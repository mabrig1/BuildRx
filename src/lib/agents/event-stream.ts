import type { AgentEvent } from "@/lib/agents/types";

/**
 * Incremental parser for NDJSON agent progress. A closed stream isn't proof of
 * a successful build: the server must explicitly emit workflow_complete.
 */
export class AgentEventStream {
  private partial = "";
  private finished = false;
  private fatalMessage: string | null = null;

  private decode(line: string): AgentEvent {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      throw new Error("Received a malformed build progress event.");
    }
    if (!value || typeof value !== "object" || typeof (value as { type?: unknown }).type !== "string") {
      throw new Error("Received an invalid build progress event.");
    }
    const event = value as AgentEvent;
    if (event.type === "error" && !event.agent) {
      this.fatalMessage = event.message || "The build stopped unexpectedly.";
    }
    if (event.type === "workflow_complete") {
      this.finished = true;
    }
    return event;
  }

  push(text: string): AgentEvent[] {
    if (this.finished && text.trim()) throw new Error("Unexpected data after build completion.");
    this.partial += text;
    if (this.partial.length > 1_000_000) {
      throw new Error("The build progress stream exceeded its size limit.");
    }
    const lines = this.partial.split("\n");
    this.partial = lines.pop() ?? "";
    return lines.filter((line) => line.trim()).map((line) => this.decode(line));
  }

  end(): AgentEvent[] {
    const trailing = this.partial.trim();
    this.partial = "";
    const events = trailing ? [this.decode(trailing)] : [];
    if (!this.finished) {
      throw new Error(
        this.fatalMessage ??
          "The build connection closed before the server confirmed completion. The build may have stopped; inspect the project before retrying."
      );
    }
    return events;
  }
}
