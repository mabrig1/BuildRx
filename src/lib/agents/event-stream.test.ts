import { describe, expect, it } from "vitest";

import { AgentEventStream } from "@/lib/agents/event-stream";

const complete = JSON.stringify({
  type: "workflow_complete",
  previewUrl: "/api/preview/project",
  fileCount: 12,
  verificationPassed: false,
});

describe("AgentEventStream", () => {
  it("preserves events across chunk boundaries", () => {
    const stream = new AgentEventStream();
    expect(stream.push('{"type":"agent_start","agent":"planner",')).toEqual([]);
    expect(stream.push('"message":"Planning"}\n')).toEqual([
      { type: "agent_start", agent: "planner", message: "Planning" },
    ]);
    expect(stream.push(complete.slice(0, 30))).toEqual([]);
    expect(stream.push(complete.slice(30) + "\n")).toEqual([
      expect.objectContaining({ type: "workflow_complete", verificationPassed: false }),
    ]);
    expect(stream.end()).toEqual([]);
  });

  it("recovers completion without a trailing newline", () => {
    const stream = new AgentEventStream();
    expect(stream.push(complete)).toEqual([]);
    expect(stream.end()).toEqual([expect.objectContaining({ type: "workflow_complete" })]);
  });

  it("rejects clean socket close without confirmed completion", () => {
    const stream = new AgentEventStream();
    stream.push('{"type":"agent_start","agent":"planner","message":"Working"}\n');
    expect(() => stream.end()).toThrow(/closed before the server confirmed completion/i);
  });

  it("retains the server error when a build terminates", () => {
    const stream = new AgentEventStream();
    const error = JSON.stringify({ type: "error", message: "Provider unavailable" });
    stream.push(error + "\n");
    expect(() => stream.end()).toThrow(/Provider unavailable/);
  });

  it("rejects corrupt progress lines rather than silently treating them as success", () => {
    const stream = new AgentEventStream();
    expect(() => stream.push("not-json\n")).toThrow(/malformed/);
  });

  it("bounds pending stream memory", () => {
    const stream = new AgentEventStream();
    expect(() => stream.push("x".repeat(1_000_001))).toThrow(/size limit/i);
  });

  it("rejects post-completion events", () => {
    const stream = new AgentEventStream();
    stream.push(complete + "\n");
    expect(() => stream.push('{"type":"agent_start"}\n')).toThrow(/after build completion/);
  });
});
