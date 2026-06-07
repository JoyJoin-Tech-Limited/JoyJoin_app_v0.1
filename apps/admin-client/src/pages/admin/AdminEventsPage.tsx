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
  Play,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/ui/use-toast";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import EventCreateDialog from "./EventCreateDialog";
import EmptyState from "@/components/admin/EmptyState";
import { CITY_DISTRICTS } from "@/lib/cityDistricts";

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
  in_progress: { label: "进行中", variant: "default" },
  completed: { label: "已完成", variant: "outline" },
  canceled: { label: "已取消", variant: "destructive" },
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
  { value: "150以下", label: "≤150" },
  { value: "150-200", label: "150-200" },
  { value: "200-300", label: "200-300" },
  { value: "300-500", label: "300-500" },
];

// =============== 组件 ===============

type StatusFilter = "all" | "pending_match" | "matched" | "in_progress" | "completed";
type CityFilter = "all" | "深圳" | "香港";
type EventTypeFilter = "all" | "饭局" | "酒局" | "其他";
type BudgetFilter = "all" | "150以下" | "150-200" | "200-300" | "300-500";
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
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [matchEventId, setMatchEventId] = useState<string | null>(null);

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
    setMatchEventId(eventId);
    setShowMatchDialog(true);
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

        <EventCreateDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          pools={pools}
          formatDateTime={formatDateTime}
          budgetOptions={budgetOptions}
          languageOptions={languageOptions}
          tasteIntensityOptions={tasteIntensityOptions}
          cuisineOptions={cuisineOptions}
        />
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
                <SelectItem value="in_progress">进行中</SelectItem>
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
            <EmptyState
              title="暂无符合筛选条件的盲盒活动"
              data-testid="text-no-events"
            />
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
                    <span className="text-muted-foreground">活动类型</span>
                    <span
                      className="col-span-2"
                      data-testid="text-detail-event-type"
                    >
                      {selectedEvent.eventType}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">活动时间</span>
                    <span
                      className="col-span-2"
                      data-testid="text-detail-datetime"
                    >
                      {formatDateTime(selectedEvent.dateTime)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">城市/商圈</span>
                    <span
                      className="col-span-2"
                      data-testid="text-detail-location"
                    >
                      {selectedEvent.city} - {selectedEvent.district}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">状态</span>
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
                    <span className="text-muted-foreground">姓名</span>
                    <span
                      className="col-span-2"
                      data-testid="text-detail-creator-name"
                    >
                      {getCreatorName(selectedEvent)}
                    </span>
                  </div>
                  {selectedEvent.creator?.email && (
                    <div className="grid grid-cols-3 gap-2">
                      <span className="text-muted-foreground">邮箱</span>
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
                      <span className="text-muted-foreground">电话</span>
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
                    <span className="text-muted-foreground">预算档位</span>
                    <span className="col-span-2">
                      {selectedEvent.budgetTier || "未设置"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">语言偏好</span>
                    <span className="col-span-2">
                      {selectedEvent.selectedLanguages &&
                      selectedEvent.selectedLanguages.length > 0
                        ? selectedEvent.selectedLanguages.join("、")
                        : "未设置"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">口味偏好</span>
                    <span className="col-span-2">
                      {selectedEvent.selectedTasteIntensity &&
                      selectedEvent.selectedTasteIntensity.length > 0
                        ? selectedEvent.selectedTasteIntensity.join("、")
                        : "未设置"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-muted-foreground">菜系偏好</span>
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
                  <Label>更新状态</Label>
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

      {/* Matching Confirmation Dialog */}
      <AlertDialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认开始匹配</AlertDialogTitle>
            <AlertDialogDescription>
              确定要为这个盲盒活动开始匹配吗？如果算法已接入，将从对应活动池中分配用户。
              此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMatchEventId(null)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (matchEventId) {
                  startMatchMutation.mutate(matchEventId);
                }
                setMatchEventId(null);
              }}
              disabled={startMatchMutation.isPending}
              data-testid="button-confirm-start-match"
            >
              {startMatchMutation.isPending ? "匹配中..." : "确认开始匹配"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}