import {
  FILE_FORMAT_INSTRUCTIONS,
  canCallModel,
  degradedEvent,
  diagnoseModelFailure,
  emptyOutputFailure,
  outOfTimeNote,
  parseFileBlocks,
  pause,
  runAgentCompletion,
  stepBudgetMs,
} from "@/lib/agents/llm";
import type { Agent, AppPlan, GeneratedFile } from "@/lib/agents/types";

const SYSTEM = `You are the Coding Agent in an automated app-building pipeline. The UI and Database agents have already generated the visual layer and schema. You write the remaining application code that wires everything together:

- authenticated Supabase clients for server and browser code
- persistent data access helpers ("src/lib/data.ts") matching the schema; never use module arrays, sample-data stores, or fake CRUD
- a REST API route handler under "src/app/api/<table>/route.ts" with authenticated GET, POST, PATCH, and DELETE for each table in the plan's data model
- the root layout ("src/app/layout.tsx") importing globals.css, if not already generated
- project structure files: "package.json" (next/react/tailwind/Supabase/MongoDB deps, dev/build/start/lint/typecheck scripts), "postcss.config.mjs", "tsconfig.json", ".env.example", and "README.md" describing setup, workflows, schema migration, GitHub/Vercel deployment, optional MongoDB usage, and verification
- a server-only "src/lib/mongodb.ts" helper so document/job-state features can be enabled by setting MONGODB_URI without rewriting the app
- any hooks or utilities the plan's features require

Use TypeScript and keep files focused. Verify the user server-side for every query and mutation. Validate request bodies, never trust owner_id from the client, and return actionable errors. Do NOT regenerate files that already exist (you'll be given the list).

${FILE_FORMAT_INSTRUCTIONS}`;

function toPascal(snake: string) {
  return snake
    .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
    .replace(/^([a-z])/, (c) => c.toUpperCase());
}

function mockFiles(
  plan: AppPlan,
  existingPaths: string[]
): GeneratedFile[] {
  const files: GeneratedFile[] = [
    {
      path: "src/lib/supabase/server.ts",
      content: `import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot write cookies; middleware refreshes sessions.
          }
        },
      },
    }
  );
}
`,
    },
    {
      path: "src/lib/supabase/client.ts",
      content: `import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
`,
    },
    {
      path: "src/lib/data.ts",
      content: `import { createClient } from "@/lib/supabase/server";

async function authenticatedClient() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("UNAUTHENTICATED");
  return { supabase, user };
}

${plan.dataModel
  .map((t) => {
    const type = toPascal(t.table);
    const ownerColumn = t.columns.some((column) => column.name === "user_id")
      ? "user_id"
      : "owner_id";
    return `
export async function list${type}() {
  const { supabase, user } = await authenticatedClient();
  const { data, error } = await supabase
    .from("${t.table}")
    .select("*")
    .eq("${ownerColumn}", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function create${type}(input: Record<string, unknown>) {
  const { supabase, user } = await authenticatedClient();
  const { id: _id, ${ownerColumn}: _owner, created_at: _created, ...safeInput } = input;
  const { data, error } = await supabase
    .from("${t.table}")
    .insert({ ...safeInput, ${ownerColumn}: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function update${type}(id: string, input: Record<string, unknown>) {
  const { supabase, user } = await authenticatedClient();
  const { id: _id, ${ownerColumn}: _owner, created_at: _created, ...safeInput } = input;
  const { data, error } = await supabase
    .from("${t.table}")
    .update(safeInput)
    .eq("id", id)
    .eq("${ownerColumn}", user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function delete${type}(id: string) {
  const { supabase, user } = await authenticatedClient();
  const { error } = await supabase
    .from("${t.table}")
    .delete()
    .eq("id", id)
    .eq("${ownerColumn}", user.id);
  if (error) throw error;
}`;
  })
  .join("\n")}
`,
    },
  ];

  // REST API route per table.
  for (const table of plan.dataModel) {
    const type = toPascal(table.table);
    files.push({
      path: `src/app/api/${table.table}/route.ts`,
      content: `import { NextResponse } from "next/server";

import { create${type}, delete${type}, list${type}, update${type} } from "@/lib/data";

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  const status = message === "UNAUTHENTICATED" ? 401 : 500;
  return NextResponse.json({ error: message }, { status });
}

/** ${table.description} */
export async function GET() {
  try {
    return NextResponse.json({ data: await list${type}() });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  try {
    return NextResponse.json({ data: await create${type}(body) }, { status: 201 });
  } catch (error) {
    return responseError(error);
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.id !== "string") {
    return NextResponse.json({ error: "A valid id is required" }, { status: 400 });
  }
  try {
    return NextResponse.json({ data: await update${type}(body.id, body) });
  } catch (error) {
    return responseError(error);
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  try {
    await delete${type}(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return responseError(error);
  }
}
`,
    });
  }

  if (!existingPaths.includes("src/app/layout.tsx")) {
    files.push({
      path: "src/app/layout.tsx",
      content: `import "./globals.css";

export const metadata = {
  title: "${plan.appName}",
  description: "${plan.summary.replace(/"/g, "'")}",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
`,
    });
  }

  // Project structure files.
  files.push(
    {
      path: "package.json",
      content: `${JSON.stringify(
        {
          name: plan.appName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          version: "0.1.0",
          private: true,
          engines: { node: "22.x" },
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            lint: "next lint",
            typecheck: "tsc --noEmit",
          },
          dependencies: {
            "@supabase/ssr": "^0.7.0",
            "@supabase/supabase-js": "^2.50.0",
            mongodb: "^7.6.0",
            next: "^15.0.0",
            react: "^19.0.0",
            "react-dom": "^19.0.0",
          },
          devDependencies: {
            "@tailwindcss/postcss": "^4.1.0",
            "@types/node": "^20.0.0",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
            tailwindcss: "^4.1.0",
            typescript: "^5.0.0",
          },
        },
        null,
        2
      )}\n`,
    },
    {
      path: "postcss.config.mjs",
      content: `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": [
      "dom",
      "dom.iterable",
      "esnext"
    ],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}\n`,
    },
    {
      path: "src/lib/mongodb.ts",
      content: `import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE || "app";

const globalMongo = globalThis as unknown as {
  __generatedMongoClient?: Promise<MongoClient>;
};

export function isMongoConfigured() {
  return Boolean(uri);
}

export async function getMongoDatabase(): Promise<Db> {
  if (!uri) {
    throw new Error(
      "MongoDB is not configured. Add MONGODB_URI in your local .env.local and Vercel project settings."
    );
  }

  globalMongo.__generatedMongoClient ??= new MongoClient(uri, {
    connectTimeoutMS: 5000,
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 10,
  })
    .connect()
    .catch((error) => {
      globalMongo.__generatedMongoClient = undefined;
      throw error;
    });

  const client = await globalMongo.__generatedMongoClient;
  return client.db(databaseName);
}
`,
    },
    {
      path: ".env.example",
      content: `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional MongoDB Atlas integration for document/job-state workloads.
# Keep this server-only; never prefix it with NEXT_PUBLIC_.
MONGODB_URI=mongodb+srv://username:password@cluster.example.mongodb.net/?retryWrites=true&w=majority
MONGODB_DATABASE=app
`,
    },
    {
      path: "README.md",
      content: `# ${plan.appName}

${plan.summary}

## Pages

${plan.pages.map((p) => `- **${p.name}** (\`${p.path}\`) — ${p.description}`).join("\n")}

## Core workflows

${(plan.workflows ?? []).map((workflow) => `- **${workflow.name}** — ${workflow.steps.join(" → ")} → ${workflow.outcome}`).join("\n") || "- Manage records through the product workspace"}

## Getting started

\`\`\`bash
npm install
npx supabase db push
npm run dev
\`\`\`

Copy \`.env.example\` to \`.env.local\` and add the project URL and anonymous key.

## Integrations

- **GitHub:** create or connect a repository from BuildRx, then push the generated source as a single commit.
- **Vercel:** deploy directly from BuildRx, or import the pushed GitHub repository into Vercel for automatic preview and production deployments.
- **MongoDB Atlas (optional):** set \`MONGODB_URI\` and \`MONGODB_DATABASE\` locally and in Vercel. Use \`getMongoDatabase()\` from \`src/lib/mongodb.ts\` for document-shaped job/session data; keep authentication and relational ownership in Supabase unless the architecture explicitly says otherwise.

Before release, run \`npm run typecheck\`, \`npm run build\`, and verify every acceptance criterion.
`,
    }
  );

  return files;
}

export const codingAgent: Agent = {
  name: "coding",
  async run(context, emit) {
    emit({
      type: "agent_start",
      agent: "coding",
      message: "Writing application code…",
    });
    const plan = context.plan!;
    const existingPaths = [...context.files.keys()];

    let files: GeneratedFile[];
    let note = "";
    if (!canCallModel(context)) {
      const reason = outOfTimeNote(context);
      if (reason) {
        note = ` (${reason} — wired up from the plan instead)`;
        emit(
          degradedEvent(
            "coding",
            "Your application code is wired up from the plan, not written by a model.",
            diagnoseModelFailure(
              new Error(
                "The build budget ran out before this step could start a model call."
              )
            )
          )
        );
      } else await pause(800);
      files = mockFiles(plan, existingPaths);
    } else {
      try {
        const text = await runAgentCompletion({
          system: SYSTEM,
          // This step emits many whole files at once; the default
          // ceiling truncates it mid-file, and a truncated block used to
          // discard the entire response.
          maxTokens: 16000,
          prompt: [
            `Plan:\n${JSON.stringify(plan, null, 2)}`,
            ...(context.architecture
              ? [`Architecture (follow these paths and conventions):\n${context.architecture}`]
              : []),
            `Files that already exist (do not regenerate):\n${existingPaths.join("\n")}`,
            `Original request: ${context.prompt}`,
          ].join("\n\n"),
          role: "primary-coding",
          timeoutMs: stepBudgetMs(context),
        });
        files = parseFileBlocks(text);
        if (files.length === 0) {
          const failure = emptyOutputFailure(
            "The model's response contained no ===FILE:…===/===END=== blocks, so no code could be read out of it."
          );
          note = ` (${failure.summary} — wired up from the plan instead)`;
          emit(
            degradedEvent(
              "coding",
              "Your application code is wired up from the plan, not written by a model.",
              failure
            )
          );
          files = mockFiles(plan, existingPaths);
        }
      } catch (error) {
        const failure = diagnoseModelFailure(error);
        note = ` (${failure.summary} — wired up from the plan instead)`;
        emit(
          degradedEvent(
            "coding",
            "Your application code is wired up from the plan, not written by a model.",
            failure
          )
        );
        files = mockFiles(plan, existingPaths);
      }
    }

    for (const file of files) {
      context.files.set(file.path, file);
      emit({ type: "file", agent: "coding", path: file.path });
    }
    emit({
      type: "agent_complete",
      agent: "coding",
      message: `Wrote ${files.length} code files${note}`,
    });
  },
};
