import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, CalendarClock, MapPinned, RefreshCw, Store, UsersRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlashScheduleTab } from "@/components/admin/flash/FlashScheduleTab";
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

  const overviewQuery = useQuery<FlashOverview>({ queryKey: ["/api/admin/alang/overview"] });
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

  const refreshAll = () =>
    queryClient.invalidateQueries({
      predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/admin/alang"),
    });

  const summaryCards = [
    {
      label: "可用 NPC",
      value: counts?.activeNpcs ?? npcs.filter((npc) => npc.isActive).length,
      hint: "固定 5 位动物角色",
      icon: UsersRound,
    },
    {
      label: "安全闪现地点",
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
          <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">闪现运营</h1>
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
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-3 xl:grid-cols-5">
            <TabsTrigger value="schedules" data-testid="tab-flash-schedules">今日 / 次日排班</TabsTrigger>
            <TabsTrigger value="npcs" data-testid="tab-flash-npcs">NPC</TabsTrigger>
            <TabsTrigger value="encounter-locations" data-testid="tab-flash-locations">闪现地点</TabsTrigger>
            <TabsTrigger value="task-destinations" data-testid="tab-flash-destinations">任务目的地</TabsTrigger>
            <TabsTrigger value="task-templates" data-testid="tab-flash-tasks">任务库</TabsTrigger>
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
        <TabsContent value="npcs" className="mt-0"><FlashNpcPanel canWrite={canWrite} /></TabsContent>
        <TabsContent value="encounter-locations" className="mt-0">
          <FlashLocationsPanel canWrite={canWrite} kind="encounter" npcs={npcs} />
        </TabsContent>
        <TabsContent value="task-destinations" className="mt-0">
          <FlashLocationsPanel canWrite={canWrite} kind="destination" npcs={npcs} />
        </TabsContent>
        <TabsContent value="task-templates" className="mt-0">
          <FlashTaskTemplatesPanel canWrite={canWrite} npcs={npcs} destinations={destinations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
