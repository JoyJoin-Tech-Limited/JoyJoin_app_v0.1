import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock3, MapPin, Radio, UserRound, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/ui/use-toast";
import {
  type FlashEncounterLocation,
  type FlashManualHold,
  type FlashManualHoldStatus,
  type FlashNpc,
  getNpcIds,
} from "@/lib/flashAdmin";
import { fmtDateTime } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FlashListSkeleton } from "./FlashQueryState";

type PendingAction =
  | { kind: "start"; npcId: string; locationId: string }
  | { kind: "stop"; hold: FlashManualHold }
  | null;

function errorDescription(error: unknown): string {
  return error instanceof Error ? error.message : "操作没有完成，请稍后再试。";
}

export function FlashManualHoldPanel({
  canWrite,
  npcs,
  locations,
}: {
  canWrite: boolean;
  npcs: FlashNpc[];
  locations: FlashEncounterLocation[];
}) {
  const { toast } = useToast();
  const [npcId, setNpcId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const statusQuery = useQuery<FlashManualHoldStatus>({
    queryKey: ["/api/admin/alang/manual-holds"],
    refetchInterval: 15_000,
  });
  const status = statusQuery.data;
  const activeNpcIds = useMemo(
    () => new Set((status?.activeHolds ?? []).map((hold) => hold.npc.id)),
    [status?.activeHolds],
  );
  const selectableNpcs = useMemo(
    () => npcs.filter((npc) => npc.isActive && !activeNpcIds.has(npc.id)),
    [activeNpcIds, npcs],
  );
  const selectableLocations = useMemo(
    () => locations.filter((location) => (
      location.isActive
      && location.approvalStatus === "approved"
      && getNpcIds(location).includes(npcId)
    )),
    [locations, npcId],
  );

  useEffect(() => {
    if (!selectableLocations.some((location) => location.id === locationId)) setLocationId("");
  }, [locationId, selectableLocations]);

  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/manual-holds"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/overview"] }),
  ]);

  const startMutation = useMutation({
    mutationFn: async (payload: { npcId: string; locationId: string }) => {
      const response = await apiRequest("POST", "/api/admin/alang/manual-holds/start", payload);
      return response.json();
    },
    onSuccess: async () => {
      await refresh();
      setNpcId("");
      setLocationId("");
      toast({ title: "NPC 已保持在线", description: "不会自动下线；需要在这里显式结束。" });
    },
    onError: (error) => toast({ title: "上线没有完成", description: errorDescription(error), variant: "destructive" }),
  });

  const stopMutation = useMutation({
    mutationFn: async (hold: FlashManualHold) => {
      const response = await apiRequest("POST", `/api/admin/alang/manual-holds/${hold.appearanceId}/stop`, {});
      return response.json();
    },
    onSuccess: async () => {
      await refresh();
      toast({ title: "NPC 已下线", description: "这次测试保持在线已经结束。" });
    },
    onError: (error) => toast({ title: "下线没有完成", description: errorDescription(error), variant: "destructive" }),
  });

  const executePendingAction = () => {
    if (!pendingAction) return;
    if (pendingAction.kind === "start") {
      startMutation.mutate({ npcId: pendingAction.npcId, locationId: pendingAction.locationId });
    } else {
      stopMutation.mutate(pendingAction.hold);
    }
    setPendingAction(null);
  };

  if (statusQuery.isLoading) return <FlashListSkeleton />;

  return (
    <Card className="border-violet-200 bg-violet-50/50 dark:border-violet-900/60 dark:bg-violet-950/10" data-testid="flash-manual-hold-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">测试期间手动在线</CardTitle>
              <Badge variant="outline">仅 staging</Badge>
            </div>
            <CardDescription className="mt-1">
              手动上线后没有自动结束时间，只有显式点击“下线”才会结束；正式排班不受影响。
            </CardDescription>
          </div>
          <Radio className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {statusQuery.isError ? (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>状态读取失败</AlertTitle>
            <AlertDescription>{errorDescription(statusQuery.error)}</AlertDescription>
          </Alert>
        ) : !status?.available ? (
          <Alert>
            <XCircle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>当前环境不可用</AlertTitle>
            <AlertDescription>这项能力只在 staging 开放；production 会由服务端强制拒绝。</AlertDescription>
          </Alert>
        ) : !status.schemaReady ? (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>等待数据库迁移</AlertTitle>
            <AlertDescription>请先应用并核验手动保持在线的增量迁移，再执行测试。</AlertDescription>
          </Alert>
        ) : (
          <>
            {(status.activeHolds ?? []).length > 0 && (
              <div className="space-y-2">
                {status.activeHolds.map((hold) => (
                  <div key={hold.appearanceId} className="flex flex-col gap-3 rounded-xl border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        <UserRound className="h-4 w-4 text-primary" aria-hidden="true" />
                        {hold.npc.name}
                        <Badge>保持在线中</Badge>
                      </div>
                      <p className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        {hold.location.district} · {hold.location.name}
                      </p>
                      <p className="text-xs text-muted-foreground">开始于 {fmtDateTime(hold.startedAt)}</p>
                    </div>
                    <Button
                      variant="destructive"
                      disabled={!canWrite || stopMutation.isPending}
                      onClick={() => setPendingAction({ kind: "stop", hold })}
                      data-testid={`button-stop-flash-manual-hold-${hold.appearanceId}`}
                    >
                      显式下线
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-3 rounded-xl border border-dashed bg-background/70 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label>NPC</Label>
                <Select value={npcId} onValueChange={setNpcId} disabled={!canWrite}>
                  <SelectTrigger data-testid="select-flash-manual-hold-npc"><SelectValue placeholder="选择 NPC" /></SelectTrigger>
                  <SelectContent>
                    {selectableNpcs.map((npc) => <SelectItem key={npc.id} value={npc.id}>{npc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>已审核地点</Label>
                <Select value={locationId} onValueChange={setLocationId} disabled={!canWrite || !npcId}>
                  <SelectTrigger data-testid="select-flash-manual-hold-location"><SelectValue placeholder="选择已绑定地点" /></SelectTrigger>
                  <SelectContent>
                    {selectableLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>{location.district} · {location.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                disabled={!canWrite || !npcId || !locationId || startMutation.isPending}
                onClick={() => setPendingAction({ kind: "start", npcId, locationId })}
                data-testid="button-start-flash-manual-hold"
              >
                立即保持在线
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <AlertDialog open={pendingAction !== null} onOpenChange={(open) => { if (!open) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingAction?.kind === "stop" ? "确认让 NPC 下线？" : "确认立即上线？"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.kind === "stop"
                ? "下线后用户列表会立即移除这位 NPC，正在寻找但尚未到达的用户也无法继续定位。"
                : "上线后不会自动结束。请在测试完成后回到这里显式下线。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={executePendingAction} data-testid="button-confirm-flash-manual-hold-action">
              {pendingAction?.kind === "stop" ? "确认下线" : "确认上线"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
