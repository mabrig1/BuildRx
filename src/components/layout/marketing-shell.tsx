import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { marketingNav, siteConfig } from "@/lib/constants";

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
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
          <Logo />
          <nav className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
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
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
        </div>
      </footer>
    </div>
  );
}
