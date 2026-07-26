import { runStaticChecks } from "@/lib/agents/checks";
import { listFiles, readFile, writeFile } from "@/lib/agents/tools";
import type { Agent, CheckFinding } from "@/lib/agents/types";

/** The check-suite rules this agent owns. */
const SECURITY_RULES = new Set([
  "hardcoded-nvidia-key",
  "hardcoded-secret-key",
  "hardcoded-jwt",
  "eval-usage",
  "public-secret-env",
  "platform-key-reference",
]);

/**
 * Security Agent — scans the generated app before QA runs.
 *
 * Deterministic on purpose: secret detection is pattern work a model
 * adds nothing to, and it must run even when the build is out of model
 * budget. Hardcoded secrets are redacted immediately (never left for a
 * later step to maybe fix); an .env.example is generated from every
 * server-side env var the generated code references, so the app
 * documents its own configuration; remaining findings (eval usage,
 * NEXT_PUBLIC_ leaks) are handed to the repair loop as llm-fixable.
 */
export const securityAgent: Agent = {
  name: "security",
  async run(context, emit) {
    emit({
      type: "agent_start",
      agent: "security",
      message: "Scanning for security issues…",
    });

    const findings = runStaticChecks(context, context.plan!).filter((finding) =>
      SECURITY_RULES.has(finding.rule)
    );

    // Redact hardcoded secrets on the spot.
    let redacted = 0;
    for (const finding of findings) {
      if (!finding.rule.startsWith("hardcoded-") || !finding.file) continue;
      const file = readFile(context, finding.file);
      if (!file) continue;
      writeFile(
        context,
        finding.file,
        file.content
          .replace(/nvapi-[A-Za-z0-9_-]{20,}/g, "REDACTED")
          .replace(/sk-[A-Za-z0-9_-]{20,}/g, "REDACTED")
          .replace(
            /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g,
            "REDACTED"
          )
      );
      redacted++;
      emit({
        type: "agent_log",
        agent: "security",
        message: `Redacted a hardcoded secret in ${finding.file}`,
      });
    }

    // Document every server-side env var the generated code reads.
    const envVars = new Set<string>();
    for (const path of listFiles(context)) {
      if (!/\.(tsx?|jsx?)$/.test(path)) continue;
      const content = readFile(context, path)?.content ?? "";
      for (const match of content.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
        if (!match[1].startsWith("NEXT_PUBLIC_")) envVars.add(match[1]);
      }
    }
    if (envVars.size > 0 && !context.files.has(".env.example")) {
      writeFile(
        context,
        ".env.example",
        `# Environment variables this app reads (server-side only)\n${[...envVars]
          .sort()
          .map((name) => `${name}=`)
          .join("\n")}\n`
      );
      emit({
        type: "agent_log",
        agent: "security",
        message: `Documented ${envVars.size} env var(s) in .env.example`,
      });
    }

    const open: CheckFinding[] = findings.filter(
      (finding) => !finding.rule.startsWith("hardcoded-")
    );
    emit({
      type: "agent_complete",
      agent: "security",
      message:
        findings.length === 0
          ? `No security issues in ${context.files.size} files`
          : `${redacted} secret(s) redacted; ${open.length} issue(s) queued for repair`,
    });
  },
};
