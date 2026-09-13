import Link from "next/link";
import { Sparkles } from "lucide-react";

import { brandConfig, siteConfig } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-semibold", className)}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
        <Sparkles className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="tracking-tight">{siteConfig.name}</span>
        <span className="text-muted-foreground mt-1 truncate text-[10px] font-medium tracking-wide">
          by {brandConfig.companyName}
        </span>
      </span>
    </Link>
  );
}
