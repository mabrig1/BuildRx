import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { docPages } from "@/lib/docs";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Guides for installing, configuring, deploying, and integrating BuildRx.",
};

export default function DocsIndexPage() {
  return (
    <>
      <section className="border-b">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 px-4 py-16 text-center md:py-24">
          <h1 className="text-4xl font-semibold tracking-tighter md:text-5xl">
            Documentation
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg text-balance">
            Everything you need to install, configure, deploy, and build
            against BuildRx.
          </p>
        </div>
      </section>

      <section>
        <div className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-4 px-4 py-16 sm:grid-cols-2">
          {docPages.map((doc) => (
            <Link key={doc.slug} href={`/docs/${doc.slug}`} className="group">
              <Card className="h-full gap-2 transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <div className="bg-primary/10 text-primary mb-2 flex size-9 items-center justify-center rounded-lg">
                    <doc.icon className="size-4" />
                  </div>
                  <CardTitle className="flex items-center gap-1.5">
                    {doc.title}
                    <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardTitle>
                  <CardDescription>{doc.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
