import { Database } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function ConnectSupabaseNotice() {
  return (
    <Card className="border-amber-500/40 bg-amber-500/5 py-4">
      <CardContent className="flex items-start gap-3 text-sm">
        <Database className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-medium">Supabase is not connected</p>
          <p className="text-muted-foreground">
            Copy <code className="font-mono text-xs">.env.example</code> to{" "}
            <code className="font-mono text-xs">.env.local</code> and add your
            Supabase keys to enable live data.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
