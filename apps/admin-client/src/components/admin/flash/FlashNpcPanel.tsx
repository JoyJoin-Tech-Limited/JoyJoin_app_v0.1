import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Edit3, Plus, UserRound } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/ui/use-toast";
import { type FlashNpc, formatEligibleWeekdays, unpackFlashCollection } from "@/lib/flashAdmin";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  type FlashCollectionResponse,
  FlashActiveBadge,
  FlashFormField,
  FlashWriteHint,
  WEEKDAY_OPTIONS,
  describeFlashAdminError,
} from "./FlashCatalogShared";
import { FlashEmptyState, FlashErrorState, FlashListSkeleton } from "./FlashQueryState";

export function FlashNpcPanel({ canWrite, canSeed = false }: { canWrite: boolean; canSeed?: boolean }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<FlashNpc | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<FlashNpc | null>(null);
  const query = useQuery<FlashCollectionResponse<FlashNpc>>({ queryKey: ["/api/admin/alang/npcs"] });
  const npcs = unpackFlashCollection(query.data);

  const seedMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/alang/catalog/seed", {});
      return response.json().catch(() => null);
    },
    onSuccess: async (result: { npcCount?: number; taskCount?: number; encounterCount?: number; destinationCount?: number; approvedLocationCount?: number; draftLocationCount?: number } | null) => {
      await queryClient.invalidateQueries({
        predicate: (item) => String(item.queryKey[0] ?? "").startsWith("/api/admin/alang"),
      });
      toast({
        title: "正式目录已初始化",
        description: `已写入 ${result?.npcCount ?? 5} 位 NPC、${result?.taskCount ?? 30} 条待审任务、${result?.encounterCount ?? 20} 个遭遇点与 ${result?.destinationCount ?? 20} 个免消费目的地；${result?.approvedLocationCount ?? 0} 个地点已通过腾讯校验，${result?.draftLocationCount ?? 0} 个保持待审核停用。`,
      });
    },
    onError: (error) => toast({ title: "目录初始化失败", description: describeFlashAdminError(error), variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: unknown }) => {
      const response = await apiRequest("PATCH", `/api/admin/alang/npcs/${id}`, payload);
      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/npcs"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/overview"] }),
      ]);
      setEditing(null);
      toast({ title: "NPC 设定已保存", description: "后续草案会按新的上线日与文案生成。" });
    },
    onError: (error) => toast({ title: "NPC 没保存", description: describeFlashAdminError(error), variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async (payload: unknown) => {
      const response = await apiRequest("POST", "/api/admin/alang/npcs", payload);
      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/npcs"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/overview"] }),
      ]);
      setCreating(false);
      toast({ title: "NPC 草稿已创建", description: "关联已审核地点和任务后，再启用参与排班。" });
    },
    onError: (error) => toast({ title: "NPC 没创建", description: describeFlashAdminError(error), variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async (npc: FlashNpc) => {
      const response = await apiRequest("PATCH", `/api/admin/alang/npcs/${npc.id}`, { isActive: !npc.isActive });
      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/npcs"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/overview"] }),
      ]);
      setPendingToggle(null);
      toast({ title: "NPC 状态已更新" });
    },
    onError: (error) => toast({ title: "状态没更新", description: describeFlashAdminError(error), variant: "destructive" }),
  });

  if (query.isLoading) return <FlashListSkeleton />;
  if (query.isError) return <FlashErrorState message={describeFlashAdminError(query.error)} onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-4">
      <FlashWriteHint canWrite={canWrite} />
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)} data-testid="button-create-flash-npc">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            新增 NPC
          </Button>
        </div>
      )}
      {npcs.length === 0 ? (
        <div className="space-y-3">
          <FlashEmptyState title="还没有 NPC" description="先初始化正式目录，再录入并关联深圳地点。任务会保持待审核，不会自动上线。" icon={UserRound} />
          {canSeed && (
            <div className="flex justify-center">
              <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                {seedMutation.isPending ? "正在初始化…" : "初始化 NPC、任务与深圳地点"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {canSeed && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                {seedMutation.isPending ? "正在同步…" : "同步正式目录与深圳地点"}
              </Button>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {npcs.map((npc) => (
            <Card key={npc.id} className="overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: npc.themeColor || "#8B5CF6" }} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">{npc.name}</CardTitle>
                      <Badge variant="secondary">{npc.species}</Badge>
                      <FlashActiveBadge active={npc.isActive} />
                    </div>
                    <CardDescription className="mt-2">{npc.personalitySummary}</CardDescription>
                  </div>
                  {canWrite && (
                    <Button variant="ghost" size="icon" onClick={() => setEditing(npc)} aria-label={`编辑${npc.name}`} data-testid={`button-edit-npc-${npc.id}`}>
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-lg bg-muted/50 p-3 text-muted-foreground">“{npc.inviteLine}”</div>
                <div>
                  <span className="text-muted-foreground">固定上线日：</span>
                  <span className="font-medium">{formatEligibleWeekdays(npc.eligibleWeekdays) || "未设置"}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <span>1 班概率 <strong className="text-foreground">{npc.oneShiftProbability ?? 35}%</strong></span>
                  <span>2 班概率 <strong className="text-foreground">{npc.twoShiftProbability ?? 65}%</strong></span>
                  <span>班次时长 <strong className="text-foreground">{npc.minShiftMinutes ?? 180}–{npc.maxShiftMinutes ?? 300} 分钟</strong></span>
                  <span>最小间隔 <strong className="text-foreground">{npc.minGapMinutes ?? 90} 分钟</strong></span>
                </div>
                {canWrite && (
                  <Button
                    variant={npc.isActive ? "outline" : "secondary"}
                    size="sm"
                    onClick={() => setPendingToggle(npc)}
                    data-testid={`button-toggle-npc-${npc.id}`}
                  >
                    {npc.isActive ? "暂时停用" : "恢复使用"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          </div>
        </div>
      )}

      <NpcEditorDialog
        npc={editing}
        saving={saveMutation.isPending}
        onClose={() => setEditing(null)}
        onSave={(values) => editing && saveMutation.mutate({ id: editing.id, payload: values })}
      />
      <NpcCreateDialog
        open={creating}
        saving={createMutation.isPending}
        onClose={() => setCreating(false)}
        onSave={(values) => createMutation.mutate(values)}
      />

      <AlertDialog open={!!pendingToggle} onOpenChange={(open) => !open && setPendingToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingToggle?.isActive ? `暂时停用${pendingToggle.name}？` : `恢复${pendingToggle?.name}？`}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle?.isActive
                ? "停用后不会再为这位 NPC 生成新班次；已发布班次请单独检查或取消。"
                : "恢复后会从下一份随机草案开始参与排班。"}
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

const npcCreateSchema = z.object({
  slug: z.string().trim().min(2, "请输入至少 2 位英文标识").max(40).regex(/^[a-z0-9-]+$/, "仅支持小写字母、数字和短横线"),
  name: z.string().trim().min(1, "请输入名字").max(12, "名字请控制在 12 个字内"),
  species: z.string().trim().min(1, "请输入动物品种").max(20, "动物品种过长"),
  personalitySummary: z.string().trim().min(4, "请补充性格概述").max(160, "性格概述请控制在 160 个字内"),
  inviteLine: z.string().trim().min(4, "请补充邀请语").max(120, "邀请语请控制在 120 个字内"),
  voiceGuideText: z.string().trim().min(4, "至少填写一条角色设定要点"),
  dialoguePrompt: z.string().trim().min(2, "请填写互动问题").max(80, "互动问题请控制在 80 个字内"),
  dialogueOptionsText: z.string().trim().superRefine((value, context) => {
    const options = value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (options.length < 2 || options.length > 5) {
      context.addIssue({ code: "custom", message: "请按行填写 2–5 个选项" });
    }
  }),
  eligibleWeekdays: z.array(z.number().int().min(1).max(7)).min(1, "至少选择一个上线日"),
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "请输入 6 位 HEX 颜色"),
  sortOrder: z.number().int().min(0).max(99),
});

type NpcCreateValues = z.infer<typeof npcCreateSchema>;

function NpcCreateDialog({
  open,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: unknown) => void;
}) {
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<NpcCreateValues>({
    resolver: zodResolver(npcCreateSchema),
    defaultValues: {
      slug: "",
      name: "",
      species: "",
      personalitySummary: "",
      inviteLine: "",
      voiceGuideText: "",
      dialoguePrompt: "",
      dialogueOptionsText: "",
      eligibleWeekdays: [],
      themeColor: "#8B5CF6",
      sortOrder: 10,
    },
  });

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>新增数字动物 NPC</DialogTitle>
          <DialogDescription>创建后还需要关联已审核地点和任务；未来排班不会公开给用户。</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => {
            const voiceGuide = values.voiceGuideText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
            const optionLabels = values.dialogueOptionsText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
            onSave({
              slug: values.slug,
              name: values.name,
              species: values.species,
              personalitySummary: values.personalitySummary,
              inviteLine: values.inviteLine,
              voiceGuide,
              dialogueQuestions: [{
                id: "opening",
                prompt: values.dialoguePrompt,
                options: optionLabels.map((label, index) => ({
                  id: `option_${index + 1}`,
                  label,
                  tags: [],
                })),
              }],
              eligibleWeekdays: values.eligibleWeekdays,
              oneShiftProbability: 35,
              twoShiftProbability: 65,
              minShiftMinutes: 180,
              maxShiftMinutes: 300,
              minGapMinutes: 90,
              themeColor: values.themeColor,
              sortOrder: values.sortOrder,
              isActive: false,
            });
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FlashFormField label="英文标识" error={errors.slug?.message}>
              <Input placeholder="例如 red-panda" {...register("slug")} />
            </FlashFormField>
            <FlashFormField label="名字" error={errors.name?.message}>
              <Input {...register("name")} />
            </FlashFormField>
          </div>
          <FlashFormField label="动物品种" error={errors.species?.message}>
            <Input placeholder="例如 小熊猫" {...register("species")} />
          </FlashFormField>
          <FlashFormField label="性格概述" error={errors.personalitySummary?.message}>
            <Textarea {...register("personalitySummary")} />
          </FlashFormField>
          <FlashFormField label="自然邀请语" error={errors.inviteLine?.message}>
            <Textarea {...register("inviteLine")} />
          </FlashFormField>
          <FlashFormField label="角色设定要点（每行一条）" error={errors.voiceGuideText?.message}>
            <Textarea rows={4} placeholder={"内在动力：……\n表达方式：……\n禁区：……"} {...register("voiceGuideText")} />
          </FlashFormField>
          <FlashFormField label="首次互动问题" error={errors.dialoguePrompt?.message}>
            <Input {...register("dialoguePrompt")} />
          </FlashFormField>
          <FlashFormField label="互动选项（每行一个，2–5 个）" error={errors.dialogueOptionsText?.message}>
            <Textarea rows={4} {...register("dialogueOptionsText")} />
          </FlashFormField>
          <Controller
            name="eligibleWeekdays"
            control={control}
            render={({ field }) => (
              <FlashFormField label="固定上线日" error={errors.eligibleWeekdays?.message}>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((option) => {
                    const checked = field.value.includes(option.value);
                    return (
                      <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => field.onChange(
                            next
                              ? [...field.value, option.value]
                              : field.value.filter((day) => day !== option.value),
                          )}
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </FlashFormField>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FlashFormField label="主题色" error={errors.themeColor?.message}>
              <div className="flex gap-2">
                <Input type="color" className="w-14 p-1" {...register("themeColor")} />
                <Input {...register("themeColor")} />
              </div>
            </FlashFormField>
            <FlashFormField label="显示顺序" error={errors.sortOrder?.message}>
              <Input type="number" min={0} max={99} {...register("sortOrder", { valueAsNumber: true })} />
            </FlashFormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>取消</Button>
            <Button type="submit" loading={saving} data-testid="button-save-created-flash-npc">创建 NPC</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const npcSchema = z.object({
  name: z.string().trim().min(1, "请输入名字").max(12, "名字请控制在 12 个字内"),
  species: z.string().trim().min(1, "请输入动物品种").max(20, "动物品种过长"),
  personalitySummary: z.string().trim().min(4, "请补充性格概述").max(80, "性格概述请控制在 80 个字内"),
  inviteLine: z.string().trim().min(4, "请补充邀请语").max(80, "邀请语请控制在 80 个字内"),
  eligibleWeekdays: z.array(z.number().int().min(1).max(7)).min(1, "至少选择一个上线日"),
  oneShiftProbability: z.number().int().min(0).max(100),
  twoShiftProbability: z.number().int().min(0).max(100),
  minShiftMinutes: z.number().int().min(180, "不能少于 180 分钟").max(300),
  maxShiftMinutes: z.number().int().min(180).max(300, "不能超过 300 分钟"),
  minGapMinutes: z.number().int().min(90, "班次间隔至少 90 分钟").max(720),
  themeColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "请输入 6 位 HEX 颜色"),
  sortOrder: z.number().int().min(0).max(99),
}).superRefine((value, context) => {
  if (value.oneShiftProbability + value.twoShiftProbability !== 100) {
    context.addIssue({ code: "custom", path: ["twoShiftProbability"], message: "1 班与 2 班概率之和必须为 100%" });
  }
  if (value.maxShiftMinutes < value.minShiftMinutes) {
    context.addIssue({ code: "custom", path: ["maxShiftMinutes"], message: "最长时长不能短于最短时长" });
  }
});

type NpcFormValues = z.infer<typeof npcSchema>;

function NpcEditorDialog({
  npc,
  saving,
  onClose,
  onSave,
}: {
  npc: FlashNpc | null;
  saving: boolean;
  onClose: () => void;
  onSave: (values: NpcFormValues) => void;
}) {
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<NpcFormValues>({ resolver: zodResolver(npcSchema) });

  useEffect(() => {
    if (!npc) return;
    reset({
      name: npc.name,
      species: npc.species,
      personalitySummary: npc.personalitySummary,
      inviteLine: npc.inviteLine,
      eligibleWeekdays: npc.eligibleWeekdays,
      oneShiftProbability: npc.oneShiftProbability ?? 35,
      twoShiftProbability: npc.twoShiftProbability ?? 65,
      minShiftMinutes: npc.minShiftMinutes ?? 180,
      maxShiftMinutes: npc.maxShiftMinutes ?? 300,
      minGapMinutes: npc.minGapMinutes ?? 90,
      themeColor: npc.themeColor || "#8B5CF6",
      sortOrder: npc.sortOrder ?? 0,
    });
  }, [npc, reset]);

  return (
    <Dialog open={!!npc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>编辑 NPC 设定</DialogTitle>
          <DialogDescription>保持动物身份与既有人设一致；上线日固定，具体时段与地点由次日草案随机。</DialogDescription>
        </DialogHeader>
        {npc && (
          <form className="space-y-4" onSubmit={handleSubmit(onSave)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FlashFormField label="名字" error={errors.name?.message}><Input {...register("name")} /></FlashFormField>
              <FlashFormField label="动物品种" error={errors.species?.message}><Input {...register("species")} /></FlashFormField>
            </div>
            <FlashFormField label="性格概述" error={errors.personalitySummary?.message}><Textarea {...register("personalitySummary")} /></FlashFormField>
            <FlashFormField label="自然邀请语" error={errors.inviteLine?.message}><Textarea {...register("inviteLine")} /></FlashFormField>
            <Controller
              name="eligibleWeekdays"
              control={control}
              render={({ field }) => (
                <FlashFormField label="固定上线日" error={errors.eligibleWeekdays?.message}>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_OPTIONS.map((option) => {
                      const checked = field.value?.includes(option.value) ?? false;
                      return (
                        <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(next) => field.onChange(
                              next
                                ? [...(field.value ?? []), option.value]
                                : (field.value ?? []).filter((day) => day !== option.value),
                            )}
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                </FlashFormField>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FlashFormField label="1 班概率（%）" error={errors.oneShiftProbability?.message}>
                <Input type="number" min={0} max={100} {...register("oneShiftProbability", { valueAsNumber: true })} />
              </FlashFormField>
              <FlashFormField label="2 班概率（%）" error={errors.twoShiftProbability?.message}>
                <Input type="number" min={0} max={100} {...register("twoShiftProbability", { valueAsNumber: true })} />
              </FlashFormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FlashFormField label="最短班次（分钟）" error={errors.minShiftMinutes?.message}>
                <Input type="number" min={180} max={300} {...register("minShiftMinutes", { valueAsNumber: true })} />
              </FlashFormField>
              <FlashFormField label="最长班次（分钟）" error={errors.maxShiftMinutes?.message}>
                <Input type="number" min={180} max={300} {...register("maxShiftMinutes", { valueAsNumber: true })} />
              </FlashFormField>
              <FlashFormField label="最小间隔（分钟）" error={errors.minGapMinutes?.message}>
                <Input type="number" min={90} max={720} {...register("minGapMinutes", { valueAsNumber: true })} />
              </FlashFormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FlashFormField label="主题色" error={errors.themeColor?.message}>
                <div className="flex gap-2"><Input type="color" className="w-14 p-1" {...register("themeColor")} /><Input {...register("themeColor")} /></div>
              </FlashFormField>
              <FlashFormField label="显示顺序" error={errors.sortOrder?.message}>
                <Input type="number" min={0} max={99} {...register("sortOrder", { valueAsNumber: true })} />
              </FlashFormField>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>取消</Button>
              <Button type="submit" loading={saving} data-testid="button-save-flash-npc">保存设定</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
