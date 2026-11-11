import type { TrainingTrackId } from "@/lib/learn/labs";

/** Audited educational file snippets. No auto-install, execution, upload, or grading. */
export interface TrainingStarterKit {
  id: TrainingTrackId;
  name: string;
  description: string;
  setup: readonly string[];
  files: readonly { path: string; lang: string; content: string }[];
}
export const TRAINING_STARTER_KITS: readonly TrainingStarterKit[] = [
  {
    "id": "software-engineering",
    "name": "TypeScript issue tracker starter",
    "description": "Pure TypeScript logic to extend and test; no database or network access.",
    "setup": [
      "Create a throwaway TypeScript training project with Node LTS.",
      "Add Vitest using its official setup guide and create src/lib/.",
      "Place the starter file in the listed path; run typecheck and write tests."
    ],
    "files": [
      {
        "path": "src/lib/issues.ts",
        "lang": "typescript",
        "content": "export type Issue = {\n  title: string;\n  ownerId: string;\n  status: \"open\" | \"closed\";\n};\n\n// Training starter only. Do not trust caller-supplied roles or owner IDs\n// in a production API: fetch the identity from the authenticated session.\nexport function createIssue(title: string, ownerId: string): Issue {\n  if (title.trim().length < 3) throw new Error(\"Title is too short\");\n  if (!ownerId.trim()) throw new Error(\"Missing owner\");\n  return { title: title.trim(), ownerId, status: \"open\" };\n}\n\nexport function canCloseIssue(issue: Issue, actorId: string): boolean {\n  return actorId === issue.ownerId;\n}\n"
      },
      {
        "path": "src/lib/issues.test.ts",
        "lang": "typescript",
        "content": "import { describe, expect, it } from \"vitest\";\nimport { canCloseIssue, createIssue } from \"./issues\";\n\ndescribe(\"issue rules\", () => {\n  it(\"rejects blank titles\", () => {\n    expect(() => createIssue(\" \", \"owner\")).toThrow();\n  });\n  it(\"blocks a different user from closing an issue\", () => {\n    const issue = createIssue(\"Repair login\", \"owner\");\n    expect(canCloseIssue(issue, \"stranger\")).toBe(false);\n  });\n  // Lab task: add tests for trimming, missing identity and allowed closure.\n});\n"
      }
    ]
  },
  {
    "id": "systems-engineering",
    "name": "Booking API design kit",
    "description": "Architecture and OpenAPI starting contracts; no server is deployed.",
    "setup": [
      "Create a private training repository with docs/ and an openapi.yaml file.",
      "Review all TODO notes and add authentication, idempotency and failure responses.",
      "Validate the OpenAPI document with a local linter; never use real customer data."
    ],
    "files": [
      {
        "path": "docs/system-context.md",
        "lang": "markdown",
        "content": "# Appointment booking system — system context (training)\n\nUsers: Customer, Staff, Admin.\n\nExternal dependencies: Identity provider, Email delivery, Database.\n\nTrust boundaries:\n- Browser and mobile requests are untrusted.\n- Backend validates session, authorization and data.\n- Database enforces uniqueness and appropriate row-level access.\n\n## Engineering targets (fill with measured or explicit estimates)\n- Peak bookings/min: TODO\n- Target latency at p95: TODO\n- Recovery time objective (RTO): TODO\n- Retry/idempotency strategy: TODO\n\n## Failure exercise\nWhat should customers see if the booking database becomes unavailable?\n"
      },
      {
        "path": "openapi.yaml",
        "lang": "yaml",
        "content": "openapi: 3.1.0\ninfo:\n  title: Learning Booking API\n  version: 0.1.0\n  description: Training contract. Security and persistence must be implemented.\npaths:\n  /slots:\n    get:\n      operationId: listSlots\n      responses:\n        \"200\":\n          description: List open slots\n  /bookings:\n    post:\n      operationId: createBooking\n      description: TODO — add auth, request schema, idempotency and conflict handling\n      responses:\n        \"201\":\n          description: Booking created\n        \"409\":\n          description: Requested slot is already reserved\n"
      }
    ]
  },
  {
    "id": "fullstack-web",
    "name": "Next.js App Router web starter",
    "description": "A simple accessible frontend starting point; no database or live API.",
    "setup": [
      "Create a new Next.js App Router TypeScript project using the official create-next-app command.",
      "Inspect package.json and app/ or src/app/ path before placing example files.",
      "Run the local development server; add validation, API routes and real persistence in later labs."
    ],
    "files": [
      {
        "path": "src/app/page.tsx",
        "lang": "tsx",
        "content": "import Link from \"next/link\";\n\nexport default function HomePage() {\n  return (\n    <main className=\"mx-auto max-w-3xl space-y-4 p-6\">\n      <h1 className=\"text-3xl font-semibold\">Booking Lab</h1>\n      <p>Training scaffold: real booking and persistence are not implemented.</p>\n      <Link className=\"underline\" href=\"/book\">Start a booking</Link>\n    </main>\n  );\n}\n"
      },
      {
        "path": "src/app/book/page.tsx",
        "lang": "tsx",
        "content": "export default function BookPage() {\n  return (\n    <main className=\"mx-auto max-w-xl p-6\">\n      <h1 className=\"text-2xl font-semibold\">New booking</h1>\n      <p className=\"mt-2\">Exercise: add a form, server-side validation,\n      real persistence and owner-scoped authorization before release.</p>\n    </main>\n  );\n}\n"
      }
    ]
  },
  {
    "id": "mobile-app",
    "name": "Expo React Native mobile screen starter",
    "description": "Local Expo sample screen only. No native binary, payments, database or sync.",
    "setup": [
      "Create an Expo project using npx create-expo-app@latest from official docs.",
      "Inspect the created Expo Router structure; choose an app/ or src/app/ entry file appropriate to that template.",
      "Replace a disposable training screen and open it in Expo Go or a supported development build.",
      "Add secure mobile API integration, loading/error states and real offline sync in later labs."
    ],
    "files": [
      {
        "path": "app/index.tsx",
        "lang": "tsx",
        "content": "import { useState } from \"react\";\nimport { Pressable, SafeAreaView, Text } from \"react-native\";\n\nexport default function TrainingHome() {\n  const [draftCount, setDraftCount] = useState(0);\n  return (\n    <SafeAreaView style={{ flex: 1, padding: 24, gap: 16 }}>\n      <Text style={{ fontSize: 26, fontWeight: \"bold\" }}>\n        Field Visit Lab\n      </Text>\n      <Text>Draft counter (memory only; not yet saved or synced).</Text>\n      <Pressable\n        accessibilityRole=\"button\"\n        accessibilityLabel=\"Create a local practice draft\"\n        style={{ backgroundColor: \"#ddd\", padding: 16, borderRadius: 12 }}\n        onPress={() => setDraftCount(count => count + 1)}\n      >\n        <Text>Create practice draft</Text>\n      </Pressable>\n      <Text>Drafts in this session: {draftCount}</Text>\n    </SafeAreaView>\n  );\n}\n"
      }
    ]
  }
];
export function starterKitForTrack(id: TrainingTrackId): TrainingStarterKit | undefined {
  return TRAINING_STARTER_KITS.find(kit => kit.id === id);
}
