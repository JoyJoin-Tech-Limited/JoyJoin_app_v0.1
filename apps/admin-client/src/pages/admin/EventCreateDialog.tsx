import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/ui/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface PoolOption {
  id: string;
  title: string;
  city: string;
  district: string | null;
  eventType: string;
  dateTime: string;
  status: string;
  minGroupSize: number;
  maxGroupSize: number;
}

interface EventCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pools: PoolOption[];
  formatDateTime: (dateTimeStr: string) => string;
  budgetOptions: Array<{ value: string; label: string }>;
  languageOptions: Array<{ value: string; label: string }>;
  tasteIntensityOptions: Array<{ value: string; label: string }>;
  cuisineOptions: Array<{ value: string; label: string }>;
}

const createEventSchema = z.object({
  poolId: z.string().min(1, "请选择所属活动池"),
  title: z.string().min(1, "活动标题不能为空"),
  minGroupSize: z.coerce.number().min(2, "至少 2 人").max(12, "最多 12 人"),
  maxGroupSize: z.coerce.number().min(2, "至少 2 人").max(12, "最多 12 人"),
  budgetTier: z.string().min(1, "请选择预算"),
  selectedLanguages: z.array(z.string()).optional().default([]),
  selectedTasteIntensity: z.array(z.string()).optional().default([]),
  selectedCuisines: z.array(z.string()).optional().default([]),
  autoMatch: z.boolean().default(true),
});

export default function EventCreateDialog({
  open,
  onOpenChange,
  pools,
  formatDateTime,
  budgetOptions,
  languageOptions,
  tasteIntensityOptions,
  cuisineOptions,
}: EventCreateDialogProps) {
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      poolId: "",
      title: "",
      minGroupSize: 4,
      maxGroupSize: 6,
      budgetTier: "",
      selectedLanguages: [],
      selectedTasteIntensity: [],
      selectedCuisines: [],
      autoMatch: false,
    },
  });

  const selectedPoolId = form.watch("poolId");
  const selectedPoolForForm = useMemo(
    () => pools.find((p) => p.id === selectedPoolId) || null,
    [pools, selectedPoolId],
  );

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
      return await apiRequest("POST", "/api/admin/blind-box-events", data);
    } catch (err) {
      console.error(err);
      throw err;
    }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      onOpenChange(false);
      form.reset();
      toast({
        title: "创建成功",
        description: "盲盒活动已创建，可在列表中查看并后续匹配。",
      });
    },
    onError: (error: any) => {
      console.error("[AdminEvents] Failed to create blind-box event:", error);
      toast({
        title: "创建失败",
        description:
          error?.message || "无法创建盲盒活动，请检查参数或稍后重试",
        variant: "destructive",
      });
    },
  });

  const onSubmitCreateEvent = (data: any) => {
    const pool = pools.find((p) => p.id === data.poolId);

    const payload: any = {
      poolId: data.poolId,
      title: data.title,
      minGroupSize: Number(data.minGroupSize) || 4,
      maxGroupSize: Number(data.maxGroupSize) || 6,
      budgetTier: data.budgetTier,
      autoMatch: !!data.autoMatch,
      selectedLanguages: data.selectedLanguages ?? [],
      selectedTasteIntensity: data.selectedTasteIntensity ?? [],
      selectedCuisines: data.selectedCuisines ?? [],
    };


    if (pool) {
      payload.eventType = pool.eventType;
      payload.city = pool.city;
      payload.district = pool.district;
      payload.dateTime = pool.dateTime;
    }

    createEventMutation.mutate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-event">
          <PlusCircle className="mr-2 h-4 w-4" />
          创建盲盒活动（桌）
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>创建新的盲盒活动</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmitCreateEvent)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="poolId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>所属活动池 *</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        const pool = pools.find((p) => p.id === value);
                        if (pool) {
                          if (!form.getValues("title")) {
                            form.setValue("title", `${pool.title} 第1桌`);
                          }
                          if (typeof pool.minGroupSize === "number") {
                            form.setValue("minGroupSize", pool.minGroupSize);
                          }
                          if (typeof pool.maxGroupSize === "number") {
                            form.setValue("maxGroupSize", pool.maxGroupSize);
                          }
                        }
                      }}
                    >
                      <SelectTrigger data-testid="select-pool">
                        <SelectValue placeholder="选择所属活动池" />
                      </SelectTrigger>
                      <SelectContent>
                        {pools.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title} · {p.city}
                            {p.district ? `·${p.district}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedPoolForForm && (
              <div className="rounded-md border p-3 text-xs text-muted-foreground space-y-1">
                <div>
                  继承池子：
                  <span className="font-medium text-foreground">
                    {selectedPoolForForm.title}
                  </span>
                </div>
                <div>
                  城市 / 区域：{selectedPoolForForm.city}
                  {selectedPoolForForm.district
                    ? ` · ${selectedPoolForForm.district}`
                    : ""}
                </div>
                <div>活动类型：{selectedPoolForForm.eventType}</div>
                <div>
                  推荐时间：{formatDateTime(selectedPoolForForm.dateTime)}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="budgetTier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>预算区间 *</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger data-testid="select-budget">
                        <SelectValue placeholder="选择本桌人均预算" />
                      </SelectTrigger>
                      <SelectContent>
                        {budgetOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>活动标题 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例如：海底捞暖心局 第1桌"
                      {...field}
                      data-testid="input-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minGroupSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最小人数 *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={2}
                        max={12}
                        {...field}
                        data-testid="input-min-size"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxGroupSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>最大人数 *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={2}
                        max={12}
                        {...field}
                        data-testid="input-max-size"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="selectedLanguages"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>语言偏好（可选）</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {languageOptions.map((opt) => {
                      const selected =
                        (field.value as string[] | undefined) ?? [];
                      const checked = selected.includes(opt.value);
                      return (
                        <div
                          key={opt.value}
                          className="flex items-center space-x-1 border rounded-full px-3 py-1 text-xs"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(isChecked) => {
                              const current =
                                (field.value as string[] | undefined) ?? [];
                              const next = isChecked
                                ? [...current, opt.value]
                                : current.filter((v) => v !== opt.value);
                              field.onChange(next);
                            }}
                          />
                          <span>{opt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="selectedTasteIntensity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>口味强度偏好（可选）</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {tasteIntensityOptions.map((opt) => {
                      const selected =
                        (field.value as string[] | undefined) ?? [];
                      const checked = selected.includes(opt.value);
                      return (
                        <div
                          key={opt.value}
                          className="flex items-center space-x-1 border rounded-full px-3 py-1 text-xs"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(isChecked) => {
                              const current =
                                (field.value as string[] | undefined) ?? [];
                              const next = isChecked
                                ? [...current, opt.value]
                                : current.filter((v) => v !== opt.value);
                              field.onChange(next);
                            }}
                          />
                          <span>{opt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="selectedCuisines"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>菜系偏好（可选）</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {cuisineOptions.map((opt) => {
                      const selected =
                        (field.value as string[] | undefined) ?? [];
                      const checked = selected.includes(opt.value);
                      return (
                        <div
                          key={opt.value}
                          className="flex items-center space-x-1 border rounded-full px-3 py-1 text-xs"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(isChecked) => {
                              const current =
                                (field.value as string[] | undefined) ?? [];
                              const next = isChecked
                                ? [...current, opt.value]
                                : current.filter((v) => v !== opt.value);
                              field.onChange(next);
                            }}
                          />
                          <span>{opt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="autoMatch"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>自动匹配模式</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      开启后，可以在匹配页面一键从池子中按偏好/人数匹配用户。
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      关闭时，管理员需手动触发匹配；建议先人工审核报名后再开启自动匹配
                    </p>
                  </div>
                  <FormControl>
                    <Input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      data-testid="input-auto-match"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createEventMutation.isPending}
                data-testid="button-submit-event"
              >
                {createEventMutation.isPending
                  ? "创建中..."
                  : "创建盲盒活动"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
