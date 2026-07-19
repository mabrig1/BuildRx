import {
  Bot,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export const siteConfig = {
  name: "BuildRx",
  description:
    "Build production-ready apps by chatting with AI. Describe what you want, watch it come to life.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  links: {
    github: "https://github.com/mabrig1/BuildRx",
  },
} as const;

/** Marketing site navigation (buildrx.online). */
export const marketingNav = [
  { title: "Features", href: "/features" },
  { title: "Pricing", href: "/pricing" },
  { title: "Docs", href: "/docs" },
] as const;

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

export const dashboardNav: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", href: "/projects", icon: FolderKanban },
  { title: "AI Chat", href: "/chat", icon: Bot },
  { title: "Agents", href: "/agents", icon: Sparkles },
  { title: "Billing", href: "/billing", icon: CreditCard },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Admin", href: "/admin", icon: ShieldCheck, adminOnly: true },
];

export interface PlanDefinition {
  id: "free" | "pro";
  name: string;
  price: number;
  description: string;
  features: string[];
  limits: {
    /** Max projects (Infinity = unlimited). */
    projects: number;
    /** Max AI requests per calendar month. */
    aiRequestsPerMonth: number;
  };
}

export const plans: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "For trying things out",
    features: ["5 projects", "50 AI requests / month", "Community support"],
    limits: { projects: 5, aiRequestsPerMonth: 50 },
  },
  {
    id: "pro",
    name: "Pro",
    price: 25,
    description: "For serious builders",
    features: [
      "Unlimited projects",
      "2,000 AI requests / month",
      "Custom domains",
      "Priority support",
    ],
    limits: { projects: Infinity, aiRequestsPerMonth: 2000 },
  },
];

export function planById(id: string | null | undefined): PlanDefinition {
  return plans.find((plan) => plan.id === id) ?? plans[0];
}
