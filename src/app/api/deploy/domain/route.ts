import { NextResponse } from "next/server";
import { z } from "zod";

import {
  addNetlifyDomain,
  addVercelDomain,
  DeployError,
} from "@/lib/deploy/providers";
import { demoDeployState, getProviderToken } from "@/lib/deploy/service";
import { getSession } from "@/lib/github/service";
import { createClient } from "@/lib/supabase/server";

const domainSchema = z.object({
  projectId: z.string().min(1).max(100),
  provider: z.enum(["vercel", "netlify", "railway"]),
  domain: z
    .string()
    .regex(
      /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/i,
      "Enter a valid domain (e.g. app.example.com)"
    ),
});

/** POST — attach a custom domain to the deployed project. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = domainSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { projectId, provider, domain } = parsed.data;

  if (session.demo) {
    demoDeployState().domains.set(projectId, domain);
    return NextResponse.json({
      domain,
      simulated: true,
      instructions: `Point a CNAME record for ${domain} at your ${provider} site.`,
    });
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Provider-side attachment (Railway domains are managed in its UI).
  const token = await getProviderToken(provider);
  let instructions = `Point a CNAME record for ${domain} at your ${provider} site.`;
  try {
    if (token && provider === "vercel") {
      await addVercelDomain(token, project.name, domain);
      instructions = `Domain added on Vercel — set the DNS records Vercel shows for ${domain}.`;
    } else if (token && provider === "netlify") {
      await addNetlifyDomain(token, project.name, domain);
      instructions = `Domain set on Netlify — point ${domain} at Netlify's load balancer.`;
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof DeployError
            ? error.message
            : "Failed to attach the domain",
      },
      { status: 502 }
    );
  }

  const { error } = await supabase
    .from("projects")
    .update({ custom_domain: domain })
    .eq("id", projectId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ domain, instructions });
}
