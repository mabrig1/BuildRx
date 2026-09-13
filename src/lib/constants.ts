import {
  BookOpen,
  Bot,
  CreditCard,
  FolderKanban,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  Mail,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export const brandConfig = {
  companyName: "MABRIG Technologies",
  productName: "BuildRx",
  ownershipLine: "A MABRIG Technologies product",
  supportLine: "Developed and maintained by MABRIG Technologies",
  contacts: {
    phone: {
      label: "+234 706 534 2818",
      href: "tel:+2347065342818",
    },
    whatsapp: {
      label: "WhatsApp",
      value: "+234 706 534 2818",
      href: "https://wa.me/2347065342818",
    },
    primaryEmail: {
      label: "Email",
      value: "Mabrig1@gmail.com",
      href: "mailto:Mabrig1@gmail.com",
    },
    contactEmail: {
      label: "Contact",
      value: "contact@mabrigkorie.org",
      href: "mailto:contact@mabrigkorie.org",
    },
    website: {
      label: "Website",
      value: "mabrigkorie.org",
      href: "https://mabrigkorie.org",
    },
    store: {
      label: "Store",
      value: "store.mabrigkorie.org",
      href: "https://store.mabrigkorie.org",
    },
    facebook: {
      label: "Facebook",
      value: "Mabrig Korie",
      href: "https://web.facebook.com/apostlemabrigkorie",
    },
    tiktok: {
      label: "TikTok",
      value: "@mabrigkorie",
      href: "https://www.tiktok.com/@mabrigkorie",
    },
    youtube: {
      label: "YouTube",
      value: "@ApostleEmersonMabrigKorie",
      href: "https://www.youtube.com/@ApostleEmersonMabrigKorie",
    },
    github: {
      label: "GitHub",
      value: "mabrig1",
      href: "https://github.com/mabrig1",
    },
  },
} as const;

export const brandContactLinks = [
  brandConfig.contacts.phone,
  brandConfig.contacts.whatsapp,
  brandConfig.contacts.primaryEmail,
  brandConfig.contacts.contactEmail,
  brandConfig.contacts.website,
  brandConfig.contacts.store,
  brandConfig.contacts.facebook,
  brandConfig.contacts.tiktok,
  brandConfig.contacts.youtube,
  brandConfig.contacts.github,
] as const;

export const siteConfig = {
  name: brandConfig.productName,
  description:
    "Build production-ready apps by chatting with AI. Describe what you want, watch it come to life. Built by MABRIG Technologies.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  links: {
    github: "https://github.com/mabrig1/BuildRx",
    website: brandConfig.contacts.website.href,
    whatsapp: brandConfig.contacts.whatsapp.href,
  },
} as const;

/** Marketing site navigation (buildrx.online). */
export const marketingNav = [
  { title: "Features", href: "/features" },
  { title: "Pricing", href: "/pricing" },
  { title: "Tech+ Course", href: "/academy" },
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
  { title: "Tech+ Course", href: "/course", icon: GraduationCap },
  { title: "Guide", href: "/guide", icon: BookOpen },
  { title: "Contact", href: "/contact", icon: Mail },
  { title: "Billing", href: "/billing", icon: CreditCard },
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Admin", href: "/admin", icon: ShieldCheck, adminOnly: true },
  { title: "Health", href: "/admin/health", icon: HeartPulse, adminOnly: true },
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
