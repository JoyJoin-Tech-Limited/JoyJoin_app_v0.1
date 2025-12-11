//my path:/Users/felixg/projects/JoyJoin3/client/src/pages/admin/AdminEventsPage.tsx
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Users,
  CheckCircle,
  Clock,
  MapPin,
  PlusCircle,
  Play,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// =============== 类型定义 ===============

interface EventCreator {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber?: string | null;
}

interface BlindBoxEvent {
  id: string;
  title: string;
  eventType: string;
  city: string;
  district: string;
  dateTime: string;
  status: string;
  currentParticipants: number;
  totalParticipants: number | null;
  restaurantName: string | null;
  restaurantAddress: string | null;
  isGirlsNight?: boolean;
  createdAt: string;
  updatedAt: string;
  poolId?: string | null;
  poolTitle?: string | null;
  creator?: EventCreator;

  // 预算 & 偏好字段（后端返回）
  budgetTier?: string | null;
  selectedLanguages?: string[] | null;
  selectedTasteIntensity?: string[] | null;
  selectedCuisines?: string[] | null;
}

interface EventPoolSummary {
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

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending_match: { label: "待匹配", variant: "secondary" },
  matched: { label: "已匹配", variant: "default" },
  completed: { label: "已完成", variant: "outline" },
  canceled: { label: "已取消", variant: "destructive" },
};

// 城市 -> 区域选项（保持和前台一致）
const CITY_DISTRICTS: Record<"深圳" | "香港", string[]> = {
  深圳: [
    "南山区",
    "福田区",
    "罗湖区",
    "宝安区",
    "龙华区",
    "龙岗区",
    "盐田区",
    "光明区",
    "坪山区",
    "大鹏新区",
  ],
  香港: [
    "中环",
    "湾仔",
    "尖沙咀",
    "铜锣湾",
    "观塘",
    "葵涌",
    "沙田",
    "将军澳",
    "荃湾",
    "元朗",
  ],
};

const languageOptions = [
  { value: "中文（国语）", label: "中文（国语）" },
  { value: "中文（粤语）", label: "中文（粤语）" },
  { value: "英语", label: "英语" },
];

const tasteIntensityOptions = [
  { value: "爱吃辣", label: "爱吃辣" },
  { value: "不辣/清淡为主", label: "不辣/清淡为主" },
];

const cuisineOptions = [
  { value: "中餐", label: "中餐" },
  { value: "川菜", label: "川菜" },
  { value: "粤菜", label: "粤菜" },
  { value: "火锅", label: "火锅" },
  { value: "烧烤", label: "烧烤" },
  { value: "西餐", label: "西餐" },
  { value: "日料", label: "日料" },
];

const budgetOptions = [
  { value: "100以下", label: "≤100" },
  { value: "100-200", label: "100-200" },
  { value: "200-300", label: "200-300" },
  { value: "300-500", label: "300-500" },
  { value: "500+", label: "500+" },
];

// 创建盲盒活动表单
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

// =============== 组件 ===============

type StatusFilter = "all" | "pending_match" | "matched" | "completed";
type CityFilter = "all" | "深圳" | "香港";
type EventTypeFilter = "all" | "饭局" | "酒局" | "其他";
type BudgetFilter = "all" | "100以下" | "100-200" | "200-300" | "300-500" | "500+";
type LanguageFilter = "all" | "中文（国语）" | "中文（粤语）" | "英语";
type TasteFilter = "all" | "爱吃辣" | "不辣/清淡为主";
type CuisineFilter =
  | "all"
  | "中餐"
  | "川菜"
  | "粤菜"
  | "火锅"
  | "烧烤"
  | "西餐"
  | "日料";

export default function AdminEventsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cityFilter, setCityFilter] = useState<CityFilter>("all");
  const [eventTypeFilter, setEventTypeFilter] =
    useState<EventTypeFilter>("all");
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>("all");
  const [languageFilter, setLanguageFilter] = useState<LanguageFilter>("all");
  const [tasteFilter, setTasteFilter] = useState<TasteFilter>("all");
  const [cuisineFilter, setCuisineFilter] = useState<CuisineFilter>("all");

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<BlindBoxEvent | null>(
    null,
  );
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const { toast } = useToast();

  // 盲盒活动列表
  const { data: events = [], isLoading: isLoadingEvents } =
    useQuery<BlindBoxEvent[]>({
      queryKey: ["/api/admin/events"],
    });

  // 活动池列表（用于创建盲盒活动时选择池子）
  const { data: pools = [] } = useQuery<EventPoolSummary[]>({
    queryKey: ["/api/admin/event-pools"],
  });

  // 创建活动表单
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
      autoMatch: true,
    },
  });

  const selectedPoolId = form.watch("poolId");
  const selectedPoolForForm = useMemo(
    () => pools.find((p) => p.id === selectedPoolId) || null,
    [pools, selectedPoolId],
  );

  // ====== Mutation：创建盲盒活动 ======
  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("[AdminEvents] creating blind-box event with payload:", data);
      // 注意：这里是 (method, url, body)
      return apiRequest("POST", "/api/admin/blind-box-events", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      setShowCreateDialog(false);
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

  // ====== Mutation：更新活动状态 ======
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      console.log("[AdminEvents] updating status", { id, status });
      return apiRequest("PATCH", `/api/admin/events/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      toast({ title: "状态更新成功", description: "盲盒活动状态已更新。" });
    },
    onError: (error: any) => {
      console.error("[AdminEvents] Failed to update status:", error);
      toast({
        title: "更新失败",
        description: error?.message || "无法更新活动状态，请重试",
        variant: "destructive",
      });
    },
  });

  const startMatchMutation = useMutation({
    mutationFn: async (id: string) => {
      console.log("[AdminEvents] manual start matching for event:", id);
      // 后端建议实现 POST /api/admin/events/:id/match 来触发一次匹配
      return apiRequest("POST", `/api/admin/events/${id}/match`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      toast({
        title: "已触发匹配",
        description: "已发送匹配请求，如已接好算法将开始从活动池中捞人。",
      });
    },
    onError: (error: any) => {
      console.error("[AdminEvents] Failed to trigger matching:", error);
      toast({
        title: "触发匹配失败",
        description:
          error?.message ||
          "无法触发匹配，请稍后重试或检查后端路由 /api/admin/events/:id/match",
        variant: "destructive",
      });
    },
  });

  const handleStartMatching = (eventId: string) => {
    if (
      confirm(
        "确定要为这个盲盒活动开始匹配吗？如果算法已接入，将从对应活动池中分配用户。"
      )
    ) {
      startMatchMutation.mutate(eventId);
    }
  };

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

    console.log("[AdminEvents] create form data:", data);
    console.log("[AdminEvents] create payload:", payload);

    if (pool) {
      payload.eventType = pool.eventType;
      payload.city = pool.city;
      payload.district = pool.district;
      payload.dateTime = pool.dateTime;
    }

    createEventMutation.mutate(payload);
  };

  const handleViewDetails = (event: BlindBoxEvent) => {
    setSelectedEvent(event);
    setShowDetailsDialog(true);
  };

  const handleStatusUpdate = (newStatus: string) => {
    if (!selectedEvent) return;
    updateStatusMutation.mutate({ id: selectedEvent.id, status: newStatus });
    setSelectedEvent({ ...selectedEvent, status: newStatus });
  };

  // ====== 衍生数据：统计 & 过滤 ======
  const totalEvents = events.length;
  const pendingCount = events.filter((e) => e.status === "pending_match").length;
  const matchedCount = events.filter((e) => e.status === "matched").length;
  const completedCount = events.filter((e) => e.status === "completed").length;

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;

      if (cityFilter !== "all" && e.city !== cityFilter) return false;

      if (eventTypeFilter !== "all" && e.eventType !== eventTypeFilter)
        return false;

      // 按预算筛选
      if (budgetFilter !== "all" && e.budgetTier !== budgetFilter) return false;

      // 按语言偏好筛选（活动要求该语言时才会显示）
      if (
        languageFilter !== "all" &&
        (!e.selectedLanguages || !e.selectedLanguages.includes(languageFilter))
      ) {
        return false;
      }

      // 按口味偏好筛选
      if (
        tasteFilter !== "all" &&
        (!e.selectedTasteIntensity ||
          !e.selectedTasteIntensity.includes(tasteFilter))
      ) {
        return false;
      }

      // 按菜系偏好筛选
      if (
        cuisineFilter !== "all" &&
        (!e.selectedCuisines || !e.selectedCuisines.includes(cuisineFilter))
      ) {
        return false;
      }

      return true;
    });
  }, [
    events,
    statusFilter,
    cityFilter,
    eventTypeFilter,
    budgetFilter,
    languageFilter,
    tasteFilter,
    cuisineFilter,
  ]);

  const formatDateTime = (dateTimeStr: string) => {
    try {
      const date = new Date(dateTimeStr);
      return format(date, "yyyy年MM月dd日 HH:mm", { locale: zhCN });
    } catch (e) {
      return dateTimeStr;
    }
  };

  const getCreatorName = (event: BlindBoxEvent) => {
    if (!event.creator) return "未知用户";
    const firstName = event.creator.firstName || "";
    const lastName = event.creator.lastName || "";
    return `${firstName} ${lastName}`.trim() || event.creator.email || "未知用户";
  };

  if (isLoadingEvents) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    加载中...
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 这里只是为了示例，如果之后想加“按区筛选”可以用这个
  const currentCityForDistrictSelect = (cityFilter === "all"
    ? "深圳"
    : cityFilter) as "深圳" | "香港";
  const currentCityDistricts =
    CITY_DISTRICTS[currentCityForDistrictSelect] ?? [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">盲盒活动管理</h1>
          <p className="text-muted-foreground text-sm">
            从活动池里“捞人”成局后，对应的一桌桌盲盒活动会出现在这里，你可以查看
            / 创建桌子、调整状态。
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
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
                            console.log("[AdminEvents] selected pool for event:", pool);
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
                          const selected = (field.value as string[] | undefined) ?? [];
                          const checked = selected.includes(opt.value);
                          return (
                            <div
                              key={opt.value}
                              className="flex items-center space-x-1 border rounded-full px-3 py-1 text-xs"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  const current = (field.value as string[] | undefined) ?? [];
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
                          const selected = (field.value as string[] | undefined) ?? [];
                          const checked = selected.includes(opt.value);
                          return (
                            <div
                              key={opt.value}
                              className="flex items-center space-x-1 border rounded-full px-3 py-1 text-xs"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  const current = (field.value as string[] | undefined) ?? [];
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
                          const selected = (field.value as string[] | undefined) ?? [];
                          const checked = selected.includes(opt.value);
                          return (
                            <div
                              key={opt.value}
                              className="flex items-center space-x-1 border rounded-full px-3 py-1 text-xs"
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(isChecked) => {
                                  const current = (field.value as string[] | undefined) ?? [];
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
                    onClick={() => setShowCreateDialog(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    disabled={createEventMutation.isPending}
                    data-testid="button-submit-event"
                  >
                    {createEventMutation.isPending ? "创建中..." : "创建盲盒活动"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-metric-total">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总活动数</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold"
              data-testid="text-total-events"
            >
              {totalEvents}
            </div>
            <p className="text-xs text-muted-foreground">所有盲盒活动</p>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-pending">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待匹配</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold"
              data-testid="text-pending-events"
            >
              {pendingCount}
            </div>
            <p className="text-xs text-muted-foreground">等待匹配中</p>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-matched">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已匹配</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold"
              data-testid="text-matched-events"
            >
              {matchedCount}
            </div>
            <p className="text-xs text-muted-foreground">成功匹配</p>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-completed">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已完成</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className="text-2xl font-bold"
              data-testid="text-completed-events"
            >
              {completedCount}
            </div>
            <p className="text-xs text-muted-foreground">活动已结束</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">筛选条件</CardTitle>
          <CardDescription className="text-xs">
            通过状态 / 城市 / 活动类型 / 是否已关联活动池筛选盲盒活动。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          {/* 状态 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">状态</span>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="pending_match">待匹配</SelectItem>
                <SelectItem value="matched">已匹配</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 城市 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">城市</span>
            <Select
              value={cityFilter}
              onValueChange={(v) => setCityFilter(v as CityFilter)}
            >
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="全部城市" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部城市</SelectItem>
                <SelectItem value="深圳">深圳</SelectItem>
                <SelectItem value="香港">香港</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 活动类型 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">活动类型</span>
            <Select
              value={eventTypeFilter}
              onValueChange={(v) => setEventTypeFilter(v as EventTypeFilter)}
            >
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="全部类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="饭局">饭局</SelectItem>
                <SelectItem value="酒局">酒局</SelectItem>
                <SelectItem value="其他">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 预算 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">预算</span>
            <Select
              value={budgetFilter}
              onValueChange={(v) => setBudgetFilter(v as BudgetFilter)}
            >
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="全部预算" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部预算</SelectItem>
                {budgetOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 语言偏好 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">语言偏好</span>
            <Select
              value={languageFilter}
              onValueChange={(v) => setLanguageFilter(v as LanguageFilter)}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="全部语言" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部语言</SelectItem>
                {languageOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 口味偏好 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">口味偏好</span>
            <Select
              value={tasteFilter}
              onValueChange={(v) => setTasteFilter(v as TasteFilter)}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="全部口味" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部口味</SelectItem>
                {tasteIntensityOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 菜系偏好 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">菜系偏好</span>
            <Select
              value={cuisineFilter}
              onValueChange={(v) => setCuisineFilter(v as CuisineFilter)}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="全部菜系" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部菜系</SelectItem>
                {cuisineOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Event List */}
      <Card data-testid="card-events-list">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>盲盒活动列表</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div
              className="py-12 text-center text-muted-foreground text-sm"
              data-testid="text-no-events"
            >
              暂无符合筛选条件的盲盒活动
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event) => (
                <Card
                  key={event.id}
                  className="overflow-hidden"
                  data-testid={`card-event-${event.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 space-y-1">
                        <CardTitle
                          className="text-base"
                          data-testid={`text-event-title-${event.id}`}
                        >
                          {event.title}
                        </CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            data-testid={`badge-event-type-${event.id}`}
                          >
                            {event.eventType}
                          </Badge>
                          <Badge
                            variant={
                              STATUS_MAP[event.status]?.variant || "default"
                            }
                            data-testid={`badge-event-status-${event.id}`}
                          >
                            {STATUS_MAP[event.status]?.label || event.status}
                          </Badge>
                          {event.poolTitle && (
                            <Badge variant="outline" className="text-[10px]">
                              池：{event.poolTitle}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span data-testid={`text-event-datetime-${event.id}`}>
                          {formatDateTime(event.dateTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span
                          className="text-xs text-muted-foreground"
                          data-testid={`text-location-${event.id}`}
                        >
                          {event.city} · {event.district}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span data-testid={`text-participants-${event.id}`}>
                          {event.currentParticipants}/
                          {event.totalParticipants || "?"} 参与者
                        </span>
                      </div>
                      {event.restaurantName && (
                        <div
                          className="text-xs text-muted-foreground"
                          data-testid={`text-restaurant-${event.id}`}
                        >
                          🍽 {event.restaurantName}
                          {event.restaurantAddress
                            ? ` · ${event.restaurantAddress}`
                            : ""}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleViewDetails(event)}
                        data-testid={`button-view-details-${event.id}`}
                      >
                        查看详情
                      </Button>
                      {(event.status === "pending_match" || event.status === "matching") && (
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => handleStartMatching(event.id)}
                          disabled={startMatchMutation.isPending}
                          data-testid={`button-start-match-${event.id}`}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          开始匹配
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {selectedEvent?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-6 text-sm">
              {/* Basic Info */}
              <div className="space-y-3">
                <h3 className="font-semibold">基本信息</h3>
                <div className="grid gap-3">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">活动类型:</span>
                    <span
                      className="col-span-2"
                      data-testid="text-detail-event-type"
                    >
                      {selectedEvent.eventType}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">活动时间:</span>
                    <span
                      className="col-span-2"
                      data-testid="text-detail-datetime"
                    >
                      {formatDateTime(selectedEvent.dateTime)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">城市/商圈:</span>
                    <span
                      className="col-span-2"
                      data-testid="text-detail-location"
                    >
                      {selectedEvent.city} - {selectedEvent.district}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">状态:</span>
                    <div className="col-span-2">
                      <Badge
                        variant={
                          STATUS_MAP[selectedEvent.status]?.variant || "default"
                        }
                        data-testid="badge-detail-status"
                      >
                        {STATUS_MAP[selectedEvent.status]?.label ||
                          selectedEvent.status}
                      </Badge>
                    </div>
                  </div>
                  {selectedEvent.poolTitle && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-muted-foreground">
                        所属活动池:
                      </span>
                      <span className="col-span-2">
                        {selectedEvent.poolTitle}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Creator Info */}
              <div className="space-y-3">
                <h3 className="font-semibold">创建者信息</h3>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">姓名:</span>
                    <span
                      className="col-span-2"
                      data-testid="text-detail-creator-name"
                    >
                      {getCreatorName(selectedEvent)}
                    </span>
                  </div>
                  {selectedEvent.creator?.email && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-muted-foreground">邮箱:</span>
                      <span
                        className="col-span-2"
                        data-testid="text-detail-creator-email"
                      >
                        {selectedEvent.creator.email}
                      </span>
                    </div>
                  )}
                  {selectedEvent.creator?.phoneNumber && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-muted-foreground">电话:</span>
                      <span
                        className="col-span-2"
                        data-testid="text-detail-creator-phone"
                      >
                        {selectedEvent.creator.phoneNumber}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Budget & Preferences */}
              <div className="space-y-3">
                <h3 className="font-semibold">预算与偏好设置</h3>
                <div className="grid gap-3 text-sm">
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">预算档位:</span>
                    <span className="col-span-2">
                      {selectedEvent.budgetTier || "未设置"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">语言偏好:</span>
                    <span className="col-span-2">
                      {selectedEvent.selectedLanguages &&
                      selectedEvent.selectedLanguages.length > 0
                        ? selectedEvent.selectedLanguages.join("、")
                        : "未设置"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">口味偏好:</span>
                    <span className="col-span-2">
                      {selectedEvent.selectedTasteIntensity &&
                      selectedEvent.selectedTasteIntensity.length > 0
                        ? selectedEvent.selectedTasteIntensity.join("、")
                        : "未设置"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">菜系偏好:</span>
                    <span className="col-span-2">
                      {selectedEvent.selectedCuisines &&
                      selectedEvent.selectedCuisines.length > 0
                        ? selectedEvent.selectedCuisines.join("、")
                        : "未设置"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Update */}
              <div className="space-y-3">
                <h3 className="font-semibold">管理操作</h3>
                <div className="flex items-center gap-3">
                  <Label>更新状态:</Label>
                  <Select
                    value={selectedEvent.status}
                    onValueChange={handleStatusUpdate}
                  >
                    <SelectTrigger
                      className="w-40"
                      data-testid="select-update-status"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value="pending_match"
                        data-testid="option-status-pending"
                      >
                        待匹配
                      </SelectItem>
                      <SelectItem
                        value="matched"
                        data-testid="option-status-matched"
                      >
                        已匹配
                      </SelectItem>
                      <SelectItem
                        value="completed"
                        data-testid="option-status-completed"
                      >
                        已完成
                      </SelectItem>
                      <SelectItem
                        value="canceled"
                        data-testid="option-status-canceled"
                      >
                        已取消
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}