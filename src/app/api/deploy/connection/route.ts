import { NextResponse } from "next/server";
import { z } from "zod";

import { demoDeployState } from "@/lib/deploy/service";
import { getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

const providerEnum = z.enum(["vercel", "netlify", "railway"]);

async function validateToken(
  provider: z.infer<typeof providerEnum>,
  token: string
): Promise<string | null> {
  try {
    if (provider === "vercel") {
      const res = await fetch("https://api.vercel.com/v2/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.user?.username ?? data?.user?.email ?? "vercel-user";
    }
    if (provider === "netlify") {
      const res = await fetch("https://api.netlify.com/api/v1/user", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.slug ?? data?.email ?? "netlify-user";
    }
    // Railway (GraphQL)
    const res = await fetch("https://backboard.railway.com/graphql/v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: "query { me { name email } }" }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.errors) return null;
    return data?.data?.me?.name ?? data?.data?.me?.email ?? "railway-user";
  } catch {
    return null;
  }
}

/** GET — connection status for all deploy providers. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.demo) {
    const tokens = demoDeployState().tokens;
    return NextResponse.json({
      connections: {
        vercel: tokens.has("vercel"),
        netlify: tokens.has("netlify"),
        railway: tokens.has("railway"),
      },
      simulated: true,
    });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("integration_connections")
    .select("provider")
    .in("provider", ["vercel", "netlify", "railway"]);
  const connected = new Set((data ?? []).map((row) => row.provider));
  return NextResponse.json({
    connections: {
      vercel: connected.has("vercel"),
      netlify: connected.has("netlify"),
      railway: connected.has("railway"),
    },
  });
}

const connectSchema = z.object({
  provider: providerEnum,
  token: z.string().min(8).max(500),
});

/** POST — connect a deploy provider with an API token. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid token" }, { status: 400 });
  }
  const { provider, token } = parsed.data;

  if (session.demo) {
    demoDeployState().tokens.set(provider, token);
    return NextResponse.json({ connected: true, simulated: true });
  }

  const account = await validateToken(provider, token);
  if (!account) {
    return NextResponse.json(
      { error: `${provider} rejected the token — check it and try again.` },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.from("integration_connections").upsert(
    {
      user_id: session.userId!,
      provider,
      access_token: token,
      account_name: account,
    },
    { onConflict: "user_id,provider" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ connected: true, account });
}

const disconnectSchema = z.object({ provider: providerEnum });

/** DELETE — disconnect a provider. */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = disconnectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (session.demo) {
    demoDeployState().tokens.delete(parsed.data.provider);
    return NextResponse.json({ connected: false, simulated: true });
  }

  const supabase = await createClient();
  await supabase
    .from("integration_connections")
    .delete()
    .eq("provider", parsed.data.provider);
  return NextResponse.json({ connected: false });
}
