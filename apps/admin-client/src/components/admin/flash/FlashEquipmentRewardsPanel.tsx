import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Gift, PackageOpen, Plus, Save, ShieldCheck, Store } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/ui/use-toast";
import { fmtDateTimeShort } from "@/lib/dateUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { FlashEmptyState, FlashErrorState, FlashListSkeleton } from "./FlashQueryState";

type EquipmentItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  slot: "top" | "bottom" | "shoes" | "accessory";
  rarity: "common" | "rare";
  assetKey: string;
  compatibleArchetypes: string[] | null;
  shopAvailable: boolean;
  isActive: boolean;
};

type PoolItem = {
  itemId: string;
  itemName: string;
  itemSlot: string;
  itemRarity: string;
  weight: number;
  isActive: boolean;
};

type EquipmentPool = {
  id: string;
  slug: string;
  name: string;
  venueId: string | null;
  venueName: string | null;
  alangMissionId: string | null;
  alangMissionTitle: string | null;
  isActive: boolean;
  items: PoolItem[];
};

type EquipmentOverview = {
  items: { total: number; active: number; shop: number };
  pools: { total: number; active: number };
  rewards: { pending: number; resolved: number; fragmentsIssued: number; fragmentsSpent: number };
  rollout: { profilePixelAvatarEnabled: boolean; equipmentRewardsEnabled: boolean };
};

type RewardEntry = {
  id: string;
  sourceType: "blind_box" | "alang";
  poolName: string;
  status: "pending" | "resolved";
  resultKind: "new" | "duplicate" | null;
  fragmentsAwarded: number;
  pityBefore: number | null;
  pityAfter: number | null;
  drawVersion: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

type EquipmentSources = {
  venues: Array<{ id: string; name: string; city: string; area: string }>;
  missions: Array<{ id: string; title: string; slug: string; status: string }>;
};

const SLOT_LABELS: Record<EquipmentItem["slot"], string> = {
  top: "上装",
  bottom: "下装",
  shoes: "鞋履",
  accessory: "配饰",
};

const RARITY_LABELS = { common: "普通", rare: "稀有" } as const;

function describeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/^\d+:\s*/, "") || "请求暂时失败，请稍后重试";
}

async function invalidateEquipmentQueries() {
  await queryClient.invalidateQueries({
    predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/admin/equipment"),
  });
}

export function FlashEquipmentRewardsPanel({ canWrite }: { canWrite: boolean }) {
  const overview = useQuery<EquipmentOverview>({ queryKey: ["/api/admin/equipment/overview"] });
  const itemsQuery = useQuery<{ items: EquipmentItem[] }>({ queryKey: ["/api/admin/equipment/items"] });
  const poolsQuery = useQuery<{ pools: EquipmentPool[] }>({ queryKey: ["/api/admin/equipment/pools"] });
  const rewardsQuery = useQuery<{ entitlements: RewardEntry[] }>({ queryKey: ["/api/admin/equipment/rewards?limit=50"] });
  const sourcesQuery = useQuery<EquipmentSources>({ queryKey: ["/api/admin/equipment/sources"] });

  if (overview.isLoading || itemsQuery.isLoading || poolsQuery.isLoading) return <FlashListSkeleton />;
  if (overview.isError || itemsQuery.isError || poolsQuery.isError) {
    const error = overview.error || itemsQuery.error || poolsQuery.error;
    return <FlashErrorState message={describeError(error)} onRetry={() => void Promise.all([
      overview.refetch(),
      itemsQuery.refetch(),
      poolsQuery.refetch(),
    ])} />;
  }

  const items = itemsQuery.data?.items ?? [];
  const pools = poolsQuery.data?.pools ?? [];

  return (
    <div className="space-y-4" data-testid="panel-flash-equipment-rewards">
      <Alert className="border-violet-200 bg-violet-50/70 dark:border-violet-900/50 dark:bg-violet-950/20">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>装备奖励与正式闪现相互独立</AlertTitle>
        <AlertDescription className="mt-1 leading-6">
          这里管理 Profile「我的形象」使用的装备目录、地点/旧阿浪任务装备池和真实奖励流水。
          正式闪现任务当前不发装备；本页也不提供人工补发，避免绕过真实活动资格。
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2" aria-label="装备功能生效状态">
        <Badge variant={overview.data?.rollout.profilePixelAvatarEnabled ? "default" : "outline"}>
          我的形象：{overview.data?.rollout.profilePixelAvatarEnabled ? "已开放" : "未开放"}
        </Badge>
        <Badge variant={overview.data?.rollout.equipmentRewardsEnabled ? "default" : "outline"}>
          装备奖励：{overview.data?.rollout.equipmentRewardsEnabled ? "已开放" : "未开放"}
        </Badge>
        {!overview.data?.rollout.equipmentRewardsEnabled && (
          <span className="text-xs leading-6 text-muted-foreground">当前配置仅保存，不会向用户生成或开放奖励。</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="可用装备" value={overview.data?.items.active ?? 0} hint={`共 ${overview.data?.items.total ?? 0} 件`} icon={PackageOpen} />
        <MetricCard label="启用装备池" value={overview.data?.pools.active ?? 0} hint={`共 ${overview.data?.pools.total ?? 0} 个`} icon={Store} />
        <MetricCard label="待领取资格" value={overview.data?.rewards.pending ?? 0} hint={`已完成 ${overview.data?.rewards.resolved ?? 0} 次`} icon={Gift} />
        <MetricCard label="已发放碎片" value={overview.data?.rewards.fragmentsIssued ?? 0} hint={`已兑换 ${overview.data?.rewards.fragmentsSpent ?? 0}`} icon={Save} />
      </div>

      <Tabs defaultValue="catalog" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="catalog" data-testid="tab-equipment-catalog">装备目录</TabsTrigger>
          <TabsTrigger value="pools" data-testid="tab-equipment-pools">装备池</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-equipment-rewards">奖励流水</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog">
          <EquipmentCatalog canWrite={canWrite} items={items} />
        </TabsContent>
        <TabsContent value="pools">
          {sourcesQuery.isError ? (
            <FlashErrorState message={describeError(sourcesQuery.error)} onRetry={() => void sourcesQuery.refetch()} />
          ) : sourcesQuery.isLoading ? <FlashListSkeleton /> : (
            <EquipmentPools
              canWrite={canWrite}
              pools={pools}
              items={items}
              sources={sourcesQuery.data ?? { venues: [], missions: [] }}
            />
          )}
        </TabsContent>
        <TabsContent value="activity">
          {rewardsQuery.isError ? (
            <FlashErrorState message={describeError(rewardsQuery.error)} onRetry={() => void rewardsQuery.refetch()} />
          ) : (
            <RewardActivity entries={rewardsQuery.data?.entitlements ?? []} loading={rewardsQuery.isLoading} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value, hint, icon: Icon }: { label: string; value: number; hint: string; icon: typeof Gift }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      </CardContent>
    </Card>
  );
}

function EquipmentCatalog({ canWrite, items }: { canWrite: boolean; items: EquipmentItem[] }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const patchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EquipmentItem> }) =>
      (await apiRequest("PATCH", `/api/admin/equipment/items/${id}`, patch)).json(),
    onSuccess: async () => {
      await invalidateEquipmentQueries();
      toast({ title: "装备状态已更新" });
    },
    onError: (error) => toast({ title: "装备没有更新", description: describeError(error), variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>装备目录</CardTitle>
          <CardDescription>维护四个槽位的正式单品、稀有度、商店可兑换状态与素材键。</CardDescription>
        </div>
        {canWrite && <Button onClick={() => setCreateOpen(true)} data-testid="button-add-equipment"><Plus className="mr-2 h-4 w-4" />新增装备</Button>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <FlashEmptyState title="还没有装备" description="先创建正式装备单品，再把它加入地点或任务装备池。" icon={PackageOpen} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{item.name}</p>
                      <Badge variant="secondary">{SLOT_LABELS[item.slot]}</Badge>
                      <Badge variant={item.rarity === "rare" ? "default" : "outline"}>{RARITY_LABELS[item.rarity]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.slug}</p>
                  </div>
                  <Switch
                    checked={item.isActive}
                    disabled={!canWrite || patchMutation.isPending}
                    onCheckedChange={(checked) => patchMutation.mutate({ id: item.id, patch: { isActive: checked } })}
                    aria-label={`${item.name}启用状态`}
                    data-testid={`switch-equipment-active-${item.id}`}
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{item.description || "暂无说明"}</p>
                <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs">
                  <p className="break-all text-muted-foreground">素材键：{item.assetKey}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span>碎片商店可兑换</span>
                    <Switch
                      checked={item.shopAvailable}
                      disabled={!canWrite || patchMutation.isPending}
                      onCheckedChange={(checked) => patchMutation.mutate({ id: item.id, patch: { shopAvailable: checked } })}
                      aria-label={`${item.name}商店状态`}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CreateEquipmentDialog open={createOpen} onOpenChange={setCreateOpen} />
    </Card>
  );
}

function CreateEquipmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    slug: "",
    name: "",
    description: "",
    slot: "top",
    rarity: "common",
    assetKey: "",
    shopAvailable: false,
    isActive: false,
  });
  const mutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/equipment/items", { ...form, description: form.description || null })).json(),
    onSuccess: async () => {
      await invalidateEquipmentQueries();
      onOpenChange(false);
      setForm({
        slug: "",
        name: "",
        description: "",
        slot: "top",
        rarity: "common",
        assetKey: "",
        shopAvailable: false,
        isActive: false,
      });
      toast({ title: "装备已创建", description: "现在可以把它加入装备池。" });
    },
    onError: (error) => toast({ title: "装备没有创建", description: describeError(error), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>新增装备</DialogTitle><DialogDescription>只登记已批准或待发布的正式素材键，不会在后台生成替代图形。</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="名称"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="英文标识"><Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} placeholder="linen-jacket" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="槽位">
              <Select value={form.slot} onValueChange={(slot) => setForm({ ...form, slot })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(SLOT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="稀有度">
              <Select value={form.rarity} onValueChange={(rarity) => setForm({ ...form, rarity })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="common">普通</SelectItem><SelectItem value="rare">稀有</SelectItem></SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="正式素材键"><Input value={form.assetKey} onChange={(event) => setForm({ ...form, assetKey: event.target.value })} placeholder="equipment/v1/top/linen-jacket.webp" /></Field>
          <Field label="说明"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button onClick={() => mutation.mutate()} disabled={!form.name || !form.slug || !form.assetKey || mutation.isPending}>创建装备</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EquipmentPools({ canWrite, pools, items, sources }: { canWrite: boolean; pools: EquipmentPool[]; items: EquipmentItem[]; sources: EquipmentSources }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<EquipmentPool | null>(null);
  const toggleMutation = useMutation({
    mutationFn: async (pool: EquipmentPool) => (await apiRequest("PATCH", `/api/admin/equipment/pools/${pool.id}`, { isActive: !pool.isActive })).json(),
    onSuccess: async () => {
      await invalidateEquipmentQueries();
      toast({ title: "装备池状态已更新" });
    },
    onError: (error) => toast({ title: "装备池没有更新", description: describeError(error), variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div><CardTitle>地点与任务装备池</CardTitle><CardDescription>每个池只能绑定一个真实地点或旧阿浪任务；盲盒活动在同一地点共享装备池。</CardDescription></div>
        {canWrite && <Button onClick={() => setCreateOpen(true)} data-testid="button-add-equipment-pool"><Plus className="mr-2 h-4 w-4" />新增装备池</Button>}
      </CardHeader>
      <CardContent>
        {pools.length === 0 ? (
          <FlashEmptyState title="还没有装备池" description="创建装备池并绑定地点或旧阿浪任务，然后配置单品权重。" icon={Store} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pools.map((pool) => (
              <div key={pool.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold">{pool.name}</p><p className="mt-1 text-xs text-muted-foreground">{pool.venueName ? `地点：${pool.venueName}` : `旧阿浪任务：${pool.alangMissionTitle || "未命名"}`}</p></div>
                  <Switch checked={pool.isActive} disabled={!canWrite || toggleMutation.isPending} onCheckedChange={() => toggleMutation.mutate(pool)} aria-label={`${pool.name}启用状态`} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {pool.items.length === 0 ? <Badge variant="outline">尚未配置单品</Badge> : pool.items.map((item) => <Badge key={item.itemId} variant={item.itemRarity === "rare" ? "default" : "secondary"}>{item.itemName} · {item.weight}</Badge>)}
                </div>
                {canWrite && <Button className="mt-4" variant="outline" size="sm" onClick={() => setEditing(pool)} data-testid={`button-edit-equipment-pool-${pool.id}`}>配置单品与权重</Button>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <CreatePoolDialog open={createOpen} onOpenChange={setCreateOpen} sources={sources} />
      <PoolItemsDialog pool={editing} onOpenChange={(open) => !open && setEditing(null)} items={items} />
    </Card>
  );
}

function CreatePoolDialog({ open, onOpenChange, sources }: { open: boolean; onOpenChange: (open: boolean) => void; sources: EquipmentSources }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [source, setSource] = useState("");
  const mutation = useMutation({
    mutationFn: async () => {
      const [kind, id] = source.split(":");
      return (await apiRequest("POST", "/api/admin/equipment/pools", {
        name,
        slug,
        venueId: kind === "venue" ? id : null,
        alangMissionId: kind === "mission" ? id : null,
        isActive: false,
      })).json();
    },
    onSuccess: async () => {
      await invalidateEquipmentQueries();
      onOpenChange(false);
      setName("");
      setSlug("");
      setSource("");
      toast({ title: "装备池草稿已创建", description: "配置 4 件普通与 2 件稀有单品后再启用。" });
    },
    onError: (error) => toast({ title: "装备池没有创建", description: describeError(error), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>新增装备池</DialogTitle><DialogDescription>一个地点或旧阿浪任务只能绑定一个装备池。</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label="装备池名称"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
          <Field label="英文标识"><Input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} placeholder="nanshan-cafe-v1" /></Field>
          <Field label="奖励来源">
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue placeholder="选择地点或旧阿浪任务" /></SelectTrigger>
              <SelectContent>
                {sources.venues.map((venue) => <SelectItem key={`venue:${venue.id}`} value={`venue:${venue.id}`}>{venue.name} · {venue.area}</SelectItem>)}
                {sources.missions.map((mission) => <SelectItem key={`mission:${mission.id}`} value={`mission:${mission.id}`}>旧阿浪任务 · {mission.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button onClick={() => mutation.mutate()} disabled={!name || !slug || !source || mutation.isPending}>创建装备池</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PoolItemsDialog({ pool, onOpenChange, items }: { pool: EquipmentPool | null; onOpenChange: (open: boolean) => void; items: EquipmentItem[] }) {
  const { toast } = useToast();
  const initialWeights = useMemo(() => Object.fromEntries((pool?.items ?? []).map((item) => [item.itemId, item.weight])), [pool]);
  const [weights, setWeights] = useState<Record<string, number>>(initialWeights);
  useEffect(() => setWeights(initialWeights), [initialWeights]);
  const effectiveWeights = weights;
  const mutation = useMutation({
    mutationFn: async () => apiRequest("PUT", `/api/admin/equipment/pools/${pool!.id}/items`, {
      items: Object.entries(effectiveWeights).filter(([, weight]) => weight > 0).map(([itemId, weight]) => ({ itemId, weight, isActive: true })),
    }),
    onSuccess: async () => {
      await invalidateEquipmentQueries();
      onOpenChange(false);
      toast({ title: "装备池配置已保存" });
    },
    onError: (error) => toast({ title: "装备池配置没有保存", description: describeError(error), variant: "destructive" }),
  });

  return (
    <Dialog open={!!pool} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>配置「{pool?.name}」</DialogTitle><DialogDescription>权重填 0 表示不放入本池。建议每池 4 件普通、2 件稀有，并以 80/20 的总权重比例校准。</DialogDescription></DialogHeader>
        <div className="grid gap-2 py-2 sm:grid-cols-2">
          {items.filter((item) => item.isActive).map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{SLOT_LABELS[item.slot]} · {RARITY_LABELS[item.rarity]}</p></div>
              <Input
                className="w-20"
                type="number"
                min={0}
                max={10000}
                value={effectiveWeights[item.id] ?? 0}
                onChange={(event) => setWeights({ ...effectiveWeights, [item.id]: Math.max(0, Number(event.target.value) || 0) })}
                aria-label={`${item.name}权重`}
              />
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button onClick={() => mutation.mutate()} disabled={mutation.isPending}><Save className="mr-2 h-4 w-4" />保存配置</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RewardActivity({ entries, loading }: { entries: RewardEntry[]; loading: boolean }) {
  if (loading) return <FlashListSkeleton />;
  if (entries.length === 0) return <FlashEmptyState title="还没有真实奖励流水" description="用户完成符合条件的真实盲盒活动或旧阿浪任务后，抽取资格会显示在这里。" icon={Gift} />;
  return (
    <Card>
      <CardHeader><CardTitle>最近 50 条奖励流水</CardTitle><CardDescription>只展示系统生成的资格和领取结果，不包含人工发奖入口。</CardDescription></CardHeader>
      <CardContent className="space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{entry.poolName}</p>
                <Badge variant="outline">{entry.sourceType === "blind_box" ? "盲盒活动" : "旧阿浪任务"}</Badge>
                <Badge variant={entry.status === "resolved" ? "secondary" : "default"}>{entry.status === "resolved" ? "已领取" : "待领取"}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                创建 {fmtDateTimeShort(entry.createdAt)}
                {entry.resolvedAt ? ` · 领取 ${fmtDateTimeShort(entry.resolvedAt)}` : ""}
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              {entry.status === "pending" ? "等待用户主动领取" : entry.resultKind === "new" ? "获得新装备" : `重复装备 · +${entry.fragmentsAwarded} 碎片`}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
