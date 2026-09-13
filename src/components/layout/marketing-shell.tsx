import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  brandConfig,
  brandContactLinks,
  marketingNav,
  siteConfig,
} from "@/lib/constants";

/**
 * Shared shell for the marketing pages (home, features, pricing, docs):
 * sticky header with site nav and a common footer.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {marketingNav.map((item) => (
              <Button key={item.href} variant="ghost" size="sm" asChild>
                <Link href={item.href}>{item.title}</Link>
              </Button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" className="hidden sm:inline-flex" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">
                Get started
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
            <div className="space-y-4">
              <Logo />
              <div className="space-y-1">
                <p className="font-medium">{brandConfig.ownershipLine}</p>
                <p className="text-muted-foreground max-w-xl text-sm">
                  {brandConfig.supportLine}. Build, learn, deploy and get support
                  through our official channels below.
                </p>
              </div>
              <nav className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-sm">
                {marketingNav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {item.title}
                  </Link>
                ))}
                <Link
                  href="/login"
                  className="hover:text-foreground transition-colors"
                >
                  Sign in
                </Link>
              </nav>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold">Contact MABRIG Technologies</p>
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {brandContactLinks.map((contact) => (
                  <a
                    key={contact.href}
                    href={contact.href}
                    target={
                      contact.href.startsWith("http") ? "_blank" : undefined
                    }
                    rel={
                      contact.href.startsWith("http")
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="group min-w-0"
                  >
                    <span className="text-muted-foreground block text-xs">
                      {contact.label}
                    </span>
                    <span className="group-hover:text-primary block truncate text-sm font-medium transition-colors">
                      {"value" in contact ? contact.value : contact.label}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="text-muted-foreground flex flex-col gap-2 border-t pt-5 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
            </p>
            <p>{brandConfig.supportLine}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
