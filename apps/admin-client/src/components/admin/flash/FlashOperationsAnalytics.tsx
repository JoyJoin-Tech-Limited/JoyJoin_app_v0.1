import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, CalendarClock, MapPinned, Store, UsersRound } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FlashOverview } from "@/lib/flashAdmin";
import { FlashEquipmentAnalytics } from "./FlashEquipmentAnalytics";
import { FlashErrorState, FlashListSkeleton } from "./FlashQueryState";

function describeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/^\d+:\s*/, "") || "运营分析暂时无法加载";
}

export function FlashOperationsAnalytics() {
  const query = useQuery<FlashOverview>({ queryKey: ["/api/admin/alang/overview"] });

  if (query.isLoading) return <FlashListSkeleton />;
  if (query.isError || !query.data) {
    return <FlashErrorState message={describeError(query.error)} onRetry={() => void query.refetch()} />;
  }

  const counts = query.data.counts ?? {};
  const todayPublished = query.data.today?.shifts.filter((shift) => shift.status === "published").length ?? 0;
  const nextDraftShifts = query.data.nextDraft?.shifts.length ?? 0;
  const metrics = [
    { label: "可用 NPC", value: counts.activeNpcs ?? 0, hint: "当前启用的数字动物", icon: UsersRound },
    { label: "可排班地点", value: counts.activeEncounterLocations ?? 0, hint: "启用且审核通过", icon: MapPinned },
    { label: "任务目的地", value: counts.approvedTaskDestinations ?? 0, hint: "启用且审核通过", icon: Store },
    { label: "人工已审任务", value: counts.activeTaskTemplates ?? 0, hint: "可进入随机任务库", icon: BookOpenCheck },
    { label: "今日已发布班次", value: todayPublished, hint: `次日草案 ${nextDraftShifts} 个班次`, icon: CalendarClock },
  ];

  return (
    <div className="space-y-6" data-testid="panel-flash-operations-analytics">
      <div>
        <h3 className="text-lg font-semibold">街头盲盒运营数据分析</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          汇总 NPC、地点、任务、排班和装备奖励。目录与排班展示当前运行状态；装备奖励使用真实历史流水。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>当前运营覆盖</CardTitle>
          <CardDescription>用于判断今天是否具备完整运行资源，不把当前库存快照伪装成历史趋势。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map(({ label, value, hint, icon: Icon }) => (
            <div key={label} className="flex items-start justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </div>
              <span className="rounded-xl bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="border-t pt-6">
        <FlashEquipmentAnalytics />
      </div>
    </div>
  );
}
