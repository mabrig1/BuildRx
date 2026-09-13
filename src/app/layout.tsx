import type { Metadata } from "next";
import { Suspense } from "react";

import { PostHogPageviews } from "@/lib/analytics/posthog-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { brandConfig, siteConfig } from "@/lib/constants";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} · ${brandConfig.companyName}`,
    template: `%s · ${siteConfig.name} · ${brandConfig.companyName}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  creator: brandConfig.companyName,
  publisher: brandConfig.companyName,
  authors: [{ name: brandConfig.companyName, url: brandConfig.contacts.website.href }],
  keywords: [
    "BuildRx",
    "MABRIG Technologies",
    "AI app builder",
    "full-stack development",
    "Vercel",
    "GitHub",
    "MongoDB Atlas",
    "Supabase",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <PostHogPageviews />
          </Suspense>
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
