import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getFlashTaskSeedByCode } from "@shared/alang/flashCatalog";
import { z } from "zod";
import { BookOpenCheck, Edit3, Plus, Search, ShieldCheck } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/ui/use-toast";
import {
  type FlashNpc,
  type FlashTaskDestination,
  type FlashTaskTemplate,
  formatFeedbackPromptLines,
  parseCommaList,
  parseFeedbackPromptLines,
  unpackFlashCollection,
} from "@/lib/flashAdmin";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  type FlashCollectionResponse,
  FlashActiveBadge,
  FlashFormField,
  FlashWriteHint,
  TASK_CATEGORIES,
  describeFlashAdminError,
} from "./FlashCatalogShared";
import { FlashEmptyState, FlashErrorState, FlashListSkeleton } from "./FlashQueryState";

const taskSchema = z.object({
  code: z.string().trim().min(2, "请输入任务编号").max(24).regex(/^[A-Za-z0-9_-]+$/, "编号只能使用字母、数字、下划线或短横线"),
  category: z.enum(TASK_CATEGORIES),
  title: z.string().trim().min(2, "请输入任务标题").max(30, "标题请控制在 30 个字内"),
  brief: z.string().trim().min(4, "请补充任务简介").max(80, "简介请控制在 80 个字内"),
  instructions: z.string().trim().min(6, "请写清完成方式").max(240, "完成方式请控制在 240 个字内"),
  dialogueIntro: z.string().trim().min(4, "请补充 NPC 开场白").max(120, "开场白请控制在 120 个字内"),
  feedbackPromptsText: z.string().trim().min(2, "至少填写一个反馈问题"),
  tagsText: z.string(),
  npcIds: z.array(z.string()).min(1, "至少选择一位 NPC"),
  destinationIds: z.array(z.string()),
  safetyLevel: z.enum(["L1", "L2"]),
  safetyNotes: z.string().trim().min(4, "请补充安全审核备注").max(240, "安全备注请控制在 240 个字内"),
  isHumanReviewed: z.boolean(),
}).superRefine((value, context) => {
  const result = parseFeedbackPromptLines(value.feedbackPromptsText);
  if (result.error) {
    context.addIssue({ code: "custom", path: ["feedbackPromptsText"], message: result.error });
  }
});

type TaskFormValues = z.infer<typeof taskSchema>;

export function FlashTaskTemplatesPanel({
  canWrite,
  npcs,
  destinations,
}: {
  canWrite: boolean;
  npcs: FlashNpc[];
  destinations: FlashTaskDestination[];
}) {
  const endpoint = "/api/admin/alang/task-templates";
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<FlashTaskTemplate | null>(null);
  const [pendingToggle, setPendingToggle] = useState<FlashTaskTemplate | null>(null);
  const [bulkReviewOpen, setBulkReviewOpen] = useState(false);
  const query = useQuery<FlashCollectionResponse<FlashTaskTemplate>>({ queryKey: [endpoint] });
  const templates = unpackFlashCollection(query.data);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return templates;
    return templates.filter((task) => [task.code, task.title, task.category, ...task.tags].join(" ").toLowerCase().includes(keyword));
  }, [search, templates]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: unknown }) => {
      const response = await apiRequest(id ? "PATCH" : "POST", id ? `${endpoint}/${id}` : endpoint, payload);
      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [endpoint] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/overview"] }),
      ]);
      setEditorOpen(false);
      setEditing(null);
      toast({ title: "任务模板已保存", description: "任务只会从人工审核库中抽取，不会在运行时生成。" });
    },
    onError: (error) => toast({ title: "任务没保存", description: describeFlashAdminError(error), variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async (task: FlashTaskTemplate) => {
      if (!task.isActive && !task.isHumanReviewed) throw new Error("请先完成人工审核，再启用任务。");
      const approvedDestinationIds = new Set(
        destinations.filter((item) => item.isActive && item.approvalStatus === "approved").map((item) => item.id),
      );
      const destinationFree = Boolean(getFlashTaskSeedByCode(task.code));
      if (!task.isActive && !destinationFree && !task.destinationIds?.some((id) => approvedDestinationIds.has(id))) {
        throw new Error("请先关联至少一个已审核且可用的任务目的地。");
      }
      const response = await apiRequest("PATCH", `${endpoint}/${task.id}`, {
        expectedContentVersion: task.contentVersion,
        isActive: !task.isActive,
      });
      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [endpoint] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/overview"] }),
      ]);
      setPendingToggle(null);
      toast({ title: "任务状态已更新" });
    },
    onError: (error) => toast({ title: "状态没更新", description: describeFlashAdminError(error), variant: "destructive" }),
  });

  const bulkReviewMutation = useMutation({
    mutationFn: async () => {
      const builtinTasks = templates.filter((task) => getFlashTaskSeedByCode(task.code));
      if (builtinTasks.length !== 30) {
        throw new Error(`正式任务数量异常：当前找到 ${builtinTasks.length}/30 条，请先初始化完整目录。`);
      }

      let approved = 0;
      for (const original of builtinTasks) {
        let current = original;
        const canonical = getFlashTaskSeedByCode(current.code);
        if (!canonical) continue;

        try {
          if (current.category !== canonical.category) {
            const normalizeResponse = await apiRequest("PATCH", `${endpoint}/${current.id}`, {
              expectedContentVersion: current.contentVersion,
              category: canonical.category,
            });
            current = await normalizeResponse.json();
          }

          if (!current.isHumanReviewed || !current.isActive) {
            const reviewResponse = await apiRequest("PATCH", `${endpoint}/${current.id}`, {
              expectedContentVersion: current.contentVersion,
              isHumanReviewed: true,
              isActive: true,
            });
            current = await reviewResponse.json();
          }
          approved += 1;
        } catch (error) {
          throw new Error(`${current.code}「${current.title}」未通过：${describeFlashAdminError(error)}`);
        }
      }
      return approved;
    },
    onSuccess: async (approved) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [endpoint] }),
        queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/overview"] }),
      ]);
      setBulkReviewOpen(false);
      toast({
        title: "正式任务已全部审核并启用",
        description: `${approved}/30 条任务已通过现有受审接口逐条核验。`,
      });
    },
    onError: (error) => {
      setBulkReviewOpen(false);
      toast({
        title: "批量审核在问题任务处停止",
        description: describeFlashAdminError(error),
        variant: "destructive",
      });
    },
  });

  if (query.isLoading) return <FlashListSkeleton />;
  if (query.isError) return <FlashErrorState message={describeFlashAdminError(query.error)} onRetry={() => query.refetch()} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
          <FlashWriteHint canWrite={canWrite} />
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索编号、标题、分类或标签"
              className="pl-9"
              data-testid="input-search-flash-tasks"
            />
          </div>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setBulkReviewOpen(true)}
              disabled={bulkReviewMutation.isPending || templates.length === 0}
              data-testid="button-review-all-flash-tasks"
            >
              <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
              {bulkReviewMutation.isPending ? "正在逐条审核…" : "审核并启用全部正式任务"}
            </Button>
            <Button onClick={() => { setEditing(null); setEditorOpen(true); }} data-testid="button-add-flash-task">
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />新增任务
            </Button>
          </div>
        )}
      </div>

      {templates.length === 0 ? (
        <FlashEmptyState title="任务库还是空的" description="正式版上线前至少录入并人工审核 30 个任务。" icon={BookOpenCheck} />
      ) : filtered.length === 0 ? (
        <FlashEmptyState title="没有找到相符任务" description="换个编号、标题或标签再找找。" icon={Search} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((task) => (
            <Card key={task.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono">{task.code}</Badge>
                      <Badge variant="secondary">{task.category}</Badge>
                      <Badge variant={task.isHumanReviewed ? "default" : "destructive"}>
                        {task.isHumanReviewed ? "人工已审" : "待人工审核"}
                      </Badge>
                      <FlashActiveBadge active={task.isActive} />
                    </div>
                    <CardTitle className="mt-3 text-base">{task.title}</CardTitle>
                    <CardDescription className="mt-1">{task.brief}</CardDescription>
                  </div>
                  {canWrite && (
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(task); setEditorOpen(true); }} aria-label={`编辑${task.title}`} data-testid={`button-edit-flash-task-${task.id}`}>
                      <Edit3 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="line-clamp-2 text-muted-foreground">{task.instructions}</p>
                <div className="flex flex-wrap gap-1.5">
                  {task.npcIds?.map((id) => <Badge key={id} variant="outline">{npcs.find((npc) => npc.id === id)?.name || "未知 NPC"}</Badge>)}
                  {task.tags.map((tag) => <Badge key={tag} variant="outline">#{tag}</Badge>)}
                </div>
                {task.npcCopies?.length ? (
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-foreground">运行时 NPC 话术（人工审核证据）</p>
                    {task.npcCopies.map((copy) => {
                      const npc = npcs.find((item) => item.id === copy.npcId);
                      return (
                        <div key={copy.npcId} className="rounded-md bg-background p-2 text-xs">
                          <p className="font-medium">{npc?.name ?? "未知 NPC"} · {npc?.species ?? "未知动物"}</p>
                          {npc?.personalitySummary && <p className="mt-1 text-muted-foreground">人设：{npc.personalitySummary}</p>}
                          <p className="mt-1"><span className="text-muted-foreground">委托：</span>{copy.requestCopy}</p>
                          <p className="mt-1"><span className="text-muted-foreground">交付：</span>{copy.deliveryCopy}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
                  <span>默认 {task.durationDays || 7} 天有效</span>
                  {canWrite && (
                    <Button variant="outline" size="sm" onClick={() => setPendingToggle(task)}>
                      {task.isActive ? "停用任务" : "启用任务"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <TaskEditorDialog
        open={editorOpen}
        task={editing}
        npcs={npcs}
        destinations={destinations}
        saving={saveMutation.isPending}
        onClose={() => { setEditorOpen(false); setEditing(null); }}
        onSave={(values) => saveMutation.mutate({
          id: editing?.id,
          payload: {
            ...(editing ? { expectedContentVersion: editing.contentVersion } : {}),
            code: values.code.toUpperCase(),
            category: values.category,
            title: values.title,
            brief: values.brief,
            instructions: values.instructions,
            dialogueIntro: values.dialogueIntro,
            feedbackPrompts: parseFeedbackPromptLines(values.feedbackPromptsText, editing?.feedbackPrompts).prompts,
            tags: parseCommaList(values.tagsText),
            durationDays: 7,
            baseWeight: 100,
            safetyLevel: values.safetyLevel,
            safetyNotes: values.safetyNotes,
            isHumanReviewed: values.isHumanReviewed,
            npcIds: values.npcIds,
            destinationIds: values.destinationIds,
          },
        })}
      />

      <AlertDialog open={!!pendingToggle} onOpenChange={(open) => !open && setPendingToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingToggle?.isActive ? "确认停用这个任务？" : "确认启用这个任务？"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle?.isActive
                ? "停用后不会再被抽取；用户已经接到的任务仍会按原规则保留。"
                : "启用后会进入随机任务池，服务端仍会检查人工审核与安全约束。"}
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

      <AlertDialog open={bulkReviewOpen} onOpenChange={(open) => !bulkReviewMutation.isPending && setBulkReviewOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认审核并启用全部 30 条正式任务？</AlertDialogTitle>
            <AlertDialogDescription>
              系统会先把旧任务分类纠正为正式六分类，再通过现有 Admin 接口逐条记录审核人、审核时间和审计日志。
              任意任务缺少 NPC、已审核目的地或安全条件时会立即停止，并明确显示问题任务；不会直接修改数据库绕过检查。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkReviewMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkReviewMutation.mutate()}
              disabled={bulkReviewMutation.isPending}
            >
              确认全部审核并启用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaskEditorDialog({
  open,
  task,
  npcs,
  destinations,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  task: FlashTaskTemplate | null;
  npcs: FlashNpc[];
  destinations: FlashTaskDestination[];
  saving: boolean;
  onClose: () => void;
  onSave: (values: TaskFormValues) => void;
}) {
  const { register, handleSubmit, control, reset, formState: { errors, dirtyFields } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      code: "",
      category: "城市出发",
      title: "",
      brief: "",
      instructions: "",
      dialogueIntro: "",
      feedbackPromptsText: "",
      tagsText: "",
      npcIds: [],
      destinationIds: [],
      safetyLevel: "L1",
      safetyNotes: "",
      isHumanReviewed: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      code: task?.code ?? "",
      category: (
        TASK_CATEGORIES.includes(task?.category as typeof TASK_CATEGORIES[number])
          ? task?.category
          : getFlashTaskSeedByCode(task?.code ?? "")?.category ?? "城市出发"
      ) as TaskFormValues["category"],
      title: task?.title ?? "",
      brief: task?.brief ?? "",
      instructions: task?.instructions ?? "",
      dialogueIntro: task?.dialogueIntro ?? "",
      feedbackPromptsText: task ? formatFeedbackPromptLines(task.feedbackPrompts) : "",
      tagsText: task?.tags.join("，") ?? "",
      npcIds: task?.npcIds ?? [],
      destinationIds: task?.destinationIds ?? [],
      safetyLevel: task?.safetyLevel ?? "L1",
      safetyNotes: task?.safetyNotes ?? "",
      isHumanReviewed: false,
    });
  }, [open, task, reset]);

  const hasUnsavedContentChanges = Object.keys(dirtyFields).some((key) => key !== "isHumanReviewed");
  const reviewDisabled = !task || hasUnsavedContentChanges;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{task ? "编辑任务模板" : "新增任务模板"}</DialogTitle>
          <DialogDescription>任务需符合 NPC 人设，并保证无需消费、拍照、接触陌生人或与店员互动也能完成。</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(onSave)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FlashFormField label="任务编号" error={errors.code?.message}><Input placeholder="T31" {...register("code")} /></FlashFormField>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <FlashFormField label="任务分类" error={errors.category?.message}>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TASK_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent>
                  </Select>
                </FlashFormField>
              )}
            />
          </div>
          <FlashFormField label="任务标题" error={errors.title?.message}><Input {...register("title")} /></FlashFormField>
          <FlashFormField label="一句话简介" error={errors.brief?.message}><Textarea {...register("brief")} /></FlashFormField>
          <FlashFormField label="完成方式" hint="写清楚到附近点击“我已到达”即可，是否进店由用户决定。" error={errors.instructions?.message}>
            <Textarea className="min-h-24" {...register("instructions")} />
          </FlashFormField>
          <FlashFormField label="NPC 开场白" hint="像真人说话，可少量使用颜文字；不要声称自己真的在现场等待。" error={errors.dialogueIntro?.message}>
            <Textarea {...register("dialogueIntro")} />
          </FlashFormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FlashFormField label="结构化反馈问题" hint="每行一题：问题｜选项1｜选项2；填写 1–2 题，每题 2–5 个选项。" error={errors.feedbackPromptsText?.message}>
              <Textarea placeholder={"这里最吸引你的是什么？｜氛围｜陈设｜位置\n你会想再来吗？｜会｜不确定｜不会"} {...register("feedbackPromptsText")} />
            </FlashFormField>
            <FlashFormField label="筛选标签" hint="用于人设与兴趣筛选，不展示内部机制。" error={errors.tagsText?.message}>
              <Textarea placeholder="安静，独处，城市观察" {...register("tagsText")} />
            </FlashFormField>
          </div>
          <Controller
            name="npcIds"
            control={control}
            render={({ field }) => (
              <FlashFormField label="适合发布该任务的 NPC" error={errors.npcIds?.message}>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {npcs.map((npc) => {
                    const checked = field.value.includes(npc.id);
                    return (
                      <label key={npc.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
                        <Checkbox checked={checked} onCheckedChange={(next) => field.onChange(next ? [...field.value, npc.id] : field.value.filter((id) => id !== npc.id))} />
                        <span>
                          <span className="font-medium">{npc.name}</span>
                          <span className="block text-xs text-muted-foreground">{npc.species}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{npc.personalitySummary}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </FlashFormField>
            )}
          />
          <Controller
            name="destinationIds"
            control={control}
            render={({ field }) => (
              <FlashFormField label="可选任务目的地" hint="可不选；需要到店附近的任务至少选择一个已审核目的地。">
                <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border p-2 sm:grid-cols-2">
                  {destinations.filter((item) => item.isActive && item.approvalStatus === "approved").map((destination) => {
                    const checked = field.value.includes(destination.id);
                    return (
                      <label key={destination.id} className="flex cursor-pointer items-start gap-3 rounded-lg p-2 text-sm hover:bg-muted/50">
                        <Checkbox checked={checked} onCheckedChange={(next) => field.onChange(next ? [...field.value, destination.id] : field.value.filter((id) => id !== destination.id))} />
                        <span><span className="font-medium">{destination.name}</span><span className="block text-xs text-muted-foreground">{destination.district}</span></span>
                      </label>
                    );
                  })}
                  {destinations.length === 0 && <p className="p-2 text-sm text-muted-foreground">请先添加任务目的地。</p>}
                </div>
              </FlashFormField>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Controller
              name="safetyLevel"
              control={control}
              render={({ field }) => (
                <FlashFormField label="安全等级" error={errors.safetyLevel?.message}>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L1">L1 · 常规低风险</SelectItem>
                      <SelectItem value="L2">L2 · 需额外提示</SelectItem>
                    </SelectContent>
                  </Select>
                </FlashFormField>
              )}
            />
            <FlashFormField label="安全审核备注" hint="说明无需消费、拍照、接触陌生人或进入私人区域。" error={errors.safetyNotes?.message}>
              <Textarea placeholder="到附近即可完成；无需消费、拍照或与任何人互动。" {...register("safetyNotes")} />
            </FlashFormField>
          </div>
          <div className="space-y-2 rounded-xl border bg-muted/30 p-4">
            <div>
              <p className="text-sm font-medium">各 NPC 最终话术预览</p>
              <p className="mt-1 text-xs text-muted-foreground">这里展示服务端已保存、运行时会实际使用的文案。修改任务后需先保存，再重新打开核对并审核。</p>
            </div>
            {task?.npcCopies?.length ? task.npcCopies.map((copy) => {
              const npc = npcs.find((item) => item.id === copy.npcId);
              return (
                <div key={copy.npcId} className="rounded-lg border bg-background p-3 text-sm">
                  <p className="font-medium">{npc?.name ?? "未知 NPC"} · {npc?.species ?? "未知动物"}</p>
                  {npc?.personalitySummary && <p className="mt-1 text-xs text-muted-foreground">人设：{npc.personalitySummary}</p>}
                  <p className="mt-2"><span className="text-muted-foreground">委托：</span>{copy.requestCopy}</p>
                  <p className="mt-1"><span className="text-muted-foreground">交付：</span>{copy.deliveryCopy}</p>
                </div>
              );
            }) : (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">先保存任务，服务端生成并保存各 NPC 话术后才能审核。</p>
            )}
          </div>
          <Controller
            name="isHumanReviewed"
            control={control}
            render={({ field }) => (
              <div className="flex items-start justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div>
                  <Label htmlFor="flash-task-reviewed" className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />人工审核完成
                  </Label>
                   <p className="mt-1 text-xs text-muted-foreground">
                     {reviewDisabled
                       ? (!task ? "先保存任务，再查看上方实际话术并审核。" : "内容有修改：请先保存，再重新打开核对实际话术。")
                       : "确认安全、隐私、无强制消费，并逐条核对上方 NPC 实际话术。"}
                   </p>
                 </div>
                 <Switch id="flash-task-reviewed" checked={field.value} onCheckedChange={field.onChange} disabled={reviewDisabled} />
              </div>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>取消</Button>
            <Button type="submit" loading={saving} data-testid="button-save-flash-task">保存任务</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
