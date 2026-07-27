import {
  FILE_FORMAT_INSTRUCTIONS,
  canCallModel,
  degradedEvent,
  diagnoseModelFailure,
  parseFileBlocks,
  pause,
  runAgentCompletion,
  stepBudgetMs,
} from "@/lib/agents/llm";
import type { Agent, GeneratedFile } from "@/lib/agents/types";

const SYSTEM = `You are the Debug Agent in an automated app-building pipeline. Review the generated project files for real defects: syntax errors, unbalanced braces/tags, imports that reference files which don't exist, exports that don't match their usage, and obviously broken logic.

If a file needs fixing, output the CORRECTED full file. Output nothing for files that are fine. If everything is fine, output the single word OK.

${FILE_FORMAT_INSTRUCTIONS}`;

/** Cheap static checks used in mock mode (and as a safety net). */
function staticIssues(file: GeneratedFile): string[] {
  const issues: string[] = [];
  const isCode = /\.(tsx?|jsx?|css|sql|html)$/.test(file.path);
  if (!isCode) return issues;

  const opens = (file.content.match(/\{/g) ?? []).length;
  const closes = (file.content.match(/\}/g) ?? []).length;
  if (opens !== closes) {
    issues.push(`unbalanced braces (${opens} '{' vs ${closes} '}')`);
  }
  if (file.content.trim().length === 0) {
    issues.push("file is empty");
  }
  return issues;
}

export const debugAgent: Agent = {
  name: "debug",
  async run(context, emit) {
    emit({
      type: "agent_start",
      agent: "debug",
      message: "Reviewing generated code for errors…",
    });

    const files = [...context.files.values()];

    // Static pass runs in both modes.
    const flagged = files
      .map((file) => ({ file, issues: staticIssues(file) }))
      .filter((entry) => entry.issues.length > 0);

    for (const entry of flagged) {
      emit({
        type: "agent_log",
        agent: "debug",
        message: `${entry.file.path}: ${entry.issues.join("; ")}`,
      });
    }

    if (!canCallModel(context)) {
      await pause(700);
      emit({
        type: "agent_complete",
        agent: "debug",
        message:
          flagged.length === 0
            ? `Checked ${files.length} files — no issues found`
            : `Flagged ${flagged.length} file(s) for review`,
      });
      return;
    }

    // LLM review: send files (bounded) and apply any corrected versions.
    // The bundle is capped hard — reviewing every byte of a 20-file app
    // costs more time than this step has, and a truncated request that
    // times out helps nobody. Statically flagged files go first, then
    // the rest, so the most suspect code is always in the window.
    const MAX_PER_FILE = 2500;
    const MAX_FILES = 10;
    const flaggedPaths = new Set(flagged.map((entry) => entry.file.path));
    const reviewOrder = [
      ...files.filter((file) => flaggedPaths.has(file.path)),
      ...files.filter((file) => !flaggedPaths.has(file.path)),
    ].slice(0, MAX_FILES);
    const bundle = reviewOrder
      .map(
        (file) =>
          `===FILE: ${file.path}===\n${file.content.slice(0, MAX_PER_FILE)}\n===END===`
      )
      .join("\n\n");

    // A review pass is an improvement, not a requirement: if the model
    // can't deliver one in its slice, the already-generated files stand
    // as they are rather than the build failing at the last step.
    let fixes: GeneratedFile[] = [];
    let note = "";
    try {
      const text = await runAgentCompletion({
        system: SYSTEM,
        prompt: `Review these generated project files:\n\n${bundle}`,
        role: "diagnostics",
        timeoutMs: stepBudgetMs(context),
      });
      fixes = parseFileBlocks(text);
    } catch (error) {
      const failure = diagnoseModelFailure(error);
      note = ` — review skipped (${failure.summary})`;
      emit(
        degradedEvent(
          "debug",
          "The generated code was not reviewed for defects.",
          failure
        )
      );
    }

    // Only files the reviewer saw in full may be replaced. A file that
    // was truncated into the bundle comes back "corrected" but shorter
    // than the original, so applying it would silently delete code.
    const reviewedInFull = new Set(
      reviewOrder
        .filter((file) => file.content.length <= MAX_PER_FILE)
        .map((file) => file.path)
    );

    let applied = 0;
    for (const fix of fixes) {
      if (context.files.has(fix.path) && reviewedInFull.has(fix.path)) {
        context.files.set(fix.path, fix);
        applied++;
        emit({
          type: "agent_log",
          agent: "debug",
          message: `Fixed ${fix.path}`,
        });
        emit({ type: "file", agent: "debug", path: fix.path });
      }
    }

    emit({
      type: "agent_complete",
      agent: "debug",
      message: note
        ? `Checked ${reviewOrder.length} of ${files.length} files${note}`
        : applied === 0
          ? `Checked ${reviewOrder.length} of ${files.length} files — no issues found`
          : `Fixed ${applied} file(s)`,
    });
  },
};
