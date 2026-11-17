import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "MABRIG SwarmLab — 20–50 Agent Demonstration",
  description: "Inspect how 20–50 scripted specialist agents collaborate before moving a reviewed mission into BuildRx.",
};

/**
 * The isolated standalone demonstrator is served from public/swarm-lab/index.html.
 * Redirect instead of embedding it in an iframe so exports, accessibility, and
 * the session-only BuildRx project handoff keep working on the same origin.
 */
export default function SwarmLabPage() {
  redirect("/swarm-lab/index.html");
}
