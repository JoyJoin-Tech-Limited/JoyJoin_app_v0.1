import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpenCheck, CalendarClock, CheckCircle2, MapPinned, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlashScheduleTab } from "@/components/admin/flash/FlashScheduleTab";
import { FlashManualHoldPanel } from "@/components/admin/flash/FlashManualHoldPanel";
import { FlashEquipmentRewardsPanel } from "@/components/admin/flash/FlashEquipmentRewardsPanel";
import { FlashOperationsAnalytics } from "@/components/admin/flash/FlashOperationsAnalytics";
import { FlashOperationsConsistency } from "@/components/admin/flash/FlashOperationsConsistency";
import { FlashStoryPanel } from "@/components/admin/flash/FlashStoryPanel";
import {
  FlashLocationsPanel,
  FlashNpcPanel,
} from "@/components/admin/flash/FlashCatalogPanels";
import { useAuth } from "@/hooks/auth/useAuth";
import { useToast } from "@/hooks/ui/use-toast";
import {
  type FlashEncounterLocation,
  type FlashNpc,
  type FlashOverview,
  canWriteFlashAdmin,
  getFlashReadinessItems,
  getShenzhenDatePair,
  unpackFlashCollection,
} from "@/lib/flashAdmin";
import { apiRequest, queryClient } from "@/lib/queryClient";

type CollectionResponse<T> =
  | T[]
  | { items?: T[]; data?: T[]; npcs?: T[]; locations?: T[] };

export default function AdminFlashPage() {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const testArrivalQuery = useQuery<{ available: boolean; enabled: boolean }>({
    queryKey: ["/api/admin/alang/test-arrival"],
  });
  const testArrivalMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest("PUT", "/api/admin/alang/test-arrival", { enabled });
      return response.json() as Promise<{ available: boolean; enabled: boolean }>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/alang/test-arrival"], data);
      toast({
        title: data.enabled ? "异地到达测试已开启" : "实际到达校验已恢复",
        description: data.enabled
          ? "地图页收到下一次有效位置更新后，会直接通过到达校验并进入 NPC 故事。"
          : "小程序将重新按 10 米距离判断是否到达。",
      });
    },
    onError: (error: Error) => {
      toast({ title: "测试开关更新失败", description: error.message, variant: "destructive" });
    },
  });
  const npcs = unpackFlashCollection(npcsQuery.data);
  const locations = unpackFlashCollection(locationsQuery.data);
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
      label: "已发布故事季",
      value: readiness?.counts.publishedStorySeasons ?? 0,
      hint: "当前只开放第一季",
      icon: BookOpenCheck,
    },
    {
      label: "已审核故事单元",
      value: readiness?.counts.reviewedStoryEpisodes ?? 0,
      hint: "第一季目标 15 个",
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
            管理 NPC、街头盲盒地点、当日排班与第一季故事。故事内容完成审核并发布后，才会进入正式流程。
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

      <Card className="border-primary/20 bg-primary/[0.03]" data-testid="flash-any-location-arrival-panel">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-primary/10 p-2 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold">不用到现场，直接测试到达</p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                开启后，测试用户不需要前往 NPC 出现地点；在地图页保持前台定位，下一次有效位置更新会直接判定到达，并进入该 NPC 的第一季故事单元。仅非生产环境生效。
              </p>
              {testArrivalQuery.isError ? (
                <p className="mt-2 text-xs font-medium text-destructive">开关状态读取失败，请刷新后重试。</p>
              ) : testArrivalQuery.data?.available === false ? (
                <p className="mt-2 text-xs font-medium text-muted-foreground">当前为生产环境，此测试能力已被服务端强制关闭。</p>
              ) : testArrivalQuery.data?.enabled ? (
                <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">测试模式正在生效，测试完成后请及时关闭。</p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-center">
            <span className="text-sm font-medium">
              {testArrivalQuery.isLoading
                ? "读取中"
                : testArrivalQuery.isError
                  ? "读取失败"
                  : testArrivalQuery.data?.available === false
                    ? "生产环境不可用"
                    : testArrivalQuery.data?.enabled ? "已开启" : "已关闭"}
            </span>
            <Switch
              checked={testArrivalQuery.data?.enabled ?? false}
              disabled={
                !canWrite
                || testArrivalQuery.isLoading
                || testArrivalQuery.isError
                || testArrivalMutation.isPending
                || testArrivalQuery.data?.available === false
              }
              onCheckedChange={(enabled) => testArrivalMutation.mutate(enabled)}
              aria-label="不用到现场，直接测试到达"
              data-testid="switch-flash-any-location-arrival"
            />
          </div>
        </CardContent>
      </Card>

      {readiness?.ready ? (
        <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <AlertTitle>街头盲盒目录已就绪</AlertTitle>
          <AlertDescription>
            正式 NPC、地点和第一季故事均已通过发布检查。请继续确认当日排班已生成并发布。
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

      <FlashManualHoldPanel canWrite={canWrite} npcs={npcs} locations={locations} />

      <Tabs defaultValue="schedules" className="space-y-4">
        <div className="pb-1">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-7">
            <TabsTrigger value="schedules" data-testid="tab-flash-schedules">今日 / 次日排班</TabsTrigger>
            <TabsTrigger value="npcs" data-testid="tab-flash-npcs">NPC</TabsTrigger>
            <TabsTrigger value="encounter-locations" data-testid="tab-flash-locations">街头盲盒地点</TabsTrigger>
            <TabsTrigger value="story" data-testid="tab-flash-story">第一季故事</TabsTrigger>
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
        <TabsContent value="story" className="mt-0">
          <FlashStoryPanel canWrite={canWrite} />
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
