import {
  FILE_FORMAT_INSTRUCTIONS,
  isLlmConfigured,
  parseFileBlocks,
  pause,
  runAgentCompletion,
} from "@/lib/agents/llm";
import type { Agent, GeneratedFile } from "@/lib/agents/types";

const SYSTEM = `You are the Coding Agent in an automated app-building pipeline. The UI and Database agents have already generated the visual layer and schema. You write the remaining application code that wires everything together:

- data access helpers ("src/lib/data.ts") matching the schema
- any hooks, utilities, or server logic the plan's features require
- the root layout ("src/app/layout.tsx") if not already generated

Use TypeScript and keep files focused. Do NOT regenerate files that already exist (you'll be given the list).

${FILE_FORMAT_INSTRUCTIONS}`;

function mockFiles(existingPaths: string[]): GeneratedFile[] {
  const files: GeneratedFile[] = [
    {
      path: "src/lib/data.ts",
      content: `// Data access helpers wired to the generated schema.
import type { Item } from "@/lib/database.types";

const items: Item[] = [];

export async function listItems(): Promise<Item[]> {
  return items;
}

export async function addItem(item: Item): Promise<void> {
  items.push(item);
}
`,
    },
  ];
  if (!existingPaths.includes("src/app/layout.tsx")) {
    files.push({
      path: "src/app/layout.tsx",
      content: `import "./globals.css";

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
    if (!isLlmConfigured()) {
      await pause(800);
      files = mockFiles(existingPaths);
    } else {
      const text = await runAgentCompletion({
        system: SYSTEM,
        prompt: [
          `Plan:\n${JSON.stringify(plan, null, 2)}`,
          `Files that already exist (do not regenerate):\n${existingPaths.join("\n")}`,
          `Original request: ${context.prompt}`,
        ].join("\n\n"),
      });
      files = parseFileBlocks(text);
    }

    for (const file of files) {
      context.files.set(file.path, file);
      emit({ type: "file", agent: "coding", path: file.path });
    }
    emit({
      type: "agent_complete",
      agent: "coding",
      message: `Wrote ${files.length} code files`,
    });
  },
};
