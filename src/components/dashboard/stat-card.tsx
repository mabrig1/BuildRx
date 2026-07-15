import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <Card className="gap-1 py-5">
      <CardHeader className="gap-1">
        <CardDescription className="flex items-center gap-2 text-xs sm:text-sm">
          <Icon className="size-4 shrink-0" />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums sm:text-3xl">
          {value}
        </CardTitle>
        {hint ? (
          <p className="text-muted-foreground text-xs">{hint}</p>
        ) : null}
      </CardHeader>
    </Card>
  );
}
