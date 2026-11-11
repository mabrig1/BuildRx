import type { PlaygroundExercise } from "@/lib/learn/playground-exercises";

export const MAX_PRACTICE_CODE_CHARS = 12_000;
export const PRACTICE_TIMEOUT_MS = 5_000;

/**
 * Browser-only teaching runner. The iframe MUST be mounted with
 * sandbox="allow-scripts" (never allow-same-origin).
 *
 * No student code executes in the BuildRx origin or on the server.
 * The opaque-origin iframe starts a short-lived blob worker; both are
 * constrained by CSP. The host destroys the iframe after every run.
 * These tests provide *untrusted educational feedback*, not attestation.
 *
 * If a browser blocks opaque-origin Workers, fail closed. Never fall back
 * to eval/new Function in the privileged parent app.
 */
export const ISOLATED_JS_RUNNER_DOCUMENT = String.raw\`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; worker-src blob:; connect-src 'none'; img-src 'none'; style-src 'none'; font-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none';">
</head><body><script>
(function () {
  "use strict";
  var activeWorker = null;
  var activeUrl = null;
  var activeTimer = null;

  function finish(id, cases, error) {
    if (activeTimer !== null) { clearTimeout(activeTimer); activeTimer = null; }
    if (activeWorker) { activeWorker.terminate(); activeWorker = null; }
    if (activeUrl) { URL.revokeObjectURL(activeUrl); activeUrl = null; }
    window.parent.postMessage({
      type: "buildrx.practice.result",
      runId: id,
      cases: Array.isArray(cases) ? cases.slice(0, 8) : [],
      error: error ? String(error).slice(0, 240) : null
    }, "*");
  }

  function isolatedWorkerMain() {
    "use strict";
    self.onmessage = function (event) {
      var input = event.data;
      var cases = [];
      try {
        if (!input || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(input.functionName)) {
          throw new Error("Invalid exercise function");
        }
        if (typeof input.code !== "string" || input.code.length > 12000) {
          throw new Error("Code exceeds the practice size limit");
        }
        var body = '"use strict";\n' + input.code + '\nreturn typeof ' +
          input.functionName + ' === "function" ? ' + input.functionName + ' : null;';
        var fn = new Function(body)();
        if (typeof fn !== "function") {
          throw new Error("Define the requested function before testing.");
        }
        var tests = Array.isArray(input.tests) ? input.tests.slice(0, 8) : [];
        for (var i = 0; i < tests.length; i++) {
          var testcase = tests[i];
          try {
            var args = JSON.parse(JSON.stringify(testcase.args));
            var actual = fn.apply(null, args);
            if (actual && typeof actual.then === "function") {
              throw new Error("Return a value rather than a Promise in this exercise.");
            }
            var pass = JSON.stringify(actual) === JSON.stringify(testcase.expected);
            cases.push({
              label: String(testcase.label).slice(0, 100),
              pass: pass,
              actual: JSON.stringify(actual) === undefined ? "undefined" :
                String(JSON.stringify(actual)).slice(0, 160)
            });
          } catch (error) {
            cases.push({
              label: String(testcase.label).slice(0, 100),
              pass: false,
              actual: error instanceof Error ? error.message.slice(0, 160) : "Test failed"
            });
          }
        }
        self.postMessage({ cases: cases, error: null });
      } catch (error) {
        self.postMessage({
          cases: cases,
          error: error instanceof Error ? error.message.slice(0, 240) : "Execution failed"
        });
      }
    };
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    var data = event.data;
    if (!data || data.type !== "buildrx.practice.run" ||
        typeof data.runId !== "string" || typeof data.code !== "string" ||
        typeof data.functionName !== "string" || !Array.isArray(data.tests)) return;

    if (activeWorker) { activeWorker.terminate(); activeWorker = null; }
    if (activeTimer !== null) { clearTimeout(activeTimer); activeTimer = null; }
    if (activeUrl) { URL.revokeObjectURL(activeUrl); activeUrl = null; }

    try {
      var source = "(" + isolatedWorkerMain.toString() + ")();";
      activeUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
      activeWorker = new Worker(activeUrl);
      var id = data.runId;
      activeWorker.onmessage = function (reply) {
        var out = reply.data || {};
        finish(id, out.cases, out.error);
      };
      activeWorker.onerror = function () { finish(id, [], "Sandbox worker could not run this code."); };
      activeTimer = setTimeout(function () {
        finish(id, [], "The practice code exceeded its 2.5-second runtime limit.");
      }, 2500);
      activeWorker.postMessage({
        code: data.code,
        functionName: data.functionName,
        tests: data.tests.slice(0, 8)
      });
    } catch (error) {
      finish(data.runId, [], "Isolated execution is unavailable in this browser.");
    }
  });
}());
</script></body></html>\`;

/**
 * A visual-only HTML/CSS preview. Sandbox must remain empty: no scripts,
 * same-origin permissions, forms or popups. CSP also blocks all networking.
 * The snippets are *displayed*, not submitted to a hosting provider.
 */
export function visualPracticePreview(exercise: PlaygroundExercise, code: string): string {
  const fixedStyle = [
    "body{font-family:system-ui,sans-serif;margin:0;padding:16px;color:#18212c;background:#fafafa}",
    "main{max-width:600px;margin:auto}",
    "h1{font-size:24px}",
    "button,input{font:inherit;padding:.6rem}",
    "button{cursor:default}",
  ].join("");
  const css = exercise.kind === "css" ? code : fixedStyle;
  const html = exercise.kind === "css" ? (exercise.fixedHtml ?? "") : code;
  // Prevent a CSS string from closing the style element to insert markup.
  const safeCss = css.replace(/<\/style/gi, "<\\/style");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; ' +
    'script-src &#39;none&#39;; connect-src &#39;none&#39;; ' +
    'style-src &#39;unsafe-inline&#39;; img-src data:; font-src &#39;none&#39;; ' +
    'frame-src &#39;none&#39;; form-action &#39;none&#39;; ' +
    'base-uri &#39;none&#39;; object-src &#39;none&#39;;">' +
    '<style>' + safeCss + '</style></head><body>' + html + '</body></html>';
}

export interface PracticeCheck {
  label: string;
  pass: boolean;
  actual?: string;
}

/**
 * Formative pattern checks only. They intentionally cannot certify the DOM,
 * visual accessibility, native apps, network services, or user identity.
 */
export function staticPracticeChecks(
  exercise: PlaygroundExercise,
  source: string,
): PracticeCheck[] {
  if (exercise.kind === "javascript" || !exercise.checks) return [];
  // Comments must not satisfy checks by merely mentioning required tags.
  const visible = exercise.kind === "html"
    ? source.replace(/<!--[\s\S]*?-->/g, "")
    : source.replace(/\/\*[\s\S]*?\*\//g, "");
  return exercise.checks.map(check => ({
    label: check.label,
    pass: new RegExp(check.pattern, check.flags).test(visible),
  }));
}

export function validPracticeCode(source: string): boolean {
  return source.length > 0 && source.length <= MAX_PRACTICE_CODE_CHARS;
}
