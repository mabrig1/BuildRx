import { NextResponse } from "next/server";

import { getFileSystem } from "@/lib/files/manager";

const DEMO_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>Demo Preview</title>
<style>
  body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #fafafa; color: #18181b; }
  .wrap { text-align: center; padding: 24px; }
  h1 { letter-spacing: -0.02em; }
  p { color: #71717a; }
</style></head>
<body><div class="wrap">
  <h1>✨ Your generated app renders here</h1>
  <p>Run the agent pipeline on a real project (with Supabase connected) to publish a preview.</p>
</div></body>
</html>`;

/**
 * GET /api/preview/[projectId] — serves the generated static preview
 * (the "preview/index.html" file the UI Agent produces). RLS scopes
 * access to the project owner (or anyone, for public projects).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const file = await getFileSystem(projectId)
    .read("preview/index.html")
    .catch(() => null);

  if (!file) {
    // Demo mode with no build yet: show the placeholder page.
    if (projectId.startsWith("demo-")) {
      return new NextResponse(DEMO_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new NextResponse(
      "<!doctype html><html><body style='font-family:system-ui;display:grid;place-items:center;min-height:100vh;color:#71717a'>No preview yet — run a build first.</body></html>",
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  // Forward runtime errors/logs from the previewed page to the parent
  // frame so the workspace error console can display them.
  const forwarder = `<script>(function(){
  function send(level, text){ try { parent.postMessage({ __previewEvent: { level: level, text: String(text).slice(0, 2000) } }, "*"); } catch(e){}
  }
  window.addEventListener("error", function(e){ send("error", e.message + (e.filename ? " (" + e.filename + ":" + e.lineno + ")" : "")); });
  window.addEventListener("unhandledrejection", function(e){ send("error", "Unhandled rejection: " + (e.reason && e.reason.message || e.reason)); });
  var origError = console.error, origWarn = console.warn;
  console.error = function(){ send("error", Array.prototype.join.call(arguments, " ")); origError.apply(console, arguments); };
  console.warn = function(){ send("warn", Array.prototype.join.call(arguments, " ")); origWarn.apply(console, arguments); };
})();</script>`;
  const html = file.content.includes("</body>")
    ? file.content.replace("</body>", `${forwarder}</body>`)
    : file.content + forwarder;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Generated content: keep it sandboxed away from the app origin.
      //
      // Framing is restricted with frame-ancestors, NOT X-Frame-Options.
      // next.config.ts already applies X-Frame-Options to every route; a
      // second one here made the browser see "SAMEORIGIN, SAMEORIGIN",
      // which is not a valid X-Frame-Options value, so Chromium fell
      // back to DENY and blocked the workspace's own preview iframe
      // (ERR_BLOCKED_BY_RESPONSE) even though it is same-origin.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'; frame-ancestors 'self'",
      // Owner-scoped content — never let shared caches store it.
      "Cache-Control": "private, no-store",
    },
  });
}
