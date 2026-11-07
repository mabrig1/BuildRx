/** Curated original BuildRx source template descriptions, safe for browser UI. */
export interface BeginnerCodeTemplate {
  id: string;
  name: string;
  description: string;
  category: "Website" | "Productivity" | "Retail";
  difficulty: "Beginner";
  storage: "None" | "Browser only";
  nextStep: string;
}

export const BEGINNER_CODE_TEMPLATES: readonly BeginnerCodeTemplate[] = [
  {
    id: "beginner-business-website",
    name: "Business Website",
    description: "A responsive services website with working email contact links, designed for local shops.",
    category: "Website",
    difficulty: "Beginner",
    storage: "None",
    nextStep: "Replace the sample business name, services, prices and contact details.",
  },
  {
    id: "beginner-personal-portfolio",
    name: "Personal Portfolio",
    description: "A clean portfolio for creators, students and freelancers with project showcase cards.",
    category: "Website",
    difficulty: "Beginner",
    storage: "None",
    nextStep: "Update your biography, skills, sample project descriptions and email address.",
  },
  {
    id: "beginner-task-planner",
    name: "My Task Planner",
    description: "Add, finish and remove daily tasks. Saves demo tasks in this browser without an API key.",
    category: "Productivity",
    difficulty: "Beginner",
    storage: "Browser only",
    nextStep: "Try tasks, then add sign-in and a proper database before sharing across devices.",
  },
  {
    id: "beginner-stock-list",
    name: "Small Shop Stock List",
    description: "Add products and adjust stock counts in a local demo inventory, with low-stock notices.",
    category: "Retail",
    difficulty: "Beginner",
    storage: "Browser only",
    nextStep: "Replace demo data storage with authenticated inventory records before real sales.",
  },
] as const;

export function findBeginnerCodeTemplate(id: string): BeginnerCodeTemplate | undefined {
  return BEGINNER_CODE_TEMPLATES.find(template => template.id === id);
}
