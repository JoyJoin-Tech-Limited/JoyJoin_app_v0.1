import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Plus, Clock, Edit, Trash2, Calendar, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/ui/use-toast";
import { Venue } from "./venueConstants";

interface VenueTimeSlot {
  id: string;
  venueId: string;
  dayOfWeek: number | null;
  specificDate: string | null;
  startTime: string;
  endTime: string;
  maxConcurrentEvents: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "周日", short: "日" },
  { value: 1, label: "周一", short: "一" },
  { value: 2, label: "周二", short: "二" },
  { value: 3, label: "周三", short: "三" },
  { value: 4, label: "周四", short: "四" },
  { value: 5, label: "周五", short: "五" },
  { value: 6, label: "周六", short: "六" },
];

interface VenueTimeSlotsManagerProps {
  venue: Venue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VenueTimeSlotsManager({ venue, open, onOpenChange }: VenueTimeSlotsManagerProps) {
  const { toast } = useToast();
  const [showSlotFormDialog, setShowSlotFormDialog] = useState(false);
  const [editingSlot, setEditingSlot] = useState<VenueTimeSlot | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<VenueTimeSlot | null>(null);

  const [slotFormData, setSlotFormData] = useState({
    selectedDays: [] as number[],
    startTime: "18:00",
    endTime: "23:00",
    maxConcurrentEvents: "2",
    notes: "",
    isActive: true,
  });

  const { data: timeSlots = [], isLoading: timeSlotsLoading } = useQuery<VenueTimeSlot[]>({
    queryKey: ["/api/admin/venues", venue?.id, "time-slots"],
    queryFn: async () => {
      if (!venue) return [];
      try {
        const res = await apiRequest("GET", `/api/admin/venues/${venue.id}/time-slots`);
        return await res.json();
      } catch (err) {
        console.error(err);
        return [];
      }
    },
    enabled: open && !!venue,
  });

  // Group slots by day for display
  const slotsByDay = useMemo(() => {
    const grouped: Record<number, VenueTimeSlot[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    timeSlots.forEach(slot => {
      if (slot.dayOfWeek !== null && slot.dayOfWeek >= 0 && slot.dayOfWeek <= 6) {
        grouped[slot.dayOfWeek].push(slot);
      }
    });
    // Sort by start time
    Object.values(grouped).forEach(daySlots => {
      daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return grouped;
  }, [timeSlots]);

  const createSlotMutation = useMutation({
    mutationFn: async (data: any) => {
      return await fetch(`/api/admin/venues/${venue?.id}/time-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()).catch((err) => { throw err; });
    },
    onSuccess: () => {
      if (venue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venue.id, "time-slots"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/time-slots/all"] });
      }
      setShowSlotFormDialog(false);
      resetSlotForm();
      toast({ title: "时间段创建成功", description: "场地可用时间已更新" });
    },
    onError: (error: any) => {
      toast({ title: "创建失败", description: error.message || "无法创建时间段，请重试", variant: "destructive" });
    },
  });

  const batchCreateSlotMutation = useMutation({
    mutationFn: async (slots: any[]) => {
      return await fetch(`/api/admin/venues/${venue?.id}/time-slots/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ timeSlots: slots }),
      }).then((r) => r.json()).catch((err) => { throw err; });
    },
    onSuccess: () => {
      if (venue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venue.id, "time-slots"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/time-slots/all"] });
      }
      setShowSlotFormDialog(false);
      resetSlotForm();
      toast({ title: "批量创建成功", description: "多个时间段已添加" });
    },
    onError: (error: any) => {
      toast({ title: "创建失败", description: error.message || "无法批量创建时间段，请重试", variant: "destructive" });
    },
  });

  const updateSlotMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await fetch(`/api/admin/time-slots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()).catch((err) => { throw err; });
    },
    onSuccess: () => {
      if (venue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venue.id, "time-slots"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/time-slots/all"] });
      }
      setShowSlotFormDialog(false);
      setEditingSlot(null);
      resetSlotForm();
      toast({ title: "更新成功", description: "时间段信息已更新" });
    },
    onError: (error: any) => {
      toast({ title: "更新失败", description: error.message || "无法更新时间段，请重试", variant: "destructive" });
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: string) => {
      return await fetch(`/api/admin/time-slots/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => r.json()).catch((err) => { throw err; });
    },
    onSuccess: () => {
      if (venue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venue.id, "time-slots"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/time-slots/all"] });
      }
      setShowDeleteDialog(false);
      setSlotToDelete(null);
      toast({ title: "删除成功", description: "时间段已删除" });
    },
    onError: () => {
      toast({ title: "删除失败", description: "无法删除时间段，请重试", variant: "destructive" });
    },
  });

  const toggleSlotMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await fetch(`/api/admin/time-slots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()).catch((err) => { throw err; });
    },
    onSuccess: () => {
      if (venue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venue.id, "time-slots"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/time-slots/all"] });
      }
    },
  });

  const resetSlotForm = () => {
    setSlotFormData({
      selectedDays: [],
      startTime: "18:00",
      endTime: "23:00",
      maxConcurrentEvents: "2",
      notes: "",
      isActive: true,
    });
  };

  const handleCreateSlot = () => {
    setEditingSlot(null);
    resetSlotForm();
    setShowSlotFormDialog(true);
  };

  const handleEditSlot = (slot: VenueTimeSlot) => {
    setEditingSlot(slot);
    setSlotFormData({
      selectedDays: slot.dayOfWeek !== null ? [slot.dayOfWeek] : [],
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxConcurrentEvents: slot.maxConcurrentEvents.toString(),
      notes: slot.notes || "",
      isActive: slot.isActive,
    });
    setShowSlotFormDialog(true);
  };

  const handleDeleteClick = (slot: VenueTimeSlot) => {
    setSlotToDelete(slot);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (slotToDelete) {
      deleteSlotMutation.mutate(slotToDelete.id);
    }
  };

  const handleSubmitSlot = () => {
    if (!slotFormData.startTime || !slotFormData.endTime) {
      toast({ title: "请填写时间段", description: "开始时间和结束时间不能为空", variant: "destructive" });
      return;
    }

    if (slotFormData.startTime >= slotFormData.endTime) {
      toast({ title: "时间段无效", description: "结束时间必须晚于开始时间", variant: "destructive" });
      return;
    }

    if (editingSlot) {
      // Single update
      updateSlotMutation.mutate({
        id: editingSlot.id,
        data: {
          dayOfWeek: slotFormData.selectedDays[0] ?? null,
          startTime: slotFormData.startTime,
          endTime: slotFormData.endTime,
          maxConcurrentEvents: parseInt(slotFormData.maxConcurrentEvents) || 1,
          notes: slotFormData.notes || null,
          isActive: slotFormData.isActive,
        },
      });
    } else {
      // Batch create
      if (slotFormData.selectedDays.length === 0) {
        toast({ title: "请选择日期", description: "至少选择一天", variant: "destructive" });
        return;
      }

      if (slotFormData.selectedDays.length === 1) {
        // Single create
        createSlotMutation.mutate({
          dayOfWeek: slotFormData.selectedDays[0],
          startTime: slotFormData.startTime,
          endTime: slotFormData.endTime,
          maxConcurrentEvents: parseInt(slotFormData.maxConcurrentEvents) || 1,
          notes: slotFormData.notes || null,
        });
      } else {
        // Batch create
        const slots = slotFormData.selectedDays.map(day => ({
          dayOfWeek: day,
          startTime: slotFormData.startTime,
          endTime: slotFormData.endTime,
          maxConcurrentEvents: parseInt(slotFormData.maxConcurrentEvents) || 1,
          notes: slotFormData.notes || null,
          isActive: true,
        }));
        batchCreateSlotMutation.mutate(slots);
      }
    }
  };

  const toggleDay = (day: number) => {
    setSlotFormData(prev => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter(d => d !== day)
        : [...prev.selectedDays, day].sort((a, b) => a - b),
    }));
  };

  const totalActiveSlots = timeSlots.filter(s => s.isActive).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              场地时间管理 - {venue?.name}
            </DialogTitle>
            <DialogDescription>
              设置场地每周可用时间段，匹配时会自动筛选符合条件的场地
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-muted-foreground">
                共 {timeSlots.length} 个时间段，{totalActiveSlots} 个生效中
              </div>
              <Button onClick={handleCreateSlot} data-testid="button-add-timeslot">
                <Plus className="h-4 w-4 mr-2" />
                添加时间段
              </Button>
            </div>

            {timeSlotsLoading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : timeSlots.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">暂无时间段，点击上方按钮添加</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    建议设置为 18:00-23:00 覆盖晚间活动时段
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {DAYS_OF_WEEK.map(day => {
                  const daySlots = slotsByDay[day.value];
                  return (
                    <div key={day.value} className="border rounded-lg">
                      <div className="px-4 py-2 bg-muted/50 rounded-t-lg font-medium text-sm flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                          {day.short}
                        </span>
                        {day.label}
                        {daySlots.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {daySlots.filter(s => s.isActive).length} 个生效
                          </Badge>
                        )}
                      </div>
                      <div className="p-2 space-y-2">
                        {daySlots.length === 0 ? (
                          <div className="text-xs text-muted-foreground py-2 px-2">该日无可用时间段</div>
                        ) : (
                          daySlots.map(slot => (
                            <div
                              key={slot.id}
                              className={`flex items-center justify-between gap-3 p-3 rounded-md text-sm ${
                                slot.isActive ? 'bg-primary/5' : 'bg-muted/30 opacity-60'
                              }`}
                              data-testid={`timeslot-${slot.id}`}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-medium">
                                  {slot.startTime} - {slot.endTime}
                                </span>
                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                  <Users className="h-3 w-3 mr-1" />
                                  容量 {slot.maxConcurrentEvents}
                                </Badge>
                                {slot.notes && (
                                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                                    {slot.notes}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Switch
                                  checked={slot.isActive}
                                  onCheckedChange={(checked) =>
                                    toggleSlotMutation.mutate({ id: slot.id, isActive: checked })
                                  }
                                  data-testid={`toggle-timeslot-${slot.id}`}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={() => handleEditSlot(slot)}
                                  data-testid={`edit-timeslot-${slot.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDeleteClick(slot)}
                                  data-testid={`delete-timeslot-${slot.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-timeslots">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slot form dialog */}
      <Dialog
        open={showSlotFormDialog}
        onOpenChange={(open) => {
          setShowSlotFormDialog(open);
          if (!open) {
            setEditingSlot(null);
            resetSlotForm();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSlot ? "编辑时间段" : "添加时间段"}</DialogTitle>
            <DialogDescription>
              {editingSlot
                ? "修改此时间段的配置"
                : "选择可用日期和时段，支持多选批量添加"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Day selector */}
            <div className="space-y-2">
              <Label>可用日期 {editingSlot ? "" : "（可多选）"}</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS_OF_WEEK.map(day => {
                  const isSelected = slotFormData.selectedDays.includes(day.value);
                  const isDisabled = editingSlot !== null && slotFormData.selectedDays.length === 1 && isSelected;
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => !isDisabled && toggleDay(day.value)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      disabled={isDisabled}
                      data-testid={`day-toggle-${day.value}`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              {slotFormData.selectedDays.length === 0 && (
                <p className="text-xs text-red-500">请至少选择一天</p>
              )}
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="slot-start">开始时间</Label>
                <Input
                  id="slot-start"
                  type="time"
                  value={slotFormData.startTime}
                  onChange={(e) => setSlotFormData({ ...slotFormData, startTime: e.target.value })}
                  data-testid="input-slot-start"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slot-end">结束时间</Label>
                <Input
                  id="slot-end"
                  type="time"
                  value={slotFormData.endTime}
                  onChange={(e) => setSlotFormData({ ...slotFormData, endTime: e.target.value })}
                  data-testid="input-slot-end"
                />
              </div>
            </div>

            {/* Max concurrent */}
            <div className="space-y-2">
              <Label htmlFor="slot-capacity" className="flex items-center gap-1">
                最大并发桌数
                <span className="text-xs text-muted-foreground">（同时可接待几组）</span>
              </Label>
              <Input
                id="slot-capacity"
                type="number"
                min={1}
                max={10}
                value={slotFormData.maxConcurrentEvents}
                onChange={(e) => setSlotFormData({ ...slotFormData, maxConcurrentEvents: e.target.value })}
                data-testid="input-slot-capacity"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="slot-notes">备注</Label>
              <Textarea
                id="slot-notes"
                placeholder="例：仅周中可用、需提前确认等"
                value={slotFormData.notes}
                onChange={(e) => setSlotFormData({ ...slotFormData, notes: e.target.value })}
                rows={2}
                data-testid="input-slot-notes"
              />
            </div>

            {/* Active toggle (only for edit) */}
            {editingSlot && (
              <div className="flex items-center gap-2">
                <Switch
                  id="slot-active"
                  checked={slotFormData.isActive}
                  onCheckedChange={(checked) => setSlotFormData({ ...slotFormData, isActive: checked })}
                />
                <Label htmlFor="slot-active" className="cursor-pointer">
                  启用此时间段
                </Label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSlotFormDialog(false)} data-testid="button-cancel-slot">
              取消
            </Button>
            <Button
              onClick={handleSubmitSlot}
              disabled={
                createSlotMutation.isPending ||
                batchCreateSlotMutation.isPending ||
                updateSlotMutation.isPending ||
                slotFormData.selectedDays.length === 0
              }
              data-testid="button-submit-slot"
            >
              {createSlotMutation.isPending || batchCreateSlotMutation.isPending || updateSlotMutation.isPending
                ? "保存中..."
                : editingSlot
                ? "更新"
                : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除时间段 "{slotToDelete?.startTime} - {slotToDelete?.endTime}" 吗？
              删除后该时段将不再用于活动匹配。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteSlotMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSlotMutation.isPending ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
