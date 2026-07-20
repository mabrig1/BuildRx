import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while any (dashboard) segment's async server component is
 * fetching — every top-level dashboard page loads data server-side with
 * no client fallback of its own, so without this Next.js shows a blank
 * page during navigation. Generic on purpose: it approximates the
 * page-header + card-grid shape shared by most dashboard pages rather
 * than matching any one page exactly.
 */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
