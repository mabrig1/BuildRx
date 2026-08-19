import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, timeAgo } from "@/lib/utils";
import type { Database } from "@/types/database";

type SystemLogRow = Database["public"]["Tables"]["system_logs"]["Row"];

function levelClass(level: SystemLogRow["level"]) {
  switch (level) {
    case "error":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    case "warn":
      return "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
    default:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}

export function ErrorHistoryTable({ logs }: { logs: SystemLogRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4" />
          Error history
        </CardTitle>
        <CardDescription>
          Every classified error, with the exact cause instead of a generic message.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No errors logged yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge variant="outline" className={cn("capitalize", levelClass(log.level))}>
                      {log.level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-32 truncate font-mono text-xs">
                    {log.source}
                    {log.code ? ` · ${log.code}` : ""}
                  </TableCell>
                  <TableCell className="max-w-md truncate">{log.message}</TableCell>
                  <TableCell className="text-muted-foreground text-right text-xs whitespace-nowrap">
                    {timeAgo(log.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
