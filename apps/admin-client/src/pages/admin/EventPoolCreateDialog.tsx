import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import FieldInfoTooltip from "@/components/discover/FieldInfoTooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Store, MapPin, RefreshCw, RotateCcw } from "lucide-react";
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
  };
  /** Whether the venue has at least one slot with capacity remaining on the selected date */
  hasAvailabilityOnDate: boolean | null;
  /** Number of slots with remaining capacity on the selected date (null if date not queried) */
  availableSlotCount: number | null;
}

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
        hasTimeSlots: boolean;
        hasAvailabilityOnDate: boolean | null;
        availableSlotCount: number | null;
      }>;
      return venues
        .filter((v) => v.hasTimeSlots)
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

  const handleCloseDialog = (value: boolean) => {
    if (!value) {
      setEditingPoolId(null);
      form.reset();
    }
    onOpenChange(value);
  };

  return (
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
                        <SelectItem value="深圳">深圳</SelectItem>
                        <SelectItem value="香港">香港</SelectItem>
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
  );
}
