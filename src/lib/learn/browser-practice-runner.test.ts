import { Script } from "node:vm";
import { describe, expect, it } from "vitest";
import { getPlaygroundExercise } from "./playground-exercises";
import {
  ISOLATED_JS_RUNNER_DOCUMENT,
  MAX_PRACTICE_CODE_CHARS,
  PRACTICE_TIMEOUT_MS,
  staticPracticeChecks,
  validPracticeCode,
  visualPracticePreview,
} from "./browser-practice-runner";

describe("browser-only untrusted exercise runner", () => {
  it("requires an opaque-origin frame, worker isolation and blocked connections", () => {
    expect(ISOLATED_JS_RUNNER_DOCUMENT).toContain("worker-src blob:");
    expect(ISOLATED_JS_RUNNER_DOCUMENT).toContain("connect-src 'none'");
    expect(ISOLATED_JS_RUNNER_DOCUMENT).toContain("frame-src 'none'");
    expect(ISOLATED_JS_RUNNER_DOCUMENT).not.toContain("allow-same-origin");
    expect(ISOLATED_JS_RUNNER_DOCUMENT).toContain("activeWorker.terminate()");
    expect(ISOLATED_JS_RUNNER_DOCUMENT).toContain("event.source !== window.parent");
    expect(ISOLATED_JS_RUNNER_DOCUMENT).toContain("new Worker(activeUrl)");
    expect(ISOLATED_JS_RUNNER_DOCUMENT).toContain("2.5-second runtime limit");
    expect(PRACTICE_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });
  it("has a syntactically valid trusted iframe controller script", () => {
    const script = ISOLATED_JS_RUNNER_DOCUMENT.split("<script>")[1]?.split("</script>")[0];
    expect(script).toBeTruthy();
    expect(() => new Script(script!)).not.toThrow();
  });
  it("rejects empty or excessive code", () => {
    expect(validPracticeCode("")).toBe(false);
    expect(validPracticeCode("a")).toBe(true);
    expect(validPracticeCode("a".repeat(MAX_PRACTICE_CODE_CHARS + 1))).toBe(false);
  });
  it("shows visual markup with scripts and network blocked by CSP", () => {
    const lesson = getPlaygroundExercise("html-booking");
    if (!lesson) throw Error("Missing HTML lesson");
    const html = visualPracticePreview(lesson, "<h1>Hello</h1><script>alert(1)</script>");
    expect(html).toContain("script-src &#39;none&#39;");
    expect(html).toContain("connect-src &#39;none&#39;");
    expect(html).toContain("<h1>Hello</h1>");
  });
  it("tests HTML structure but ignores tags mentioned only in comments", () => {
    const lesson = getPlaygroundExercise("html-booking");
    if (!lesson) throw Error("Missing HTML lesson");
    const checks = staticPracticeChecks(lesson, `<!-- <h1><form><label><input required><button> --><main></main>`);
    expect(checks.every(item => !item.pass)).toBe(true);
    const sample = '<h1>Book</h1><form><label>Name<input required></label><button>Book</button></form>';
    const results = staticPracticeChecks(lesson, sample);
    expect(results.length).toBeGreaterThan(4);
    expect(results.every(item => item.pass)).toBe(true);
  });
  it("checks responsive CSS without counting commented hints", () => {
    const lesson = getPlaygroundExercise("css-mobile");
    if (!lesson) throw Error("Missing CSS lesson");
    const start = staticPracticeChecks(lesson, lesson.start);
    expect(start.some(check => !check.pass)).toBe(true);
    const solved = '.grid { display: grid; grid-template-columns: 1fr; } .card { padding: 1rem; } @media (min-width: 40rem) { .grid { grid-template-columns: repeat(2, 1fr); } }';
    expect(staticPracticeChecks(lesson, solved).every(item => item.pass)).toBe(true);
  });
});
