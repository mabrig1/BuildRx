import type { TrainingTrackId } from "@/lib/learn/labs";
import {
  containsStudioSecret,
  parseStudioWorkspace,
  type StudioWorkspace,
} from "@/lib/learn/studio-workspace";

/**
 * Explicitly reviewed, browser-only ZIP preparation.
 * This function never installs dependencies, runs student source, pushes to
 * GitHub, contacts a third-party provider, or claims a passing build.
 */
export type ExportKind = "web-app-starter" | "typescript-test-starter" | "expo-overlay" | "systems-design";
export type StudioExportResult =
  | { ok: true; kind: ExportKind; label: string; files: Record<string, string>; steps: string[]; caution: string }
  | { ok: false; reason: string };

const GITIGNORE = [
  "# BuildRx training project - private keys and user records must not be committed",
  "node_modules/",
  ".next/",
  "dist/",
  "coverage/",
  ".expo/",
  ".env",
  ".env.*",
  "!.env.example",
  "*.log",
  ".DS_Store",
  "",
].join("\n");

/** Fixed package versions match the reviewed BuildRx Nov 2026 Next.js 15 environment. */
function nextManifest(): string {
  return JSON.stringify({
    name: "buildrx-booking-training",
    version: "0.1.0",
    private: true,
    license: "UNLICENSED",
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      typecheck: "tsc --noEmit",
    },
    dependencies: {
      next: "15.5.20",
      react: "19.1.0",
      "react-dom": "19.1.0",
    },
    devDependencies: {
      typescript: "^5.9.3",
      "@types/node": "^22.0.0",
      "@types/react": "^19.1.0",
      "@types/react-dom": "^19.1.0",
    },
    engines: { node: ">=22.0.0" },
  }, null, 2) + "\n";
}

function typescriptManifest(): string {
  return JSON.stringify({
    name: "buildrx-typescript-lab",
    version: "0.1.0",
    private: true,
    license: "UNLICENSED",
    type: "module",
    scripts: {
      test: "vitest run",
      "test:watch": "vitest",
      typecheck: "tsc --noEmit",
    },
    devDependencies: {
      "@types/node": "^22.0.0",
      typescript: "^5.9.3",
      vitest: "^4.1.10",
    },
    engines: { node: ">=22.0.0" },
  }, null, 2) + "\n";
}

function nextTsconfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules", "src/lab/**"],
  }, null, 2) + "\n";
}

function plainTsconfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      skipLibCheck: true,
      types: ["node"],
    },
    include: ["src/**/*.ts"],
    exclude: ["node_modules", "dist"],
  }, null, 2) + "\n";
}

const NEXT_ROOT_LAYOUT = `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuildRx Booking Practice",
  description: "Educational Next.js training app — no real booking persistence",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;

const NEXT_STYLES = `* { box-sizing: border-box; }
body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #f7f9fc; color: #1c2938; }
main { width: min(100% - 2rem, 720px); margin: 3rem auto; padding: 2rem; border-radius: 1rem; background: white; box-shadow: 0 6px 28px #13294516; }
h1 { font-size: clamp(1.5rem, 4vw, 2.25rem); }
p { max-width: 65ch; }
a { color: #125ab2; text-decoration: underline; }
a:focus-visible { outline: 3px solid #125ab2; outline-offset: 2px; }
`;

const NEXT_STEPS = [
  "Install Node.js 22 LTS and open this extracted folder in a terminal.",
  "Run npm install (review package.json first; this creates package-lock.json).",
  "Run npm run typecheck, then npm run dev.",
  "Open http://localhost:3000 and follow the /book link.",
  "Before inviting users: implement secure persistence, auth, server-side validation and real tests.",
  "Only then push the independently reviewed project to GitHub and deploy it with your chosen provider.",
];

const TS_STEPS = [
  "Install Node.js 22 LTS; review the included source and package.json.",
  "Run npm install to fetch test and TypeScript dependencies.",
  "Run npm run typecheck, then npm test; add more tests in src/lib/issues.test.ts.",
  "Review errors, make one small fix, rerun tests and commit to your own Git repository.",
  "No web UI or server is included: this is a standalone unit-testing workshop.",
];

const EXPO_STEPS = [
  "This is an Expo Router source overlay, NOT a standalone mobile project.",
  "On your computer, create a fresh Expo project using the official current create-expo-app instructions.",
  "Locate its app or src/app router folder and copy the included app/index.tsx there.",
  "Run the Expo project using its own package.json and matching SDK dependencies.",
  "Test on a simulator or device; this ZIP does not include an APK, IPA or production backend.",
];

const SYSTEM_STEPS = [
  "This ZIP contains a design dossier, not an executable web service.",
  "Open docs/system-context.md and resolve each requirement and measurable risk.",
  "Review openapi.yaml, add security contracts, schemas and error response bodies.",
  "Validate the API contract with an independently installed OpenAPI validator.",
  "Implement and test the backend separately, including atomic booking and role authorization.",
];

const TRACK_NOTES: Record<TrainingTrackId, {
  kind: ExportKind;
  label: string;
  steps: string[];
  caution: string;
}> = {
  "fullstack-web": {
    kind: "web-app-starter",
    label: "Next.js App Router training starter with npm scripts",
    steps: NEXT_STEPS,
    caution: "This package includes a navigable frontend skeleton only: it has no database, login, booking mutation or tested production deployment.",
  },
  "software-engineering": {
    kind: "typescript-test-starter",
    label: "TypeScript + Vitest training starter with npm scripts",
    steps: TS_STEPS,
    caution: "This is a local unit-testing project, not an authenticated production service or an independently verified release.",
  },
  "mobile-app": {
    kind: "expo-overlay",
    label: "Expo Router source overlay (requires a fresh Expo project)",
    steps: EXPO_STEPS,
    caution: "This is not a standalone Expo app and does not compile, sign or distribute Android/iOS packages.",
  },
  "systems-engineering": {
    kind: "systems-design",
    label: "OpenAPI and system-architecture source dossier",
    steps: SYSTEM_STEPS,
    caution: "This is documentation and an unfinished API specification, not a running application.",
  },
};

function trainingReadme(
  track: TrainingTrackId,
  label: string,
  steps: string[],
  caution: string,
): string {
  return [
    "# BuildRx Training Export — " + label,
    "",
    "> Educational starter only. BuildRx has NOT installed dependencies, executed this ZIP,",
    "> verified these user-edited files, connected a database or deployed an app.",
    "",
    "## Exact next steps",
    ...steps.map((step, i) => (i + 1) + ". " + step),
    "",
    "## Important limitation",
    caution,
    "",
    "## Safe release checklist",
    "- Review every included file and dependency before running it.",
    "- Keep .env, tokens and database credentials outside GitHub and client code.",
    "- Run the real compiler, tests and development server on your own machine.",
    "- Confirm real data persistence, authorization, accessibility and deployment behavior.",
    "- Never treat a generated package or green build as proof of working business workflows.",
    "",
    "Training track: " + track,
    "BuildRx lessons: /learn/labs and /learn/studio",
    "",
  ].join("\n");
}

export function buildStudioExport(workspace: StudioWorkspace): StudioExportResult {
  const validated = parseStudioWorkspace(workspace, workspace.trackId);
  if (!validated.ok) return { ok: false, reason: validated.reason };
  if (Object.values(workspace.files).some(containsStudioSecret)) {
    return { ok: false, reason: "Potential credentials are present. Remove them before exporting a ZIP." };
  }
  const track = TRACK_NOTES[workspace.trackId];
  if (!track) return { ok: false, reason: "Unknown training track." };
  const files = { ...workspace.files };

  // Generated config is trusted and must never silently override any
  // student-created file, even one with different capitalization.
  const existing = Object.keys(files).map(path => path.toLowerCase());
  const generated = ["README-TRAINING.md", ".gitignore"];
  if (workspace.trackId === "fullstack-web" || workspace.trackId === "software-engineering") {
    generated.push("package.json", "tsconfig.json");
  }
  if (workspace.trackId === "fullstack-web") {
    generated.push("src/app/layout.tsx", "src/app/globals.css");
  }
  const conflict = generated.find(path => existing.includes(path.toLowerCase()));
  if (conflict) {
    return { ok: false, reason: "Remove or rename your local " + conflict + " before exporting: BuildRx will not overwrite student files." };
  }

  files[".gitignore"] = GITIGNORE;
  if (workspace.trackId === "fullstack-web") {
    if (!files["src/app/page.tsx"]) {
      return { ok: false, reason: "A Next.js training export needs src/app/page.tsx. Restore it from the reviewed starter." };
    }
    files["package.json"] = nextManifest();
    files["tsconfig.json"] = nextTsconfig();
    files["src/app/layout.tsx"] = NEXT_ROOT_LAYOUT;
    files["src/app/globals.css"] = NEXT_STYLES;
  } else if (workspace.trackId === "software-engineering") {
    if (!files["src/lib/issues.ts"] || !files["src/lib/issues.test.ts"]) {
      return { ok: false, reason: "The unit-testing starter needs both source and test modules. Restore them first." };
    }
    files["package.json"] = typescriptManifest();
    files["tsconfig.json"] = plainTsconfig();
  }
  files["README-TRAINING.md"] = trainingReadme(
    workspace.trackId, track.label, track.steps, track.caution,
  );
  return { ok: true, kind: track.kind, label: track.label, steps: [...track.steps], caution: track.caution, files };
}
