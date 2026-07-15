import {
  Bot,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export const siteConfig = {
  name: "App-Creator",
  description:
    "Build production-ready apps by chatting with AI. Describe what you want, watch it come to life.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  links: {
    github: "https://github.com/mabrig1/App-Creator",
  },
} as const;

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
  { title: "Billing", href: "/billing", icon: CreditCard },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Admin", href: "/admin", icon: ShieldCheck, adminOnly: true },
];

export const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "For trying things out",
    features: ["3 projects", "50 AI messages / month", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 25,
    description: "For serious builders",
    features: [
      "Unlimited projects",
      "2,000 AI messages / month",
      "Custom domains",
      "Priority support",
    ],
  },
  {
    id: "team",
    name: "Team",
    price: 60,
    description: "For teams shipping together",
    features: [
      "Everything in Pro",
      "10,000 AI messages / month",
      "Shared workspaces",
      "Role-based access",
    ],
  },
] as const;
