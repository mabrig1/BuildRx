import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

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

  if (!isSupabaseConfigured()) {
    return new NextResponse(DEMO_HTML, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("project_files")
    .select("content")
    .eq("project_id", projectId)
    .eq("path", "preview/index.html")
    .maybeSingle();

  if (!file) {
    return new NextResponse(
      "<!doctype html><html><body style='font-family:system-ui;display:grid;place-items:center;min-height:100vh;color:#71717a'>No preview yet — run a build first.</body></html>",
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  return new NextResponse(file.content, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Generated content: keep it sandboxed away from the app origin.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'unsafe-inline'",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
