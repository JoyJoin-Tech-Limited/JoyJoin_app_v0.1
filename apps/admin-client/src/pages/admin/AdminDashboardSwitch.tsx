import { lazy, Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";

const AdminDashboardV2 = lazy(() => import("./AdminDashboardV2"));
const AdminDashboardLegacy = lazy(() => import("./AdminDashboard"));

function DashboardFallback() {
  return (
    <div className="p-6 space-y-5">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Dashboard rollover switch.
 *
 * Rollback is a URL, not a flag: `?v=1` restores the legacy dashboard for every
 * role. This is deliberate — the admin feature-flag endpoint is
 * `requireSuperAdmin`, so a flag would leave `operator` and `viewer` with no
 * escape hatch if the new surface broke.
 */
export default function AdminDashboardSwitch() {
  const legacy =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("v") === "1";

  return (
    <Suspense fallback={<DashboardFallback />}>
      {legacy ? <AdminDashboardLegacy /> : <AdminDashboardV2 />}
    </Suspense>
  );
}
