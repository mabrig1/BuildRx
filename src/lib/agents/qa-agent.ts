import { checksPass, runStaticChecks } from "@/lib/agents/checks";
import type { Agent } from "@/lib/agents/types";

/**
 * QA/Test Agent — runs the static verification suite against everything
 * generated so far and records the findings for the Repair Agent.
 *
 * Deterministic by design: it costs no model time, so it always runs in
 * full no matter how late the build is, and its findings are precise
 * enough ("src/app/page.tsx imports @/components/hero but no such file
 * exists") for repairs to be targeted rather than speculative.
 */
export const qaAgent: Agent = {
  name: "qa",
  async run(context, emit) {
    emit({
      type: "agent_start",
      agent: "qa",
      message: "Running build and test checks…",
    });

    const findings = runStaticChecks(context, context.plan!);
    context.findings = findings;

    const errors = findings.filter((finding) => finding.severity === "error");
    const warnings = findings.length - errors.length;

    for (const finding of findings.slice(0, 10)) {
      emit({
        type: "agent_log",
        agent: "qa",
        message: `${finding.severity === "error" ? "✗" : "△"} ${finding.file ? `${finding.file}: ` : ""}${finding.message}`,
      });
    }

    emit({
      type: "agent_complete",
      agent: "qa",
      message: checksPass(findings)
        ? `All checks passed (${context.files.size} files${warnings > 0 ? `, ${warnings} warning(s)` : ""})`
        : `${errors.length} error(s), ${warnings} warning(s) — handing off to the Repair Agent`,
    });
  },
};
