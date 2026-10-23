import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import FieldInfoTooltip from "@/components/discover/FieldInfoTooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Store, MapPin, RefreshCw, RotateCcw, AlertTriangle, Table2 } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { CITY_DISTRICTS } from "@/lib/cityDistricts";
import { useToast } from "@/hooks/ui/use-toast";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { cn } from "@/lib/utils";

/**
 * Venue data enriched with date-level availability from the smart-venues API.
 */
interface AvailableVenue {
  venue: {
    id: string;
    name: string;
    venueType: string;
    address: string;
    city: string;
    area: string;
    priceRange: string | null;
    tags: string[] | null;
    cuisines: string[] | null;
    /** 场地单场上限人数（`seatingCapacity ?? capacity`）。排桌引擎用它判断一桌人坐不坐得下。 */
    seatingCapacity: number | null;
    capacity: number | null;
  };
  /** Whether the venue has at least one slot with capacity remaining on the selected date */
  hasAvailabilityOnDate: boolean | null;
  /** Number of slots with remaining capacity on the selected date (null if date not queried) */
  availableSlotCount: number | null;
}

/**
 * Stable serialisation of the form's values.
 *
 * Used instead of react-hook-form's `formState.isDirty` for two reasons:
 * - the form instance is owned by the parent page (typed `any` here) and is
 *   pre-filled for edit mode with `reset(values)`;
 * - `setValue` marks a field dirty even when the value is unchanged (picking
 *   the already-selected city would look like an edit).
 * Comparing actual values means "dirty" = "an operator changed something".
 */
function serializeFormValues(values: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(values)
      .sort()
      .map((key) => [key, values[key] ?? null])
  );
}

/** Capacity verdict for the plan in the dialog. */
type CapacityEstimate =
  | { status: "loading" }
  | { status: "unavailable"; reason: string }
  | {
      status: "estimated";
      /** 可容纳的桌数 = 本区当天可预订的 (场地, 时段) 档期数，已排除坐不下一桌的场地 */
      tables: number;
      /** 参与估算的场地数 */
      venueCount: number;
      /** 是否有场地没拿到档期数据（未计入估算） */
      unknownAvailability: boolean;
    };

interface EventPoolCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPoolId: string | null;
  setEditingPoolId: (id: string | null) => void;
  form: any;
  onSubmit: (data: any) => void;
  createPoolMutation: { isPending: boolean };
  updatePoolMutation: { isPending: boolean };
}

export default function EventPoolCreateDialog({
  open,
  onOpenChange,
  editingPoolId,
  setEditingPoolId,
  form,
  onSubmit,
  createPoolMutation,
  updatePoolMutation,
}: EventPoolCreateDialogProps) {
  const { toast } = useToast();
  const currentCity = form.watch("city") as "深圳" | "香港";
  const currentDistrict = form.watch("district");
  const currentDateTime = form.watch("dateTime");
  const currentEventType = form.watch("eventType");
  const currentGenderBalanceMode = form.watch("genderBalanceMode");
  const currentCityDistricts = CITY_DISTRICTS[currentCity] ?? [];

  // Extract YYYY-MM-DD from the datetime-local input for date-level availability checking
  const selectedDate = currentDateTime && typeof currentDateTime === "string"
    ? currentDateTime.split("T")[0]
    : undefined;

  const {
    data: availableVenues = [],
    isLoading: isLoadingVenues,
    isError: isVenuesError,
    error: venuesError,
    refetch,
  } = useQuery<AvailableVenue[]>({
    queryKey: [
      "/api/admin/smart-venues",
      currentCity,
      currentDistrict,
      selectedDate,
      currentEventType,
    ],
    queryFn: async () => {
      if (!currentCity || !selectedDate) return [];
      const params = new URLSearchParams({
        city: currentCity,
        eventType: currentEventType || "饭局",
        date: selectedDate,
      });
      if (currentDistrict) {
        params.append("district", currentDistrict);
      }
      const res = await apiRequest("GET", `/api/admin/smart-venues?${params}`);
      const venues = (await res.json()) as Array<{
        id: string;
        name: string;
        venueType: string;
        address: string;
        city: string;
        area: string;
        priceRange: string | null;
        tags: string[] | null;
        cuisines: string[] | null;
        seatingCapacity: number | null;
        capacity: number | null;
        hasTimeSlots: boolean | null;
        hasAvailabilityOnDate: boolean | null;
        availableSlotCount: number | null;
      }>;
      return venues
        .filter((v) => v.hasTimeSlots !== false)
        .map((v) => ({
          venue: {
            id: v.id,
            name: v.name,
            venueType: v.venueType,
            address: v.address,
            city: v.city,
            area: v.area,
            priceRange: v.priceRange,
            tags: v.tags,
            cuisines: v.cuisines,
            seatingCapacity: v.seatingCapacity ?? null,
            capacity: v.capacity ?? null,
          },
          hasAvailabilityOnDate: v.hasAvailabilityOnDate,
          availableSlotCount: v.availableSlotCount,
        }));
    },
    enabled: open && !!currentCity && !!selectedDate,
  });

  // Show toast once when venue loading fails so the error isn't silent
  useEffect(() => {
    if (isVenuesError && venuesError) {
      const message = venuesError instanceof Error ? venuesError.message : "未知错误";
      if (!message.includes("401")) {
        toast({
          title: "加载可用场地失败",
          description: message,
          variant: "destructive",
        });
      }
    }
  }, [isVenuesError, venuesError, toast]);

  // ====== 未保存内容守卫 ======
  // 关闭这个弹窗有三条路：底部「取消」、右上角 X、点遮罩或按 Esc。三条路都会
  // 走到 handleCloseDialog，所以守卫必须装在那里，而不是只挂在取消按钮上。
  // 此前这里无条件 form.reset()：20 个字段填完、误点遮罩，内容静默清零。
  // 注意：`form.watch()` 的无参形式会打开 react-hook-form 的 watchAll 标记，
  // 从而让表单所有者（父页面）在每次字段变化时重渲染 —— 也就是让下面的
  // `isDirty` 在用户点「关闭」之前一定是最新的。删掉这行会让守卫读到旧的
  // isDirty（点了没反应或该拦的没拦），它不是「顺手订阅」，是正确性依赖。
  const watchedValues = (form.watch() ?? {}) as Record<string, unknown>;
  const openSnapshotRef = useRef<string | null>(null);

  useEffect(() => {
    // 基线 = 弹窗打开那一刻的值。只在开关时重算，因此编辑模式的预填
    // （父组件先 reset(poolValues) 再打开）是基线，而不是「改动」。
    openSnapshotRef.current = open ? serializeFormValues(form.getValues() ?? {}) : null;
  }, [open, form]);

  const isDirty =
    open &&
    openSnapshotRef.current !== null &&
    serializeFormValues(watchedValues) !== openSnapshotRef.current;

  const { confirmOpen, requestClose, cancelClose, confirmDiscard } = useUnsavedGuard(isDirty);

  // ====== 场地容量预估：计划 M 桌 vs 本区当天可容纳 N 桌 ======
  // N 不是猜的，也不是服务端的排桌结论：`/api/admin/smart-venues` 已经按
  // venueAssignmentService 的同一个规则（`该日时段的已确认预订数 < maxConcurrentEvents`）
  // 返回每个场地的 availableSlotCount。这里把它按区/日汇总，再用同一条
  // 座位数硬约束（`seatingCapacity < 单桌人数` → score 0 → 不参与排桌）筛场地。
  //
  // 它是「粗略估算」，两个方向都可能偏：
  //   偏多：smart-venues 数的是当天所有时段，排桌只认覆盖活动时间的时段；
  //         且未叠加合作状态 / 合同有效期 / 预算 / 菜系打分。
  //   偏少：一个时段 maxConcurrentEvents > 1 时可排多桌，这里只算 1。
  // 所以文案只承诺「估算」，并逐条写明偏差来源 —— 不写「可以排得下」。
  const targetGroups = Number(form.watch("targetGroups") ?? 0);
  const maxGroupSize = Number(form.watch("maxGroupSize") ?? 0);
  const plannedGroups = Number.isFinite(targetGroups) && targetGroups > 0 ? targetGroups : 1;
  const editingTitle = (form.watch("title") ?? "") as string;

  const capacityEstimate = useMemo<CapacityEstimate>(() => {
    if (!currentCity || !selectedDate) {
      return { status: "unavailable", reason: "选择城市和活动时间后可估算" };
    }
    if (isLoadingVenues) return { status: "loading" };
    if (isVenuesError) return { status: "unavailable", reason: "场地档期加载失败，可刷新后重试" };

    // 与 venueAssignmentService 一致：已知座位数坐不下一桌的场地直接排除；
    // 座位数未知（0/null）按可用放行，服务端也是这么处理的。
    const hostable = availableVenues.filter(({ venue }) => {
      const seating = venue.seatingCapacity ?? venue.capacity ?? 0;
      return !(seating > 0 && maxGroupSize > 0 && seating < maxGroupSize);
    });

    return {
      status: "estimated",
      tables: hostable.reduce((sum, v) => sum + (v.availableSlotCount ?? 0), 0),
      venueCount: hostable.length,
      unknownAvailability: hostable.some((v) => v.availableSlotCount === null),
    };
  }, [availableVenues, currentCity, isVenuesError, isLoadingVenues, maxGroupSize, selectedDate]);

  const capacityShortfall =
    capacityEstimate.status === "estimated" && capacityEstimate.tables < plannedGroups
      ? plannedGroups - capacityEstimate.tables
      : 0;
  const capacityShort = capacityShortfall > 0;

  const capacitySuggestions: string[] =
    capacityEstimate.status !== "estimated" || !capacityShort
      ? []
      : capacityEstimate.tables > 0
        ? [
            `把计划桌数降到 ${capacityEstimate.tables} 桌（当前 ${plannedGroups} 桌）`,
            "换一个区域，或把活动日期改到有档期的一天",
            "先到场地管理，为现有场地补充当天档期",
          ]
        : [
            "换一个区域，或把活动日期改到有档期的一天",
            "先到场地管理，为现有场地补充当天档期",
            "拆成多场活动，分别挂到不同区域的池子",
          ];

  const handleCloseDialog = (value: boolean) => {
    if (value) {
      onOpenChange(true);
      return;
    }
    // 有改动就先问；确认后才真的销毁这份输入。
    requestClose(() => {
      setEditingPoolId(null);
      form.reset();
      onOpenChange(false);
    });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-pool" onClick={() => { setEditingPoolId(null); form.reset(); }}>
          <Calendar className="mr-2 h-4 w-4" />
          创建活动池
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingPoolId ? "编辑活动池" : "创建新活动池"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {/* 基本信息 */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>活动标题 *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例如：深圳·南山 饭局常驻池"
                      {...field}
                      data-testid="input-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>活动池介绍</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="向运营/自己解释一下这个池子的定位（可选）"
                      {...field}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="eventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>活动类型 *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-event-type">
                          <SelectValue placeholder="选择类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="饭局">饭局</SelectItem>
                        <SelectItem value="酒局">酒局</SelectItem>
                        <SelectItem value="其他">其他</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>城市 *</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("district", "");
                      }}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-city">
                          <SelectValue placeholder="选择城市" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(CITY_DISTRICTS) as (keyof typeof CITY_DISTRICTS)[]).map((city) => (
                          <SelectItem key={city} value={city}>{city}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="district"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>区域 *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-district">
                        <SelectValue placeholder="选择区域" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currentCityDistricts.map((d: string) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="dateTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>推荐活动时间 *</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-datetime"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="registrationDeadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>报名截止时间 *</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        data-testid="input-deadline"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 可用场地提示 */}
            {currentCity && selectedDate && (
              <div
                className="border-t pt-4 mt-4"
                aria-live="polite"
                aria-label="可用场地"
                role="region"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Store className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h3 className="font-semibold">可用场地</h3>
                  {!isLoadingVenues && !isVenuesError && (
                    <Badge variant="secondary" className="text-xs">
                      {availableVenues.length} 个场地
                    </Badge>
                  )}
                  {!isLoadingVenues && availableVenues.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs ml-auto"
                      onClick={() => refetch()}
                      aria-label="刷新场地列表"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                      刷新
                    </Button>
                  )}
                </div>

                {/* Skeleton loading state */}
                {isLoadingVenues && (
                  <div className="space-y-2" role="status" aria-label="加载场地中">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-3 bg-muted/30 rounded-md space-y-2">
                        <Skeleton className="h-4 w-3/5" />
                        <Skeleton className="h-3 w-2/5" />
                      </div>
                    ))}
                  </div>
                )}

                {isVenuesError && (
                  <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
                    <div className="font-medium">加载可用场地失败</div>
                    <div className="text-destructive/80 mt-1">
                      {venuesError instanceof Error && venuesError.message.includes("401")
                        ? "会话已过期，请重新登录后重试"
                        : venuesError instanceof Error
                          ? venuesError.message
                          : "请检查网络连接后重试"}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 text-xs"
                      onClick={() => refetch()}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" aria-hidden="true" />
                      重试
                    </Button>
                  </div>
                )}

                {!isLoadingVenues && !isVenuesError && availableVenues.length === 0 && (
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-3 flex items-start gap-2">
                    <Store className="h-4 w-4 mt-0.5 shrink-0 opacity-50" aria-hidden="true" />
                    <div>
                      <div className="font-medium">
                        {currentDistrict
                          ? `${currentCity} ${currentDistrict} 暂无可用场地`
                          : `${currentCity} 暂无可用场地`
                        }
                      </div>
                      <div className="text-muted-foreground/80 mt-0.5">
                        请调整日期、区域或活动类型后重试
                      </div>
                    </div>
                  </div>
                )}

                {!isLoadingVenues && availableVenues.length > 0 && (
                  <ScrollArea className="h-[160px] rounded-md border p-2">
                    <div className="space-y-2">
                      {availableVenues.map(({ venue, hasAvailabilityOnDate, availableSlotCount }) => (
                        <div
                          key={venue.id}
                          className="p-3 bg-muted/30 rounded-md"
                          data-testid={`available-venue-${venue.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{venue.name}</div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 flex-wrap">
                                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                                <span>{venue.area}</span>
                                {venue.priceRange && (
                                  <>
                                    <span className="mx-1">·</span>
                                    <span>¥{venue.priceRange}/人</span>
                                  </>
                                )}
                                {typeof availableSlotCount === "number" && availableSlotCount > 0 && (
                                  <>
                                    <span className="mx-1">·</span>
                                    <span className="text-green-600 font-medium">
                                      {availableSlotCount} 个时段可预订
                                    </span>
                                  </>
                                )}
                                {hasAvailabilityOnDate === false && (
                                  <>
                                    <span className="mx-1">·</span>
                                    <span className="text-amber-600">该日已满</span>
                                  </>
                                )}
                                {hasAvailabilityOnDate === null && (
                                  <>
                                    <span className="mx-1">·</span>
                                    <span className="text-amber-600">可用性待确认</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {venue.venueType === "restaurant" ? "餐厅" : "酒吧"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* 组局配置 */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-3">组局配置</h3>
              <div className="grid grid-cols-3 gap-4">
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
                          max={10}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value || "4"))
                          }
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
                          max={10}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value || "6"))
                          }
                          data-testid="input-max-size"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetGroups"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        目标组数 *
                        <FieldInfoTooltip
                          title="目标组数"
                          description="预计分成几组，影响场地预订数量。每组建议 4-8 人，人数过多会降低互动质量。"
                        />
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value || "1"))
                          }
                          data-testid="input-target-groups"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 场地容量预估：计划 M 桌 vs 本区当天可容纳 N 桌 */}
              <div
                className={cn(
                  "mt-4 rounded-md border p-3 text-sm",
                  capacityShort
                    ? "border-destructive/40 bg-destructive/5"
                    : "bg-muted/30"
                )}
                aria-live="polite"
                data-testid="capacity-estimate"
                data-capacity-short={capacityShort ? "true" : "false"}
              >
                <div className="flex items-start gap-2">
                  {capacityShort ? (
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                      aria-hidden="true"
                    />
                  ) : (
                    <Table2
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {capacityEstimate.status === "estimated" ? (
                      <p className={cn("font-medium", capacityShort && "text-destructive")}>
                        可容纳 {capacityEstimate.tables} 桌 / 计划 {plannedGroups} 桌
                        {capacityEstimate.venueCount === 0 && (
                          <span className="ml-1 font-normal">（本区没有坐得下这一桌的场地）</span>
                        )}
                      </p>
                    ) : capacityEstimate.status === "loading" ? (
                      <p className="font-medium text-muted-foreground">正在估算可容纳桌数…</p>
                    ) : (
                      <p className="font-medium text-muted-foreground">
                        暂无法预估
                        <span className="ml-1 font-normal">（{capacityEstimate.reason}）</span>
                      </p>
                    )}

                    {capacityEstimate.status === "estimated" && (
                      <p className="text-xs text-muted-foreground">
                        按本区场地在该日可预订的档期数估算（与排桌引擎的时段并发上限同一规则）。
                        实际可容纳可能更少——只算覆盖活动时间的时段，且还要过合作状态、
                        合同有效期、预算与菜系；也可能更多——同一时段允许排多桌。
                        最终以排桌结果为准。
                        {capacityEstimate.unknownAvailability && (
                          <span className="mt-0.5 block text-amber-600">
                            部分场地档期未确认，未计入估算。
                          </span>
                        )}
                      </p>
                    )}

                    {capacityShort && capacitySuggestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-destructive">
                          按当前计划，会有 {capacityShortfall} 桌排不到场地（截止后落到「地点待定」）。可以先：
                        </p>
                        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                          {capacitySuggestions.map((suggestion) => (
                            <li key={suggestion}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <FormField
                control={form.control}
                name="isTestPool"
                render={({ field }) => (
                  <FormItem className="mt-4 flex flex-row items-start gap-3 rounded-md border border-dashed p-3">
                    <FormControl>
                      <Checkbox
                        checked={Boolean(field.value)}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        data-testid="checkbox-is-test-pool"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>测试活动池</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        仅用于 staging/测试环境触发 BotFill，不影响普通活动池。
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* 性别平衡 (Sprint 2026-07-14 gender ratio enforcement, AC-08) */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-1">性别平衡</h3>
              <p className="text-xs text-muted-foreground mb-3">
                软约束 = 男女比例均衡的小组获得匹配加分；硬约束 = 每组必须满足最少男/女人数。
              </p>

              <FormField
                control={form.control}
                name="genderBalanceMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>平衡模式</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-gender-balance-mode">
                          <SelectValue placeholder="选择平衡模式" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">不考虑</SelectItem>
                        <SelectItem value="soft">软约束 · 平衡加分</SelectItem>
                        <SelectItem value="hard">硬约束 · 人数下限</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {currentGenderBalanceMode === "soft" && (
                <FormField
                  control={form.control}
                  name="genderBalanceBonusPoints"
                  render={({ field }) => (
                    <FormItem className="mt-4">
                      <FormLabel>平衡加分（0–100，默认 15）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value || "15"))
                          }
                          data-testid="input-gender-balance-bonus"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {currentGenderBalanceMode === "hard" && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name="minFemaleCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>每组最少女性人数</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value || "0"))
                            }
                            data-testid="input-min-female-count"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="minMaleCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>每组最少男性人数</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={20}
                            {...field}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value || "0"))
                            }
                            data-testid="input-min-male-count"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <p className="col-span-2 text-xs text-muted-foreground">
                    每组最少人数，0 = 不限制。
                  </p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleCloseDialog(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createPoolMutation.isPending || updatePoolMutation.isPending}
                data-testid="button-submit-pool"
              >
                {editingPoolId
                  ? (updatePoolMutation.isPending ? "更新中..." : "保存修改")
                  : (createPoolMutation.isPending ? "创建中..." : "创建活动池")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    {/* 放弃未保存内容？—— 只在有改动且操作员尝试关闭时出现。
        取消回到编辑状态，弹窗保持原样（不 reset、不关闭）。 */}
    <AlertDialog
      open={confirmOpen}
      onOpenChange={(next) => {
        if (!next) cancelClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>放弃未保存的内容？</AlertDialogTitle>
          <AlertDialogDescription>
            {editingTitle
              ? `「${editingTitle}」还有未保存的内容`
              : "这个活动池还有未保存的内容"}
            ，关闭后无法恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelClose} data-testid="button-keep-editing-pool">
            继续编辑
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDiscard}
            data-testid="button-confirm-discard-pool"
          >
            放弃并关闭
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
