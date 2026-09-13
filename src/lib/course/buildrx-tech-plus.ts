export const COURSE_SLUG = "mabrig-tech-plus-buildrx";
export const COURSE_TITLE = "MABRIG Tech+ BuildRx Full-Stack Launchpad";
export const COURSE_SUBTITLE = "Build, Deploy & Monetize Real Apps with AI";
export const COURSE_PRICE_NGN = 100_000;
export const COURSE_DURATION = "8 weeks";

export type CourseLab = {
  name: string;
  description: string;
  prompt: string;
};

export type CourseModule = {
  id: string;
  week: string;
  title: string;
  outcome: string;
  skills: string[];
  deliverable: string;
  lab: CourseLab;
};

function prompt(lines: string[]) {
  return lines.join("\n");
}

export const courseModules: CourseModule[] = [
  {
    id: "foundation",
    week: "Week 1",
    title: "Developer Foundations + AI Engineering Workflow",
    outcome:
      "Think like a developer, translate real problems into product specifications, and use BuildRx as an engineering copilot rather than a code vending machine.",
    skills: ["HTML/CSS/JavaScript essentials", "Git + GitHub", "Prompt-to-spec", "Debugging loops", "Acceptance criteria"],
    deliverable: "A live personal developer portfolio with a documented Git history.",
    lab: {
      name: "Developer Portfolio",
      description: "Build a responsive portfolio that presents your skills, projects, services, and contact pathway.",
      prompt: prompt([
        "Build a production-ready developer portfolio for an emerging full-stack developer.",
        "Use Next.js, TypeScript and responsive accessible UI.",
        "Pages/sections: hero, about, skills, projects, case-study cards, services, contact and footer.",
        "Add a project data model, reusable components, loading/error states and strong SEO metadata.",
        "Include a README with local setup, GitHub workflow and Vercel deployment steps.",
        "Acceptance: mobile-first, no placeholder links, keyboard accessible, production build passes."
      ]),
    },
  },
  {
    id: "frontend",
    week: "Week 2",
    title: "Modern Frontend: React + Next.js Product Interfaces",
    outcome:
      "Build interfaces that feel like real software: reusable components, forms, state, accessibility, validation, responsive layouts and polished UX.",
    skills: ["React", "Next.js App Router", "TypeScript", "Forms + validation", "Responsive UI", "Accessibility"],
    deliverable: "A polished task/productivity application with real interaction states.",
    lab: {
      name: "Smart Productivity App",
      description: "Create a modern task manager with filters, priorities, deadlines and analytics.",
      prompt: prompt([
        "Build a polished productivity web app with Next.js App Router and TypeScript.",
        "Features: create/edit/archive tasks, priorities, tags, due dates, search, filters and dashboard metrics.",
        "Use robust form validation and include empty/loading/error/success states.",
        "Persist data using Supabase PostgreSQL with row-level security.",
        "Add responsive mobile navigation and accessible keyboard interactions.",
        "Acceptance: data survives refresh, users only see their own records, production build passes."
      ]),
    },
  },
  {
    id: "backend-data",
    week: "Week 3",
    title: "Backend APIs + Databases: Supabase and MongoDB",
    outcome:
      "Design data models, API routes and CRUD workflows that remain correct after refresh, across users and under failure.",
    skills: ["REST/API routes", "PostgreSQL", "Supabase RLS", "MongoDB Atlas", "Schema design", "Indexes"],
    deliverable: "A multi-user inventory or service-management application with persistent CRUD.",
    lab: {
      name: "Business Inventory System",
      description: "Build a small-business inventory and sales workflow with secure multi-user data.",
      prompt: prompt([
        "Build a production-ready inventory and sales management application.",
        "Roles: owner and staff. Owner manages products, stock, staff and reports; staff records sales.",
        "Use Supabase Auth + PostgreSQL for users, products, sales and audit records.",
        "Add RLS policies, indexes, constraints and server-side authorization.",
        "Create dashboard metrics, low-stock alerts, CSV export, pagination and search.",
        "Acceptance: no in-memory persistence, unauthorized access fails, stock totals remain consistent."
      ]),
    },
  },
  {
    id: "auth-security",
    week: "Week 4",
    title: "Authentication, Authorization + Practical Web Security",
    outcome:
      "Protect applications with server-side authorization, safe secrets, validation, role-based access and secure file/data boundaries.",
    skills: ["Auth", "RBAC", "RLS", "Secrets", "Validation", "OWASP thinking", "Audit trails"],
    deliverable: "A role-based client portal with protected dashboards and audit evidence.",
    lab: {
      name: "Secure Client Portal",
      description: "Create a secure portal where clients and staff see only the records they are permitted to access.",
      prompt: prompt([
        "Build a secure multi-role client portal.",
        "Roles: client, staff, administrator.",
        "Implement Supabase email/password auth, password reset and protected routes.",
        "Enforce authorization server-side and with PostgreSQL RLS for every protected table.",
        "Add audit logs for sensitive actions and safe validation for uploads and forms.",
        "Document threat assumptions and security checks in SECURITY.md.",
        "Acceptance: role escalation attempts fail, secrets stay server-side, each role has tested boundaries."
      ]),
    },
  },
  {
    id: "integrations-ai",
    week: "Week 5",
    title: "APIs, Payments + AI Features That Solve Real Problems",
    outcome:
      "Connect external services safely, verify payment events, control AI cost and build useful AI features with structured outputs.",
    skills: ["Third-party APIs", "Paystack/Flutterwave", "Webhooks", "LLM APIs", "Structured output", "Cost controls"],
    deliverable: "A paid AI-enabled service workflow with verified payment and metered AI usage.",
    lab: {
      name: "AI Business Assistant",
      description: "Build a paid assistant that transforms business inputs into structured, reviewable outputs.",
      prompt: prompt([
        "Build an AI business assistant for small businesses.",
        "Users submit a business brief and receive a structured action plan, social copy and simple budget suggestions.",
        "Use a server-side AI gateway with approved models, token caps, timeouts, validation and usage logging.",
        "Integrate one-time Paystack payment before premium generation; verify server-side and handle webhooks idempotently.",
        "Persist orders and generated outputs; add history and export.",
        "Acceptance: no browser-exposed secrets, unpaid requests cannot unlock premium generation, failures are recoverable."
      ]),
    },
  },
  {
    id: "testing-devops",
    week: "Week 6",
    title: "Testing, GitHub Workflow + Vercel Deployment",
    outcome:
      "Move from 'it works on my phone' to repeatable release evidence using tests, branches, previews, logs and rollback thinking.",
    skills: ["Vitest", "Integration tests", "Git branches", "Pull requests", "CI mindset", "Vercel previews", "Observability"],
    deliverable: "A tested app deployed from GitHub to a Vercel preview and production URL.",
    lab: {
      name: "Production Release Sprint",
      description: "Take one earlier project through a disciplined test, review and deployment cycle.",
      prompt: prompt([
        "Harden this application for production release.",
        "Add unit tests for validation and business logic plus integration tests for critical API/data flows.",
        "Create smoke-test steps for sign-in, primary CRUD workflow and deployment.",
        "Prepare GitHub-ready documentation, environment variable reference and release checklist.",
        "Deploy to Vercel and document preview versus production configuration.",
        "Acceptance: typecheck/build/tests pass and RELEASE_EVIDENCE.md records commit, deployment URL, checks and rollback target."
      ]),
    },
  },
  {
    id: "product-monetization",
    week: "Week 7",
    title: "Product Thinking, SaaS Monetization + Founder Operations",
    outcome:
      "Turn technical skill into a sellable product by connecting user pain, pricing, onboarding, analytics, support and cost control.",
    skills: ["Product discovery", "Pricing", "Onboarding", "Analytics", "Support workflows", "Cloud cost discipline"],
    deliverable: "A revenue-ready micro-SaaS with onboarding, entitlement and measurable activation.",
    lab: {
      name: "Micro-SaaS Revenue App",
      description: "Build a focused SaaS around one painful workflow and a clear paid outcome.",
      prompt: prompt([
        "Build a revenue-ready micro-SaaS for a specific Nigerian or African small-business workflow.",
        "Define one target user, one primary outcome and a free-to-paid conversion path.",
        "Include onboarding, secure CRUD, usage limits, payment verification, account settings and analytics events.",
        "Use Supabase for relational data and add a documented cost-control strategy.",
        "Provide admin visibility for customers, payments and product usage.",
        "Acceptance: a new user can sign up, reach first value, pay, receive entitlement and complete the core workflow."
      ]),
    },
  },
  {
    id: "capstone",
    week: "Week 8",
    title: "Capstone: From Problem to Certified Production App",
    outcome:
      "Plan, build, test, deploy and defend a complete application that demonstrates frontend, backend, data, security, integrations and release discipline.",
    skills: ["Architecture", "Full-stack delivery", "Security review", "Testing", "Deployment", "Technical presentation"],
    deliverable: "One portfolio-grade capstone, public case study and live demo with production evidence.",
    lab: {
      name: "BuildRx Certified Capstone",
      description: "Choose a real problem, build the solution end-to-end, and graduate with verifiable evidence.",
      prompt: prompt([
        "Create my BuildRx Full-Stack Capstone application.",
        "Start by producing a product brief, user roles, workflows, data model, architecture and acceptance criteria.",
        "Then implement a complete Next.js full-stack product with authentication, persistent database, secure authorization, one external integration and one AI-assisted feature where useful.",
        "Add automated tests, loading/error/empty states, logs and production documentation.",
        "Prepare GitHub repository quality, Vercel deployment, security review and a case-study README.",
        "Acceptance: production build passes, critical flows are tested, app is deployed, and evidence is sufficient for a live technical defense."
      ]),
    },
  },
];

export const courseBenefits = [
  "8 weeks of project-first full-stack development",
  "8 guided BuildRx labs with pre-built production briefs",
  "GitHub portfolio and deployment evidence from the first week",
  "Next.js, TypeScript, Supabase, MongoDB, APIs, AI and payments",
  "Production testing, security and deployment discipline",
  "Founder/product thinking for turning apps into income",
  "Capstone technical defense and completion certificate",
  "Reusable templates, prompts, checklists and release evidence"
];
