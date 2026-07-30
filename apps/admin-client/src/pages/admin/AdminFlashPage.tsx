import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, CalendarClock, CheckCircle2, MapPinned, RefreshCw, Store, UsersRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlashScheduleTab } from "@/components/admin/flash/FlashScheduleTab";
import { FlashEquipmentRewardsPanel } from "@/components/admin/flash/FlashEquipmentRewardsPanel";
import { FlashOperationsAnalytics } from "@/components/admin/flash/FlashOperationsAnalytics";
import { FlashOperationsConsistency } from "@/components/admin/flash/FlashOperationsConsistency";
import {
  FlashLocationsPanel,
  FlashNpcPanel,
  FlashTaskTemplatesPanel,
} from "@/components/admin/flash/FlashCatalogPanels";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  type FlashEncounterLocation,
  type FlashNpc,
  type FlashOverview,
  type FlashTaskDestination,
  canWriteFlashAdmin,
  getFlashReadinessItems,
  getShenzhenDatePair,
  unpackFlashCollection,
} from "@/lib/flashAdmin";
import { queryClient } from "@/lib/queryClient";

type CollectionResponse<T> =
  | T[]
  | { items?: T[]; data?: T[]; npcs?: T[]; locations?: T[]; destinations?: T[]; templates?: T[] };

export default function AdminFlashPage() {
  const { user } = useAuth();
  const canWrite = canWriteFlashAdmin(user?.adminRole);
  const datePair = getShenzhenDatePair();

  const overviewQuery = useQuery<FlashOverview>({
    queryKey: ["/api/admin/alang/overview"],
    refetchInterval: (query) => query.state.data?.readiness?.ready ? false : 5_000,
  });
  const npcsQuery = useQuery<CollectionResponse<FlashNpc>>({ queryKey: ["/api/admin/alang/npcs"] });
  const locationsQuery = useQuery<CollectionResponse<FlashEncounterLocation>>({
    queryKey: ["/api/admin/alang/encounter-locations"],
  });
  const destinationsQuery = useQuery<CollectionResponse<FlashTaskDestination>>({
    queryKey: ["/api/admin/alang/task-destinations"],
  });

  const npcs = unpackFlashCollection(npcsQuery.data);
  const locations = unpackFlashCollection(locationsQuery.data);
  const destinations = unpackFlashCollection(destinationsQuery.data);
  const counts = overviewQuery.data?.counts;
  const readiness = overviewQuery.data?.readiness;
  const readinessItems = getFlashReadinessItems(readiness);

  const refreshAll = () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = String(query.queryKey[0] ?? "");
        return key.startsWith("/api/admin/alang") || key.startsWith("/api/admin/equipment");
      },
    });

  const summaryCards = [
    {
      label: "可用 NPC",
      value: counts?.activeNpcs ?? npcs.filter((npc) => npc.isActive).length,
      hint: "支持持续扩展数字动物角色",
      icon: UsersRound,
    },
    {
      label: "安全街头盲盒地点",
      value: counts?.activeEncounterLocations ?? counts?.approvedEncounterLocations ?? locations.filter((item) => item.isActive && item.approvalStatus === "approved").length,
      hint: "已审核且可参与排班",
      icon: MapPinned,
    },
    {
      label: "任务目的地",
      value: counts?.approvedTaskDestinations ?? destinations.filter((item) => item.isActive && item.approvalStatus === "approved").length,
      hint: "无消费也能完成",
      icon: Store,
    },
    {
      label: "人工已审任务",
      value: counts?.activeTaskTemplates ?? counts?.reviewedTasks ?? 0,
      hint: "目标至少 30 个",
      icon: BookOpenCheck,
    },
    {
      label: "今日班次",
      value: counts?.publishedShiftsToday ?? overviewQuery.data?.today?.shifts.filter((shift) => shift.status === "published").length ?? 0,
      hint: "到点上线，到点离开",
      icon: CalendarClock,
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6" data-testid="page-admin-flash">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
            深圳 · 数字叙事 NPC
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">街头盲盒运营</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            管理 NPC 的次日随机草案、固定上线日、两类地点与人工审核任务库。这里不会发送推送，也不会公开未来排班。
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refreshAll}
          disabled={overviewQuery.isFetching}
          data-testid="button-refresh-flash-admin"
          className="self-start"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${overviewQuery.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
          刷新
        </Button>
      </div>

      {!canWrite && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>只读查看</AlertTitle>
          <AlertDescription>viewer 可以检查排班与内容，但不能生成、发布、审核或修改。</AlertDescription>
        </Alert>
      )}

      {readiness?.ready ? (
        <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <AlertTitle>街头盲盒目录已就绪</AlertTitle>
          <AlertDescription>
            正式 NPC、地点和任务均已通过发布检查。请继续确认当日排班已生成并发布。
          </AlertDescription>
        </Alert>
      ) : readinessItems.length > 0 ? (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20" data-testid="flash-readiness-blockers">
          <BookOpenCheck className="h-4 w-4 text-amber-700" aria-hidden="true" />
          <AlertTitle>街头盲盒尚未开放，还差 {readinessItems.length} 项</AlertTitle>
          <AlertDescription>
            <p className="mb-3">这里显示的是小程序正在执行的同一套服务端发布检查；完成后页面会自动刷新。</p>
            <ul className="space-y-2">
              {readinessItems.map((item) => (
                <li key={item.code} className="rounded-lg border border-amber-200/80 bg-white/70 px-3 py-2 dark:border-amber-900/60 dark:bg-background/40">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="ml-2 text-muted-foreground">{item.detail}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : overviewQuery.isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map(({ label, value, hint, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                {overviewQuery.isLoading && npcsQuery.isLoading ? (
                  <Skeleton className="mt-2 h-8 w-14" />
                ) : (
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
              </div>
              <span className="rounded-xl bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="schedules" className="space-y-4">
        <div className="pb-1">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-8">
            <TabsTrigger value="schedules" data-testid="tab-flash-schedules">今日 / 次日排班</TabsTrigger>
            <TabsTrigger value="npcs" data-testid="tab-flash-npcs">NPC</TabsTrigger>
            <TabsTrigger value="encounter-locations" data-testid="tab-flash-locations">街头盲盒地点</TabsTrigger>
            <TabsTrigger value="task-destinations" data-testid="tab-flash-destinations">任务目的地</TabsTrigger>
            <TabsTrigger value="task-templates" data-testid="tab-flash-tasks">任务库</TabsTrigger>
            <TabsTrigger value="equipment-rewards" data-testid="tab-flash-equipment-rewards">装备 / 奖励</TabsTrigger>
            <TabsTrigger value="consistency" data-testid="tab-flash-consistency">一致性检查</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-flash-analytics">数据分析</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="schedules" className="mt-0">
          <FlashScheduleTab
            canWrite={canWrite}
            today={datePair.today}
            tomorrow={datePair.tomorrow}
            npcs={npcs}
            locations={locations}
          />
        </TabsContent>
        <TabsContent value="npcs" className="mt-0"><FlashNpcPanel canWrite={canWrite} canSeed={canWrite} /></TabsContent>
        <TabsContent value="encounter-locations" className="mt-0">
          <FlashLocationsPanel canWrite={canWrite} kind="encounter" npcs={npcs} />
        </TabsContent>
        <TabsContent value="task-destinations" className="mt-0">
          <FlashLocationsPanel canWrite={canWrite} kind="destination" npcs={npcs} />
        </TabsContent>
        <TabsContent value="task-templates" className="mt-0">
          <FlashTaskTemplatesPanel canWrite={canWrite} npcs={npcs} destinations={destinations} />
        </TabsContent>
        <TabsContent value="equipment-rewards" className="mt-0">
          <FlashEquipmentRewardsPanel canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="consistency" className="mt-0">
          <FlashOperationsConsistency />
        </TabsContent>
        <TabsContent value="analytics" className="mt-0">
          <FlashOperationsAnalytics />
        </TabsContent>
      </Tabs>
    </div>
  );
}
