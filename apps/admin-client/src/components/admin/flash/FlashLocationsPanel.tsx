import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Edit3, Info, MapPinned, Plus, Store } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import MapPicker from "@/components/discover/MapPicker";
import { useToast } from "@/hooks/ui/use-toast";
import {
  type FlashEncounterLocation,
  type FlashNpc,
  type FlashTaskDestination,
  formatEligibleWeekdays,
  getNpcIds,
  parseCommaList,
  unpackFlashCollection,
} from "@/lib/flashAdmin";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  type FlashCollectionResponse,
  FlashActiveBadge,
  FlashFormField,
  FlashWriteHint,
  SHENZHEN_DISTRICTS,
  WEEKDAY_OPTIONS,
  describeFlashAdminError,
  flashApprovalLabel,
  flashApprovalVariant,
} from "./FlashCatalogShared";
import { FlashEmptyState, FlashErrorState, FlashListSkeleton } from "./FlashQueryState";
import {
  FLASH_LOCATION_OPERATIONS_NOTICE,
  FLASH_LOCATION_PRESETS,
  isFlashLocationPresetFulfilled,
  type FlashLocationPreset,
} from "./flashLocationPresets";

const locationSchema = z.object({
  name: z.string().trim().min(1, "请输入地点名称").max(50, "地点名称过长"),
  district: z.string().min(1, "请选择行政区"),
  address: z.string().trim().min(4, "请输入完整地址").max(120, "地址过长"),
  latitude: z.number().min(22.35, "坐标需位于深圳").max(22.95, "坐标需位于深圳"),
  longitude: z.number().min(113.7, "坐标需位于深圳").max(114.75, "坐标需位于深圳"),
  approvalStatus: z.enum(["draft", "approved", "rejected"]),
  safetyNotes: z.string().trim().max(200, "安全备注请控制在 200 个字内"),
  npcIds: z.array(z.string()),
  tags: z.string(),
  availabilityWeekdays: z.array(z.number().int().min(1).max(7)).min(1, "至少选择一个可用星期"),
  availabilityStartTime: z.string().regex(/^\d{2}:\d{2}$/, "请输入开始时间"),
  availabilityEndTime: z.string().regex(/^\d{2}:\d{2}$/, "请输入结束时间"),
}).superRefine((value, context) => {
  const start = Number(value.availabilityStartTime.slice(0, 2)) * 60 + Number(value.availabilityStartTime.slice(3));
  const end = Number(value.availabilityEndTime.slice(0, 2)) * 60 + Number(value.availabilityEndTime.slice(3));
  if (start < 9 * 60 || end > 21 * 60 || start >= end) {
    context.addIssue({ code: "custom", path: ["availabilityEndTime"], message: "可用时间需在 09:00–21:00 内，且结束晚于开始" });
  }
});

type LocationFormValues = z.infer<typeof locationSchema>;
type LocationKind = "encounter" | "destination";

export function FlashLocationsPanel({
  canWrite,
  kind,
  npcs,
}: {
  canWrite: boolean;
  kind: LocationKind;
  npcs: FlashNpc[];
}) {
  const isEncounter = kind === "encounter";
  const endpoint = isEncounter ? "/api/admin/alang/encounter-locations" : "/api/admin/alang/task-destinations";
  const { toast } = useToast();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FlashEncounterLocation | FlashTaskDestination | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<FlashLocationPreset | null>(null);
  const [pendingToggle, setPendingToggle] = useState<FlashEncounterLocation | FlashTaskDestination | null>(null);
  const query = useQuery<FlashCollectionResponse<FlashEncounterLocation | FlashTaskDestination>>({ queryKey: [endpoint] });
  const items = unpackFlashCollection(query.data);
  const existingLocationNames = new Set(items.map((item) => item.name));

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: unknown }) => {
      const response = await apiRequest(id ? "PATCH" : "POST", id ? `${endpoint}/${id}` : endpoint, payload);
      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
      setEditorOpen(false);
      setEditing(null);
      toast({ title: isEncounter ? "闪现地点已保存" : "任务目的地已保存", description: "只有通过人工审核且处于可用状态的地点会进入随机池。" });
    },
    onError: (error) => toast({ title: "地点没保存", description: describeFlashAdminError(error), variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async (item: FlashEncounterLocation | FlashTaskDestination) => {
      const response = await apiRequest("PATCH", `${endpoint}/${item.id}`, { isActive: !item.isActive });
      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [endpoint] });
      setPendingToggle(null);
      toast({ title: "地点状态已更新" });
    },
    onError: (error) => toast({ title: "状态没更新", description: describeFlashAdminError(error), variant: "destructive" }),
  });

  if (query.isLoading) return <FlashListSkeleton />;
  if (query.isError) return <FlashErrorState message={describeFlashAdminError(query.error)} onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FlashWriteHint canWrite={canWrite} />
        {canWrite && (
          <Button
            onClick={() => { setEditing(null); setSelectedPreset(null); setEditorOpen(true); }}
            data-testid={`button-add-flash-${kind}`}
            className="shrink-0"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {isEncounter ? "新增闪现地点" : "新增任务目的地"}
          </Button>
        )}
      </div>

      {items.length === 0 && !isEncounter ? (
        <FlashEmptyState
          title={isEncounter ? "还没有闪现地点" : "还没有任务目的地"}
          description={isEncounter ? "添加并审核安全地点后，NPC 才能参与随机排班。" : "目的地需人工审核，且任务必须无需消费也能完成。"}
          icon={isEncounter ? MapPinned : Store}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{item.name}</CardTitle>
                      <Badge variant={flashApprovalVariant(item.approvalStatus)}>{flashApprovalLabel(item.approvalStatus)}</Badge>
                      <FlashActiveBadge active={item.isActive} />
                    </div>
                    <CardDescription className="mt-2">{item.district} · {item.address}</CardDescription>
                  </div>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`编辑${item.name}`}
                      onClick={() => { setEditing(item); setSelectedPreset(null); setEditorOpen(true); }}
                      data-testid={`button-edit-flash-${kind}-${item.id}`}
                    >
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="font-mono text-xs text-muted-foreground">
                  GCJ-02 · {Number(item.latitude).toFixed(6)}, {Number(item.longitude).toFixed(6)}
                </div>
                {item.safetyNotes && <p className="rounded-lg bg-muted/50 p-3 text-muted-foreground">安全备注：{item.safetyNotes}</p>}
                {isEncounter && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      可用：{formatEligibleWeekdays((item as FlashEncounterLocation).availabilityWindows?.map((window) => window.weekday) ?? []) || "未设置"}
                      {(item as FlashEncounterLocation).availabilityWindows?.[0]
                        ? ` · ${(item as FlashEncounterLocation).availabilityWindows[0].startTime}–${(item as FlashEncounterLocation).availabilityWindows[0].endTime}`
                        : ""}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {getNpcIds(item as FlashEncounterLocation).length === 0 ? (
                      <span className="text-destructive">尚未关联 NPC（不会进入排班）</span>
                      ) : getNpcIds(item as FlashEncounterLocation).map((id) => (
                        <Badge key={id} variant="outline">{npcs.find((npc) => npc.id === id)?.name || "未知 NPC"}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {!isEncounter && (item as FlashTaskDestination).tags?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {(item as FlashTaskDestination).tags!.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                  </div>
                ) : null}
                {canWrite && (
                  <Button variant="outline" size="sm" onClick={() => setPendingToggle(item)}>
                    {item.isActive ? "从随机池撤下" : "恢复到随机池"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {isEncounter && FLASH_LOCATION_PRESETS
            .filter((preset) => !isFlashLocationPresetFulfilled(preset, existingLocationNames))
            .map((preset) => (
            <Card key={preset.code} className="border-dashed border-primary/30 bg-primary/[0.03]">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base">{preset.name}</CardTitle>
                      <Badge variant="secondary">待地图选点</Badge>
                    </div>
                    <CardDescription className="mt-2">{preset.district} · {preset.addressHint}</CardDescription>
                  </div>
                  {canWrite && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`完善${preset.name}`}
                      onClick={() => {
                        setEditing(null);
                        setSelectedPreset(preset);
                        setEditorOpen(true);
                      }}
                      data-testid={`button-complete-flash-location-${preset.code}`}
                    >
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="rounded-lg bg-muted/50 p-3 text-muted-foreground">安全备注：{preset.safetyNotes}</p>
                <div className="flex flex-wrap gap-1.5">
                  {preset.npcSlugs.map((slug) => (
                    <Badge key={slug} variant="outline">
                      {npcs.find((npc) => npc.slug === slug)?.name || slug}
                    </Badge>
                  ))}
                </div>
                {canWrite && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setSelectedPreset(preset);
                      setEditorOpen(true);
                    }}
                  >
                    完善地点资料
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isEncounter && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950">
          <p className="mb-2 flex items-center gap-2 font-medium">
            <Info className="h-4 w-4" aria-hidden="true" />
            运营注意事项
          </p>
          <ul className="space-y-1 pl-5 text-xs leading-5">
            {FLASH_LOCATION_OPERATIONS_NOTICE.map((notice) => <li key={notice} className="list-disc">{notice}</li>)}
          </ul>
        </div>
      )}

      <LocationEditorDialog
        open={editorOpen}
        item={editing}
        preset={selectedPreset}
        kind={kind}
        npcs={npcs}
        saving={saveMutation.isPending}
        onClose={() => { setEditorOpen(false); setEditing(null); setSelectedPreset(null); }}
        onSave={(values) => {
          const payload: Record<string, unknown> = {
            name: values.name,
            city: "深圳",
            district: values.district,
            address: values.address,
            latitude: values.latitude,
            longitude: values.longitude,
            approvalStatus: values.approvalStatus,
            safetyNotes: values.safetyNotes || null,
          };
          if (isEncounter) {
            payload.npcIds = values.npcIds;
            payload.availabilityWindows = [...values.availabilityWeekdays]
              .sort((a, b) => a - b)
              .map((weekday) => ({
                weekday,
                startTime: values.availabilityStartTime,
                endTime: values.availabilityEndTime,
              }));
          } else payload.tags = parseCommaList(values.tags);
          saveMutation.mutate({ id: editing?.id, payload });
        }}
      />

      <AlertDialog open={!!pendingToggle} onOpenChange={(open) => !open && setPendingToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingToggle?.isActive ? "确认从随机池撤下？" : "确认恢复到随机池？"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle?.isActive
                ? "撤下不会改动历史任务；未发布草案需要重新生成或人工调整。"
                : "只有已通过人工审核的地点才会实际参与随机。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>先不修改</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingToggle && toggleMutation.mutate(pendingToggle)}
              className={pendingToggle?.isActive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LocationEditorDialog({
  open,
  item,
  preset,
  kind,
  npcs,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  item: FlashEncounterLocation | FlashTaskDestination | null;
  preset: FlashLocationPreset | null;
  kind: LocationKind;
  npcs: FlashNpc[];
  saving: boolean;
  onClose: () => void;
  onSave: (values: LocationFormValues) => void;
}) {
  const [mapOpen, setMapOpen] = useState(false);
  const [presetMapConfirmed, setPresetMapConfirmed] = useState(false);
  const { register, handleSubmit, control, reset, setError, setValue, watch, formState: { errors } } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: {
      name: "",
      district: "",
      address: "",
      latitude: 22.5431,
      longitude: 114.0579,
      approvalStatus: "draft",
      safetyNotes: "",
      npcIds: [],
      tags: "",
      availabilityWeekdays: WEEKDAY_OPTIONS.map((option) => option.value),
      availabilityStartTime: "09:00",
      availabilityEndTime: "21:00",
    },
  });

  useEffect(() => {
    if (!open) return;
    setPresetMapConfirmed(!preset);
    reset({
      name: item?.name ?? preset?.name ?? "",
      district: item?.district ?? preset?.district ?? "",
      address: item?.address ?? preset?.addressHint ?? "",
      latitude: item?.latitude ?? 22.5431,
      longitude: item?.longitude ?? 114.0579,
      approvalStatus: item?.approvalStatus ?? "draft",
      safetyNotes: item?.safetyNotes ?? preset?.safetyNotes ?? "",
      npcIds: item && kind === "encounter"
        ? getNpcIds(item as FlashEncounterLocation)
        : preset
          ? npcs.filter((npc) => preset.npcSlugs.includes(npc.slug)).map((npc) => npc.id)
          : [],
      tags: item && kind === "destination"
        ? (item as FlashTaskDestination).tags?.join("，") ?? ""
        : preset?.tags.join("，") ?? "",
      availabilityWeekdays: item && kind === "encounter" && (item as FlashEncounterLocation).availabilityWindows?.length
        ? (item as FlashEncounterLocation).availabilityWindows.map((window) => window.weekday)
        : WEEKDAY_OPTIONS.map((option) => option.value),
      availabilityStartTime: item && kind === "encounter"
        ? (item as FlashEncounterLocation).availabilityWindows?.[0]?.startTime ?? "09:00"
        : "09:00",
      availabilityEndTime: item && kind === "encounter"
        ? (item as FlashEncounterLocation).availabilityWindows?.[0]?.endTime ?? "21:00"
        : "21:00",
    });
  }, [open, item, preset, kind, npcs, reset]);

  const lat = watch("latitude");
  const lng = watch("longitude");

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{item ? "编辑" : "新增"}{kind === "encounter" ? "闪现地点" : "任务目的地"}</DialogTitle>
            <DialogDescription>仅录入深圳、GCJ-02 坐标。地点与行政区分别管理，进入随机池前必须人工审核。</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => {
              if (preset && !presetMapConfirmed) {
                setError("address", { message: "请先打开腾讯地图，确认公共区域的准确坐标与地址" });
                return;
              }
              if (kind === "encounter" && values.approvalStatus === "approved" && values.npcIds.length === 0) {
                setError("npcIds", { message: "已审核地点至少关联一位 NPC；全选可作为通用地点" });
                return;
              }
              onSave(values);
            })}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FlashFormField label="地点名称" error={errors.name?.message}><Input {...register("name")} /></FlashFormField>
              <Controller
                name="district"
                control={control}
                render={({ field }) => (
                  <FlashFormField label="行政区" error={errors.district?.message}>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="选择深圳行政区" /></SelectTrigger>
                      <SelectContent>{SHENZHEN_DISTRICTS.map((district) => <SelectItem key={district} value={district}>{district}</SelectItem>)}</SelectContent>
                    </Select>
                  </FlashFormField>
                )}
              />
            </div>
            <FlashFormField label="详细地址" error={errors.address?.message}><Input {...register("address")} /></FlashFormField>
            {preset && !presetMapConfirmed && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                推荐模板不携带可直接上线的坐标。请点击“地图选点”，在公共街区、外围广场或商场公共空间中确认安全停留点。
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <FlashFormField label="纬度" error={errors.latitude?.message}><Input type="number" step="0.000001" {...register("latitude", { valueAsNumber: true })} /></FlashFormField>
              <FlashFormField label="经度" error={errors.longitude?.message}><Input type="number" step="0.000001" {...register("longitude", { valueAsNumber: true })} /></FlashFormField>
              <Button type="button" variant="outline" onClick={() => setMapOpen(true)} data-testid="button-open-flash-map">
                <MapPinned className="mr-2 h-4 w-4" aria-hidden="true" />地图选点
              </Button>
            </div>
            <Controller
              name="approvalStatus"
              control={control}
              render={({ field }) => (
                <FlashFormField label="人工审核状态" error={errors.approvalStatus?.message}>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">待审核</SelectItem>
                      <SelectItem value="approved">已审核</SelectItem>
                      <SelectItem value="rejected">已拒绝</SelectItem>
                    </SelectContent>
                  </Select>
                </FlashFormField>
              )}
            />
            <FlashFormField label="安全备注" error={errors.safetyNotes?.message}>
              <Textarea placeholder="例如：入口开阔、夜间照明、避免施工时段" {...register("safetyNotes")} />
            </FlashFormField>

            {kind === "encounter" ? (
              <div className="space-y-4">
                <Controller
                  name="availabilityWeekdays"
                  control={control}
                  render={({ field }) => (
                    <FlashFormField label="可用星期" hint="班次仍会按 NPC 固定上线日随机生成。" error={errors.availabilityWeekdays?.message}>
                      <div className="flex flex-wrap gap-2">
                        {WEEKDAY_OPTIONS.map((option) => {
                          const checked = field.value.includes(option.value);
                          return (
                            <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                              <Checkbox checked={checked} onCheckedChange={(next) => field.onChange(next ? [...field.value, option.value] : field.value.filter((day) => day !== option.value))} />
                              {option.label}
                            </label>
                          );
                        })}
                      </div>
                    </FlashFormField>
                  )}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FlashFormField label="可用开始时间" error={errors.availabilityStartTime?.message}>
                    <Input type="time" min="09:00" max="20:59" {...register("availabilityStartTime")} />
                  </FlashFormField>
                  <FlashFormField label="可用结束时间" error={errors.availabilityEndTime?.message}>
                    <Input type="time" min="09:01" max="21:00" {...register("availabilityEndTime")} />
                  </FlashFormField>
                </div>
                <Controller
                  name="npcIds"
                  control={control}
                  render={({ field }) => (
                    <FlashFormField
                      label="可在此出现的 NPC"
                      hint="必须显式关联；全选表示所有 NPC 都可在此出现。"
                      error={errors.npcIds?.message}
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        {npcs.map((npc) => {
                          const checked = field.value.includes(npc.id);
                          return (
                            <label key={npc.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
                              <Checkbox checked={checked} onCheckedChange={(next) => field.onChange(next ? [...field.value, npc.id] : field.value.filter((id) => id !== npc.id))} />
                              <span><span className="font-medium">{npc.name}</span><span className="block text-xs text-muted-foreground">{npc.species}</span></span>
                            </label>
                          );
                        })}
                      </div>
                    </FlashFormField>
                  )}
                />
              </div>
            ) : (
              <FlashFormField label="地点标签" hint="用逗号分隔，用于任务筛选，不写入用户公开文案。" error={errors.tags?.message}>
                <Input placeholder="安静，咖啡，城市观察" {...register("tags")} />
              </FlashFormField>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>取消</Button>
              <Button type="submit" loading={saving} data-testid="button-save-flash-location">保存地点</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <MapPicker
        open={mapOpen}
        onOpenChange={setMapOpen}
        initialCenter={{ lat: Number.isFinite(lat) ? lat : 22.5431, lng: Number.isFinite(lng) ? lng : 114.0579 }}
        onSelect={(location) => {
          setValue("address", location.address, { shouldValidate: true });
          setValue("latitude", location.lat, { shouldValidate: true });
          setValue("longitude", location.lng, { shouldValidate: true });
          setPresetMapConfirmed(true);
        }}
      />
    </>
  );
}

