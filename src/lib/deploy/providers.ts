import { createHash } from "crypto";

/**
 * Deployment provider adapters (server-only).
 *
 * Vercel and Netlify deploy the generated static site (the project's
 * preview build) through their public APIs. Railway deploys from a
 * connected GitHub repository, so its adapter produces a guided
 * continuation rather than an API upload.
 */

export type DeployProviderName = "vercel" | "netlify" | "railway";

export interface DeployInput {
  projectName: string;
  /** Project files, keyed by deployment-relative path. */
  files: Array<{ path: string; content: string }>;
  githubRepo: string | null;
  framework?: "nextjs" | null;
}

export interface DeployOutcome {
  status: "live" | "failed" | "queued";
  url: string | null;
  providerId: string | null;
}

export type LogFn = (line: string) => void;

export class DeployError extends Error {}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 52) || "app-creator-site"
  );
}

// ------------------------------------------------------------------
// Vercel — digest upload followed by /v13/deployments
// ------------------------------------------------------------------

interface VercelFileDescriptor {
  file: string;
  sha: string;
  size: number;
}

async function uploadVercelFiles(
  token: string,
  files: DeployInput["files"],
  log: LogFn
): Promise<VercelFileDescriptor[]> {
  const descriptors = files.map((file) => {
    const bytes = Buffer.from(file.content, "utf8");
    return {
      file: file.path,
      sha: createHash("sha1").update(bytes).digest("hex"),
      size: bytes.byteLength,
      bytes,
    };
  });

  log(`Uploading ${descriptors.length} source files to Vercel…`);
  for (const descriptor of descriptors) {
    const response = await fetch("https://api.vercel.com/v2/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/octet-stream",
        "x-vercel-digest": descriptor.sha,
      },
      body: descriptor.bytes,
    });
    if (!response.ok && response.status !== 409) {
      const data = await response.json().catch(() => null);
      throw new DeployError(
        data?.error?.message ??
          `Failed to upload ${descriptor.file} to Vercel (${response.status})`
      );
    }
  }

  return descriptors.map(({ file, sha, size }) => ({ file, sha, size }));
}

export async function deployToVercel(
  token: string,
  input: DeployInput,
  log: LogFn
): Promise<DeployOutcome> {
  const name = slugify(input.projectName);
  log(`Creating Vercel deployment for "${name}"…`);
  const files = await uploadVercelFiles(token, input.files, log);

  const response = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      target: "production",
      files,
      projectSettings: { framework: input.framework ?? null },
    }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new DeployError(
      data?.error?.message ?? `Vercel API error (${response.status})`
    );
  }

  const deploymentId: string = data.id;
  let url: string = data.url;
  log(`Deployment created: ${deploymentId}`);

  // Poll until READY / ERROR (bounded).
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(
      `https://api.vercel.com/v13/deployments/${deploymentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const state = await poll.json().catch(() => null);
    const readyState: string = state?.readyState ?? "UNKNOWN";
    log(`Status: ${readyState}`);
    url = state?.url ?? url;
    if (readyState === "READY") {
      return {
        status: "live",
        url: `https://${url}`,
        providerId: deploymentId,
      };
    }
    if (readyState === "ERROR" || readyState === "CANCELED") {
      throw new DeployError(`Vercel build ${readyState.toLowerCase()}`);
    }
  }
  log("Build still running — check the Vercel dashboard for completion.");
  return { status: "queued", url: `https://${url}`, providerId: deploymentId };
}

/** Attach a custom domain to the Vercel project. */
export async function addVercelDomain(
  token: string,
  projectName: string,
  domain: string
): Promise<void> {
  const response = await fetch(
    `https://api.vercel.com/v10/projects/${slugify(projectName)}/domains`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new DeployError(
      data?.error?.message ?? `Failed to add domain (${response.status})`
    );
  }
}

// ------------------------------------------------------------------
// Netlify — file-digest deployment via /api/v1
// ------------------------------------------------------------------

export async function deployToNetlify(
  token: string,
  input: DeployInput,
  log: LogFn
): Promise<DeployOutcome> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const siteName = slugify(input.projectName);

  // Find or create the site.
  log(`Looking up Netlify site "${siteName}"…`);
  let siteId: string | null = null;
  const sites = await fetch(
    `https://api.netlify.com/api/v1/sites?name=${siteName}`,
    { headers }
  ).then((r) => (r.ok ? r.json() : []));
  const existing = Array.isArray(sites)
    ? sites.find((s: { name: string }) => s.name === siteName)
    : null;

  if (existing) {
    siteId = existing.id;
    log("Using existing site.");
  } else {
    const created = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: siteName }),
    });
    const site = await created.json().catch(() => null);
    if (!created.ok) {
      throw new DeployError(
        site?.message ?? `Failed to create Netlify site (${created.status})`
      );
    }
    siteId = site.id;
    log("Site created.");
  }

  // Digest deploy: send sha1 per file, upload what Netlify asks for.
  const digests: Record<string, string> = {};
  for (const file of input.files) {
    digests[`/${file.path}`] = createHash("sha1")
      .update(file.content, "utf8")
      .digest("hex");
  }
  log(`Creating deploy with ${input.files.length} files…`);
  const deployResponse = await fetch(
    `https://api.netlify.com/api/v1/sites/${siteId}/deploys`,
    { method: "POST", headers, body: JSON.stringify({ files: digests }) }
  );
  const deploy = await deployResponse.json().catch(() => null);
  if (!deployResponse.ok) {
    throw new DeployError(
      deploy?.message ?? `Netlify deploy failed (${deployResponse.status})`
    );
  }

  const required: string[] = deploy.required ?? [];
  log(`Uploading ${required.length} changed files…`);
  for (const file of input.files) {
    const sha = digests[`/${file.path}`];
    if (!required.includes(sha)) continue;
    const upload = await fetch(
      `https://api.netlify.com/api/v1/deploys/${deploy.id}/files/${encodeURIComponent(file.path)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
        },
        body: file.content,
      }
    );
    if (!upload.ok) {
      throw new DeployError(`Failed to upload ${file.path}`);
    }
    log(`Uploaded ${file.path}`);
  }

  // Poll deploy state.
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(
      `https://api.netlify.com/api/v1/deploys/${deploy.id}`,
      { headers }
    );
    const state = await poll.json().catch(() => null);
    log(`Status: ${state?.state ?? "unknown"}`);
    if (state?.state === "ready") {
      return {
        status: "live",
        url: state.ssl_url ?? state.url,
        providerId: deploy.id,
      };
    }
    if (state?.state === "error") {
      throw new DeployError("Netlify deploy errored");
    }
  }
  return { status: "queued", url: deploy.ssl_url ?? null, providerId: deploy.id };
}

/** Attach a custom domain to the Netlify site. */
export async function addNetlifyDomain(
  token: string,
  projectName: string,
  domain: string
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const siteName = slugify(projectName);
  const sites = await fetch(
    `https://api.netlify.com/api/v1/sites?name=${siteName}`,
    { headers }
  ).then((r) => (r.ok ? r.json() : []));
  const site = Array.isArray(sites)
    ? sites.find((s: { name: string }) => s.name === siteName)
    : null;
  if (!site) throw new DeployError("Deploy the site to Netlify first.");

  const response = await fetch(
    `https://api.netlify.com/api/v1/sites/${site.id}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ custom_domain: domain }),
    }
  );
  if (!response.ok) {
    throw new DeployError(`Failed to set domain (${response.status})`);
  }
}

// ------------------------------------------------------------------
// Railway — guided deploy from the connected GitHub repository
// ------------------------------------------------------------------

export async function deployToRailway(
  _token: string,
  input: DeployInput,
  log: LogFn
): Promise<DeployOutcome> {
  if (!input.githubRepo) {
    throw new DeployError(
      "Railway deploys from a GitHub repository — connect GitHub and push your project first."
    );
  }
  const template = `https://railway.com/new/github?repo=${encodeURIComponent(input.githubRepo)}`;
  log(`Railway deploys from your GitHub repository (${input.githubRepo}).`);
  log(`Continue in Railway to provision the service: ${template}`);
  return { status: "queued", url: template, providerId: null };
}
