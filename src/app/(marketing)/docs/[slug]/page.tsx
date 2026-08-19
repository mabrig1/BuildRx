import { promises as fs } from "fs";
import path from "path";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Markdown } from "@/components/chat/markdown";
import { docPages } from "@/lib/docs";

// The guides live as markdown in the repo's docs/ folder and are read
// at build time (static generation), so no runtime file tracing needed.
export const dynamic = "force-static";

export function generateStaticParams() {
  return docPages.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = docPages.find((d) => d.slug === slug);
  return doc
    ? { title: `${doc.title} — Docs`, description: doc.description }
    : {};
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const doc = docPages.find((d) => d.slug === slug);
  if (!doc) notFound();

  const content = await fs.readFile(
    path.join(process.cwd(), "docs", `${slug}.md`),
    "utf-8"
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <Link
        href="/docs"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        All docs
      </Link>
      <Markdown
        content={content}
        className="[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_table]:text-sm [&_pre]:text-[13px] text-[15px]"
      />
    </div>
  );
}
