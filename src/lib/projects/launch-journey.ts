/**
 * The beginner launch journey is a teaching aid, not a release controller.
 * Provider check-runs, repository links and self-reported checkboxes never
 * grant deployment permission or establish production readiness.
 */
export type LaunchHost = "cloudflare" | "vercel";
export type DataNeed = "unsure" | "none" | "mongodb" | "supabase";
export type CloudflareCheck = "not_connected" | "building" | "passed" | "failed" | "unknown";
export type StepState = "done" | "action" | "waiting" | "self-reported";

export interface LaunchSignals {
  projectStatus: string;
  githubConnected: boolean | null;
  githubRepo: string | null;
  githubSimulated: boolean;
  deployments: Array<{ provider: string; status: string; url: string | null }>;
  cloudflareCheck: CloudflareCheck | null;
}

export interface LaunchPreferences {
  host: LaunchHost;
  dataNeed: DataNeed;
  databaseConfigured: boolean;
  sourceConfirmed: boolean;
  liveUrl: string;
  liveTestsConfirmed: boolean;
}

export interface JourneyStep {
  id: "build" | "github" | "database" | "publish" | "verify";
  title: string;
  detail: string;
  state: StepState;
}

export function validHttpsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.username === "" && u.password === "" && !!u.hostname && !u.hostname.endsWith(".invalid");
  } catch { return false; }
}

export function safeRepositoryName(repo: string | null): string | null {
  return repo && /^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(repo) ? repo : null;
}

export function evaluateLaunchJourney(
  signals: LaunchSignals,
  choices: LaunchPreferences,
): { steps: JourneyStep[]; next: string; readyToReview: boolean } {
  const built = signals.projectStatus === "ready";
  const repo = safeRepositoryName(signals.githubRepo);
  const linked = !signals.githubSimulated && signals.githubConnected === true && !!repo;
  const sourceReady = linked && choices.sourceConfirmed;
  const databaseDone = choices.dataNeed === "none" ||
    (choices.dataNeed !== "unsure" && choices.databaseConfigured);
  const vercelDeployment = signals.deployments.find(
    (d) => d.provider === "vercel" && d.status === "live" && !!d.url && validHttpsUrl(d.url),
  );
  const cloudflareReported = signals.cloudflareCheck === "passed";
  // Cloudflare GitHub checks do NOT verify a public Worker hostname or app behavior.
  // Even a Vercel 'live' record does not prove that auth/CRUD routes work.
  const providerReported = choices.host === "vercel" ? !!vercelDeployment : cloudflareReported;
  const manualTest = choices.liveTestsConfirmed && (
    choices.host === "vercel" ? !!vercelDeployment : validHttpsUrl(choices.liveUrl)
  );
  const steps: JourneyStep[] = [
    {
      id: "build",
      title: "Finish the app",
      detail: built
        ? "BuildRx marks this project Ready. Open Preview and test its actual functions; a screenshot is not proof."
        : signals.projectStatus === "error"
          ? "The build needs repair. Open Build app, type Repair, then re-run checks."
          : "Build the project, correct errors, and wait for BuildRx to mark it Ready.",
      state: built ? "done" : "action",
    },
    {
      id: "github",
      title: "Save the code to GitHub",
      detail: linked
        ? choices.sourceConfirmed
          ? `You marked generated source files present in ${repo}. This is self-reported, not a server-verified latest commit.`
          : `Repository linked: ${repo}. Open it and confirm package.json and real application pages were pushed; linking alone does not save source.`
        : signals.githubConnected === false
          ? "Open GitHub, connect your account, create a private repository and push the verified source."
          : "Open GitHub and link a private repository for this project. Never paste access tokens into chat.",
      state: sourceReady ? "self-reported" : "action",
    },
    {
      id: "database",
      title: "Decide where app data lives",
      detail: choices.dataNeed === "unsure"
        ? "A simple brochure site might need no database. Sign-in or records need tested persistence."
        : choices.dataNeed === "none"
          ? "No database selected. Suitable only if the app truly saves no user information."
          : choices.databaseConfigured
            ? `${choices.dataNeed === "mongodb" ? "MongoDB Atlas" : "Supabase"} setup marked done by you. This has NOT been independently verified by BuildRx.`
            : `Configure ${choices.dataNeed === "mongodb" ? "MongoDB Atlas" : "Supabase"} and your host's encrypted environment variables. Test real data writes before launch.`,
      state: databaseDone ? choices.dataNeed === "none" ? "done" : "self-reported" : "action",
    },
    {
      id: "publish",
      title: choices.host === "cloudflare" ? "Prepare Cloudflare Workers" : "Deploy with Vercel",
      detail: choices.host === "cloudflare"
        ? signals.cloudflareCheck === "passed"
          ? "Cloudflare-related GitHub checks passed. That does NOT verify a Worker URL, app routes or database writes."
          : signals.cloudflareCheck === "failed"
            ? "Cloudflare build checks failed. Open the deployment panel and inspect the build details before retrying."
            : "Open Deploy → Cloudflare → Prepare. Then import the exact generated-app repository in Workers Builds; the GitHub App installation alone does not publish."
        : vercelDeployment
          ? "BuildRx has a recorded Vercel live deployment. Open its URL and test the real app; runtime behavior is not verified here."
          : "Open Deploy → Vercel, connect hosting, set environment variables, and publish the full Next.js source (not only Preview).",
      state: providerReported ? "waiting" : "action",
    },
    {
      id: "verify",
      title: "Test the real public app",
      detail: manualTest
        ? "You marked the live functionality as tested. This is self-reported, not an independent smoke test."
        : "On the published HTTPS URL, test opening, sign-in if applicable, create/edit/save, refresh, mobile view, and database persistence.",
      state: manualTest ? "self-reported" : "action",
    },
  ];
  let next = "Review the app on its public HTTPS URL before advertising it.";
  if (signals.githubSimulated) next = "This is a demo workspace. Sign in and save a real project before launching it.";
  else if (!built) next = "Open Build app and finish or repair your project.";
  else if (!linked) next = "Open GitHub and connect a private repository for your app.";
  else if (!sourceReady) next = "Push your generated app source to GitHub, inspect its files there, and confirm the handoff.";
  else if (!databaseDone) next = "Choose whether the app needs a database, then configure it safely.";
  else if (!providerReported) next = choices.host === "cloudflare"
    ? "Prepare the generated app for Cloudflare; connect its exact GitHub repo in Workers Builds."
    : "Deploy the verified source to Vercel and configure the required environment variables.";
  else if (!manualTest) next = choices.host === "cloudflare"
    ? "Find and test the actual Cloudflare Worker URL; GitHub build checks are not enough."
    : "Open the Vercel deployment and test the actual running app.";
  return { steps, next, readyToReview: built && sourceReady && databaseDone && providerReported && manualTest };
}
