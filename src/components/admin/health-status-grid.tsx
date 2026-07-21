import {
  Bot,
  Clock,
  Database,
  HardDrive,
  KeyRound,
  Network,
  Rocket,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CheckResult, HealthStatus, Subsystem } from "@/lib/health/types";

const SUBSYSTEM_ICONS: Record<Subsystem, LucideIcon> = {
  database: Database,
  auth: KeyRound,
  api: Network,
  deployment: Rocket,
  storage: HardDrive,
  ai: Bot,
  jobs: Clock,
};

function statusClass(status: HealthStatus) {
  switch (status) {
    case "healthy":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "degraded":
      return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "down":
      return "border-destructive/40 bg-destructive/10 text-destructive";
  }
}

function cardAccentClass(status: HealthStatus) {
  switch (status) {
    case "healthy":
      return "border-emerald-500/30";
    case "degraded":
      return "border-amber-500/40";
    case "down":
      return "border-destructive/50";
  }
}

export function HealthStatusGrid({ checks }: { checks: CheckResult[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {checks.map((check) => {
        const Icon = SUBSYSTEM_ICONS[check.subsystem];
        return (
          <Card key={check.subsystem} className={cn("gap-2", cardAccentClass(check.status))}>
            <CardHeader className="gap-1">
              <CardTitle className="flex items-center justify-between gap-2 text-sm font-medium">
                <span className="flex items-center gap-2">
                  <Icon className="text-muted-foreground size-4 shrink-0" />
                  {check.label}
                </span>
                <Badge variant="outline" className={cn("capitalize", statusClass(check.status))}>
                  {check.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1">
              <p className="text-muted-foreground text-sm">{check.summary}</p>
              <p className="text-muted-foreground text-xs tabular-nums">
                checked in {check.durationMs}ms
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
