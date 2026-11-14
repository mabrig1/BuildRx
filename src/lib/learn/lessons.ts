/**
 * Offline-first beginner knowledge base. These are vetted BuildRx-specific
 * lessons, not AI answers. AI coaching is a separate opt-in feature.
 * A lesson does not attest live deployment, account integration or safety.
 */
export type LessonCategory = "Building" | "GitHub" | "Hosting" | "Databases" | "Safety" | "Troubleshooting";
export interface KnowledgeLesson {
  id: string;
  title: string;
  category: LessonCategory;
  minutes: number;
  summary: string;
  explain: string;
  analogy: string;
  steps: string[];
  pitfalls: string[];
  exercise: string;
  quiz: {
    question: string;
    options: string[];
    answer: number;
    explanation: string;
  };
  docs: Array<{label: string; url: string}>;
}

export const KNOWLEDGE_LESSONS: KnowledgeLesson[] = [
  {
    "id": "first-app",
    "title": "Describe an app that AI can actually build",
    "category": "Building",
    "minutes": 7,
    "summary": "Turn a vague idea into a small, testable app brief.",
    "explain": "Vibe coding means telling an AI what software should do while still checking the output. The AI produces source code, not guaranteed working services.",
    "analogy": "A builder needs a floor plan before laying bricks. Pages, user roles and saved data are the floor plan.",
    "steps": [
      "Write the primary user and one problem the app solves.",
      "Name up to four starting pages and the main action on each.",
      "Write which information must be stored; list the fields.",
      "Ask for testable actions, errors, loading states and a mobile layout.",
      "Build a small version first, then expand it after testing."
    ],
    "pitfalls": [
      "A beautiful screen is not evidence that saving or authentication works.",
      "Requesting dozens of features at once usually hides unfinished behavior."
    ],
    "exercise": "Draft a booking app with Home, Book, My Bookings and Admin pages. State what happens when two users select one time slot.",
    "quiz": {
      "question": "Which brief gives BuildRx the clearest start?",
      "options": [
        "Build the best app ever",
        "Build a booking app with four named pages, user roles and saved bookings",
        "Make something viral"
      ],
      "answer": 1,
      "explanation": "An implementable brief names pages, roles, data and observable actions."
    },
    "docs": [
      {
        "label": "BuildRx Guide",
        "url": "/guide"
      }
    ]
  },
  {
    "id": "preview-versus-real-app",
    "title": "Understand preview versus a working app",
    "category": "Building",
    "minutes": 7,
    "summary": "Know the difference between generated files, a visual preview and a verified running application.",
    "explain": "A visual preview can show a form without a database behind it. Source files and a passing static check do not automatically prove login, payments or persistence.",
    "analogy": "A showroom kitchen looks useful; only turning on its water and power proves the plumbing works.",
    "steps": [
      "Open the project preview and inspect all required screens.",
      "Enter sample data and check what happens when you save.",
      "Refresh and sign in again; confirm data remains.",
      "Inspect the real source, including package.json, app pages and routes.",
      "Do not label an app live until the deployed URL and key journeys work."
    ],
    "pitfalls": [
      "Preview HTTP 200 does not prove business operations work.",
      "A success message with no persisted record is not a completed feature."
    ],
    "exercise": "For your app, list three actions that must work after a page refresh.",
    "quiz": {
      "question": "What proves a booking app is working?",
      "options": [
        "A screenshot",
        "A generated preview",
        "A verified booking persisted after refresh"
      ],
      "answer": 2,
      "explanation": "The key user action must work against the actual application storage."
    },
    "docs": [
      {
        "label": "BuildRx generated-app verification",
        "url": "/docs"
      }
    ]
  },
  {
    "id": "github-basics",
    "title": "GitHub: your app's source-code home",
    "category": "GitHub",
    "minutes": 8,
    "summary": "Learn repositories, commits, branches, and why GitHub is not a hosting service.",
    "explain": "A GitHub repository stores files and their history. A branch is a separate line of changes; a commit records a snapshot. GitHub itself does not run your public Next.js app.",
    "analogy": "GitHub is the library of blueprints. Vercel or Cloudflare is the construction site where the building runs.",
    "steps": [
      "Connect GitHub in the BuildRx project panel.",
      "Choose a new private repository for your generated app.",
      "Push the app source from BuildRx.",
      "Open that exact repository and inspect package.json and src/app or app folders.",
      "Check the latest commit matches your intended changes."
    ],
    "pitfalls": [
      "Connecting GitHub does not push your source automatically.",
      "Do not import the BuildRx builder's repo when you intend to deploy an app created inside it.",
      "Do not store credentials in .env files committed to GitHub."
    ],
    "exercise": "Find your generated app's repository, branch, latest commit and package.json.",
    "quiz": {
      "question": "What does a GitHub commit prove?",
      "options": [
        "A version of files was recorded",
        "The app is live to customers",
        "Database permissions are correct"
      ],
      "answer": 0,
      "explanation": "A commit is a recorded source snapshot, not a runtime test."
    },
    "docs": [
      {
        "label": "GitHub repositories",
        "url": "https://docs.github.com/en/repositories/creating-and-managing-repositories/about-repositories"
      }
    ]
  },
  {
    "id": "vercel-launch",
    "title": "From GitHub to Vercel",
    "category": "Hosting",
    "minutes": 10,
    "summary": "Connect a complete Next.js repository to hosting and verify the resulting deployment.",
    "explain": "Vercel can build and host your Next.js application from GitHub. It needs the correct repository and framework settings plus any environment variables your app actually uses.",
    "analogy": "GitHub holds the code; Vercel runs it on public infrastructure.",
    "steps": [
      "Choose Vercel in BuildRx's Deploy panel or import the generated-app repository in Vercel.",
      "Confirm root directory, framework and build command match the app.",
      "Set only required production environment variables in Vercel's encrypted settings.",
      "Review build logs; correct the first failing step.",
      "Open the deployment's actual HTTPS URL and test login, API calls and saved records."
    ],
    "pitfalls": [
      "A green build does not prove database operations work.",
      "Do not point the deployment at a preview-only index.html.",
      "Changing a variable may require a new deployment."
    ],
    "exercise": "Find your Vercel deployment history and identify the commit that produced its public URL.",
    "quiz": {
      "question": "When can you call a Vercel app ready for users?",
      "options": [
        "When source is uploaded",
        "When a preview screenshot exists",
        "After the build is ready and critical user actions work at its URL"
      ],
      "answer": 2,
      "explanation": "You need a working hosted runtime, not just an uploaded repository."
    },
    "docs": [
      {
        "label": "Vercel Git integrations",
        "url": "https://vercel.com/docs/git"
      },
      {
        "label": "Vercel environment variables",
        "url": "https://vercel.com/docs/environment-variables"
      }
    ]
  },
  {
    "id": "cloudflare-launch",
    "title": "From GitHub to Cloudflare Workers",
    "category": "Hosting",
    "minutes": 12,
    "summary": "Understand source preparation, Workers Builds, and what 'check passed' really means.",
    "explain": "BuildRx currently prepares a Next.js repository for Cloudflare Workers; that is not the same as automatically publishing a live Worker. You must select the generated-app repository in Workers Builds and verify the public URL.",
    "analogy": "Preparing the delivery truck is not the same as delivering the finished house.",
    "steps": [
      "Finish and verify the BuildRx project before preparing Cloudflare source.",
      "In BuildRx choose Deploy → Cloudflare → Prepare.",
      "Open the exact generated-app GitHub repository and branch shown.",
      "Give the Cloudflare GitHub App permission for this repository if needed.",
      "Configure Workers Builds with the prepared configuration and required encrypted secrets.",
      "Inspect Cloudflare's build and runtime logs, then open and test the actual Worker URL."
    ],
    "pitfalls": [
      "Installing Cloudflare's GitHub App alone does not create a deployment.",
      "Do not select the BuildRx builder repository instead of your generated app.",
      "A passed GitHub build check does not prove that login, APIs or databases work.",
      "Some Node.js packages may not run unchanged in Workers."
    ],
    "exercise": "In the BuildRx Deploy panel, identify the prepared repository, branch, worker name and next manual action.",
    "quiz": {
      "question": "What is true immediately after BuildRx says 'Cloudflare prepared'?",
      "options": [
        "The app has been verified live",
        "The source and configuration are ready for Cloudflare setup",
        "Your Worker has passed all database tests"
      ],
      "answer": 1,
      "explanation": "Preparation is a source handoff; live deployment and end-to-end verification come later."
    },
    "docs": [
      {
        "label": "Cloudflare Workers Builds",
        "url": "https://developers.cloudflare.com/workers/ci-cd/builds/"
      },
      {
        "label": "Cloudflare Next.js guide",
        "url": "https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/"
      }
    ]
  },
  {
    "id": "mongodb-basics",
    "title": "MongoDB Atlas: where app records live",
    "category": "Databases",
    "minutes": 10,
    "summary": "Learn clusters, databases, collections and safe server-side connections.",
    "explain": "MongoDB stores document-shaped records. Atlas hosts MongoDB for you. A connection string can contain a username and password; it belongs in server-only environment settings, never your GitHub source or browser.",
    "analogy": "Atlas is the filing cabinet; a collection is a drawer; a document is a record.",
    "steps": [
      "Confirm that your generated app actually uses MongoDB; do not add a second database without a need.",
      "Create an Atlas deployment and a restricted database user.",
      "Set secure network connectivity appropriate to your hosting provider.",
      "Add MONGODB_URI to the host's encrypted server-side environment settings.",
      "Test a record creation, read, edit and refresh; enforce ownership in server APIs.",
      "For Cloudflare Workers, verify driver/network compatibility before selecting MongoDB as a production dependency."
    ],
    "pitfalls": [
      "A successful connection does not establish user-level authorization.",
      "Never prefix a private MongoDB URI with NEXT_PUBLIC_.",
      "Do not place your database password in AI prompts or GitHub commits."
    ],
    "exercise": "Locate the server-side database code in your generated app and list which collection the main form should write.",
    "quiz": {
      "question": "Where should MONGODB_URI be saved?",
      "options": [
        "In NEXT_PUBLIC_MONGODB_URI",
        "In a public GitHub README",
        "In the hosting provider's encrypted server-side variables"
      ],
      "answer": 2,
      "explanation": "Database credentials must stay server-side and out of version control."
    },
    "docs": [
      {
        "label": "MongoDB Atlas and Node.js",
        "url": "https://www.mongodb.com/docs/drivers/node/current/get-started/"
      }
    ]
  },
  {
    "id": "supabase-auth",
    "title": "Supabase Auth and Row Level Security",
    "category": "Databases",
    "minutes": 11,
    "summary": "Know how login, database policies and per-user access fit together.",
    "explain": "Supabase can provide user authentication and PostgreSQL tables. Row Level Security (RLS) enforces which records each user may read or change. Working login alone does not make your data private.",
    "analogy": "Authentication checks your ID at a building's entrance; RLS decides which locked rooms you may enter.",
    "steps": [
      "Inspect whether your app uses Supabase and which tables it needs.",
      "Configure the project URL and public/publishable key as expected by the generated app.",
      "Enable RLS on exposed tables and create policies for select, insert, update and delete.",
      "Never put a Supabase secret or service-role key into a browser variable.",
      "Test with two different users: each must be denied the other's private records.",
      "Set the deployed host's callback/redirect URLs correctly."
    ],
    "pitfalls": [
      "A successful sign-in is not proof that user data is isolated.",
      "Anonymous and authenticated roles need appropriate grants and tested policies.",
      "Do not treat user-editable profile metadata as administrator permission."
    ],
    "exercise": "Create a test checklist showing what User A can do and what User B must be prevented from doing.",
    "quiz": {
      "question": "Why is RLS important in a multi-user app?",
      "options": [
        "It makes pages prettier",
        "It restricts database rows by identity and policy",
        "It speeds up GitHub pushes"
      ],
      "answer": 1,
      "explanation": "RLS helps enforce authorization at the database level."
    },
    "docs": [
      {
        "label": "Supabase RLS guide",
        "url": "https://supabase.com/docs/guides/database/postgres/row-level-security"
      },
      {
        "label": "Supabase Auth",
        "url": "https://supabase.com/docs/guides/auth"
      }
    ]
  },
  {
    "id": "environment-secrets",
    "title": "Environment variables without exposing secrets",
    "category": "Safety",
    "minutes": 9,
    "summary": "Understand public versus private configuration across hosts.",
    "explain": "Environment variables let your app read configuration without hardcoding passwords. Variables starting with NEXT_PUBLIC_ may be bundled into browser JavaScript and must never hold private credentials.",
    "analogy": "Your shop's sign is public; its safe combination is not.",
    "steps": [
      "Open the generated app's .env.example and identify the variable names.",
      "Mark values public (safe for browser) or secret (server only).",
      "Enter secrets in your host's encrypted settings, not in a BuildRx message or GitHub source.",
      "Use minimal permissions for API keys and test that required services work.",
      "Rotate a key immediately if it was published in a repository or pasted into an unsafe location."
    ],
    "pitfalls": [
      "Never paste a live API token into a support conversation.",
      "A server key with NEXT_PUBLIC_ becomes visible to browser users.",
      "A variable configured on Vercel does not automatically exist on Cloudflare."
    ],
    "exercise": "Categorize SUPABASE_SERVICE_ROLE_KEY, MONGODB_URI and NEXT_PUBLIC_SUPABASE_URL by whether they can be exposed to the browser.",
    "quiz": {
      "question": "Which variable must never be prefixed NEXT_PUBLIC_?",
      "options": [
        "MONGODB_URI",
        "A public site title",
        "A public Supabase project URL"
      ],
      "answer": 0,
      "explanation": "The MongoDB URI can contain credentials; it must never be exposed client-side."
    },
    "docs": [
      {
        "label": "Vercel environment variables",
        "url": "https://vercel.com/docs/environment-variables"
      },
      {
        "label": "BuildRx environment guide",
        "url": "/guide"
      }
    ]
  },
  {
    "id": "fix-build-errors",
    "title": "Troubleshoot a failed build or 404 preview",
    "category": "Troubleshooting",
    "minutes": 11,
    "summary": "Find the first failure and verify the smallest repair.",
    "explain": "Build logs usually contain many warnings. The first failed step and first concrete error are more useful than the last red message. A private preview may return 404 without the correct owner session even when files exist.",
    "analogy": "If a car won't start, test the battery before replacing the engine.",
    "steps": [
      "Identify whether the failure is code, CI, preview authentication, deployment build, or app runtime.",
      "Open the exact failed job or deployment and locate the first failing command.",
      "Capture the first actionable error line without copying secrets.",
      "Repair only that issue; keep a reversible commit.",
      "Run lint, typecheck, tests and a production build before deploying.",
      "Re-test the actual route and data flow in the correct logged-in environment."
    ],
    "pitfalls": [
      "Don't merge a broken PR to silence an alert.",
      "Do not assume an unauthenticated preview 404 means source was not generated.",
      "Avoid blind dependency upgrades when the cause is a missing variable or import."
    ],
    "exercise": "Write a two-sentence diagnosis for an imaginary TypeScript missing-import error and name the smallest fix.",
    "quiz": {
      "question": "What should you examine first when CI fails?",
      "options": [
        "The first failed step and exact error",
        "Every package version at once",
        "The logo and colors"
      ],
      "answer": 0,
      "explanation": "The first failing step is the fastest path to a precise, reversible fix."
    },
    "docs": [
      {
        "label": "GitHub Actions logs",
        "url": "https://docs.github.com/en/actions/monitoring-and-troubleshooting-workflows/monitoring-workflows/using-workflow-run-logs"
      }
    ]
  },
  {
    "id": "launch-checklist",
    "title": "From 'deployed' to genuinely usable",
    "category": "Safety",
    "minutes": 10,
    "summary": "Verify the public app before bringing customers into it.",
    "explain": "A hosting provider can say READY while the app's login, database or checkout is broken. Launch readiness means testing the real user journey, errors, costs and rollback, not just a green deployment indicator.",
    "analogy": "A shop has not opened successfully if the door works but no customer can pay.",
    "steps": [
      "Open the actual public HTTPS URL on a phone and a desktop.",
      "Test login/logout, roles and a denied unauthorized action when applicable.",
      "Create and edit a record; refresh to confirm persistence.",
      "Inspect relevant logs and verify error messages do not expose secrets.",
      "Check provider budgets, monitoring, custom-domain DNS and rollback plan.",
      "Only then share the link with real users."
    ],
    "pitfalls": [
      "READY is hosting status, not proof every feature works.",
      "Testing only as an administrator can hide authorization bugs.",
      "Do not attach a production domain to an unverified build."
    ],
    "exercise": "Create a five-point acceptance checklist for your own application and mark each item only after observing it.",
    "quiz": {
      "question": "Which is the strongest launch evidence?",
      "options": [
        "A cloud icon marked green",
        "A public URL with tested auth and real data persistence",
        "A GitHub repository with 38 files"
      ],
      "answer": 1,
      "explanation": "An actual working user journey confirms more than a screenshot or repository."
    },
    "docs": [
      {
        "label": "Vercel deployment docs",
        "url": "https://vercel.com/docs/deployments"
      },
      {
        "label": "Cloudflare Workers docs",
        "url": "https://developers.cloudflare.com/workers/"
      }
    ]
  }
];

export function getKnowledgeLesson(id: string): KnowledgeLesson | undefined {
  return KNOWLEDGE_LESSONS.find((lesson) => lesson.id === id);
}
export const KNOWLEDGE_CATEGORIES = ["All", "Building", "GitHub", "Hosting", "Databases", "Safety", "Troubleshooting"] as const;
