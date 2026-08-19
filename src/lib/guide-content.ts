/**
 * Knowledge base for people describing an app to the build pipeline.
 *
 * Kept as data rather than prose in a page so the same guidance can be
 * surfaced in more than one place (the guide page today; prompt hints in
 * the composer later) without the two drifting apart.
 *
 * Everything here reflects real limits of the pipeline — the planner is
 * instructed to cap a plan at 4 pages / 6 components / 4 tables, and the
 * six steps share one time budget. Advice that ignores those limits
 * produces worse apps, so the numbers below are not padding.
 */

export interface GuideSection {
  id: string;
  title: string;
  summary: string;
  points: string[];
}

export interface PromptExample {
  title: string;
  useCase: string;
  prompt: string;
}

export const HOW_IT_WORKS: GuideSection = {
  id: "how-it-works",
  title: "How a build works",
  summary:
    "Your first message in a new project runs a team of ten agents. Each one hands its work to the next, and the whole run shares a single time budget.",
  points: [
    "Planner — turns your description into a build plan: pages, components, database tables, and features.",
    "Architect — decides the file structure and conventions the other agents follow.",
    "UI — generates the preview page, every page in the plan, the components, and the stylesheet.",
    "Database — writes the SQL schema and matching TypeScript types.",
    "Coding — writes the data helpers, API routes, layout, and project files.",
    "Debugging — reviews the generated files and corrects what it can.",
    "Security — scans for leaked secrets and unsafe patterns, and documents the app's env vars.",
    "QA/Test — verifies structure, imports, dependencies, routes, and schema coverage.",
    "Repair — automatically fixes what QA found, then re-tests (up to two rounds).",
    "Deployment — saves every file, publishes your preview, and runs the final verification checklist.",
    "If a step runs out of time, it falls back to a scaffold built from your plan and says so in the log — the build always finishes with a working app rather than an error.",
  ],
};

export const WRITING_A_PROMPT: GuideSection = {
  id: "writing-a-prompt",
  title: "Writing a prompt that builds well",
  summary:
    "The pipeline builds what it can name. Being specific about structure produces a better app than describing features in prose.",
  points: [
    "Name your pages and what each one shows. \"Home: upload area plus a grid of tools\" beats \"a page for uploading\".",
    "Name your components. They become real files, so PascalCase names like UploadZone or ToolCard map directly.",
    "Name your tables and their columns. The schema is generated from exactly what you list.",
    "Stay inside the limits: at most 4 pages, 6 components, and 4 tables per build. Anything beyond that gets trimmed by the planner.",
    "Ask for a few things done well, then add the rest. A build with 4 focused pages beats one that tried for 11 and ran out of time.",
    "Put everything in the FIRST message. That message is what triggers the build; later messages in a project that already built are conversation, not construction.",
    "Say how it should look and feel in one line at the end — \"clean and professional, responsive, with clear error states\" is enough.",
  ],
};

export const AFTER_THE_BUILD: GuideSection = {
  id: "after-the-build",
  title: "Reading your build log",
  summary:
    "Every step reports what it actually did. The wording tells you whether you got model-generated code or a scaffold.",
  points: [
    "\"Generated 9 UI files — 4 scaffolded from the plan\" — the model wrote the app and the scaffold filled the gaps. This is the normal, healthy result.",
    "\"…the model ran out of time, so the built-in scaffold was used\" — you still get a working app, but that step's files are generic. Re-run with a smaller scope for a better result.",
    "\"…the configured model is unavailable\" or \"the NVIDIA API key was rejected\" — a configuration problem, not your prompt. Check Admin → Health → AI services.",
    "\"Build complete — N files generated\" — everything was saved and your preview is live.",
    "Open the Code tab to read any generated file, and the Preview tab to use the app.",
  ],
};

export const GROWING_AN_APP: GuideSection = {
  id: "growing-an-app",
  title: "Growing the app after the first build",
  summary:
    "The first build is a foundation, not a finished product. Add to it in small, specific steps.",
  points: [
    "Ask for one change at a time: \"Add a watermark tool page with an opacity slider\" lands better than five requests at once.",
    "Reference files by name when you know them — \"in src/components/upload-zone.tsx, accept multiple files\".",
    "Push to GitHub or Deploy once the preview looks right; both are in the workspace header.",
    "Keep the schema in mind: a new feature that stores data usually needs a new table, so say so explicitly.",
  ],
};

export const GUIDE_SECTIONS: GuideSection[] = [
  HOW_IT_WORKS,
  WRITING_A_PROMPT,
  AFTER_THE_BUILD,
  GROWING_AN_APP,
];

export const PROMPT_EXAMPLES: PromptExample[] = [
  {
    title: "Task tracker",
    useCase: "Smallest useful build — good for a first run",
    prompt: `Build a simple task tracker.
Pages:
- Home: list all tasks with a checkbox to mark each done
- Add Task: a form with a title field
Components: TaskList, TaskForm
Tables: tasks (id, title, done, created_at)
Style: clean and minimal, responsive.`,
  },
  {
    title: "PDF toolkit",
    useCase: "A focused tool app with file handling",
    prompt: `Build a mobile-first PDF toolkit web app.
Pages:
- Home: drag-and-drop upload area plus a grid of tools
- Tools: merge, split, compress, and watermark, each with its own form
- History: list of processed files with status and download link
- Settings: account details and default output quality
Components: UploadZone, ToolCard, JobProgress, FileList, EmptyState
Tables:
- documents (id, user_id, filename, size_bytes, storage_path, created_at)
- jobs (id, document_id, tool, status, result_path, created_at)
Style: clean and professional, responsive, with progress indicators and clear error states.`,
  },
  {
    title: "Church website",
    useCase: "A content site with a calendar and archive",
    prompt: `Build a church website.
Pages:
- Home: hero with service times and a welcome message
- About: our story, beliefs, and leadership
- Sermons: archive with title, speaker, and date
- Events: upcoming events calendar
Components: Hero, SermonCard, EventList, ServiceTimes
Tables:
- sermons (id, title, speaker, preached_on, audio_url, created_at)
- events (id, title, starts_at, location, description, created_at)
Style: warm and welcoming, responsive, easy to read on a phone.`,
  },
  {
    title: "Small business storefront",
    useCase: "A catalogue with enquiries",
    prompt: `Build a storefront for a coffee roastery.
Pages:
- Home: hero, featured beans, and a short story section
- Shop: grid of products with price and roast level
- Contact: enquiry form with name, email, and message
Components: ProductCard, ProductGrid, ContactForm, Hero
Tables:
- products (id, name, description, price_cents, roast_level, image_url, created_at)
- enquiries (id, name, email, message, created_at)
Style: warm, modern, product photography first, responsive.`,
  },
];
