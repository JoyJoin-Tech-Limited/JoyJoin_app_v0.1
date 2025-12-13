import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Store, Plus, Edit, Trash2, Building, TrendingUp, Calendar, DollarSign, Clock, X, CalendarDays, LayoutGrid, AlertTriangle, ArrowRightLeft } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";

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
  { value: 0, label: "周日" },
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
];

interface Venue {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  district: string;
  contactName: string | null;
  contactPhone: string | null;
  commissionRate: number;
  tags: string[] | null;
  cuisines: string[] | null;
  decorStyle: string[] | null;
  priceRange: string | null;
  maxConcurrentEvents: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  bookingCount?: number;
  totalCommission?: number;
}

const VENUE_TYPES = [
  { value: "restaurant", label: "餐厅" },
  { value: "bar", label: "酒吧" },
];

const CITIES = [
  { value: "深圳", label: "深圳" },
  { value: "香港", label: "香港" },
];

const PRICE_RANGES = [
  { value: "100-200", label: "¥100-200" },
  { value: "200-300", label: "¥200-300" },
  { value: "300+", label: "¥300+" },
];

const TAGS = ["cozy", "lively", "upscale", "casual"];
const CUISINES = ["粤菜", "川菜", "日料", "西餐", "酒吧"];
const DECOR_STYLES = ["轻奢现代风", "绿植花园风", "复古工业风", "温馨日式风"];

interface AllTimeSlot extends VenueTimeSlot {
  venueName: string;
  venueCity: string;
  venueDistrict: string;
}

interface ActiveBooking {
  id: string;
  venue_id: string;
  event_id: string;
  booking_date: string;
  booking_time: string;
  participant_count: number;
  event_title?: string;
}

interface VenueAlternative {
  venue: Venue;
  matchScore: number;
  reasons: string[];
}

export default function AdminVenuesPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTimeSlotsDialog, setShowTimeSlotsDialog] = useState(false);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<ActiveBooking | null>(null);
  const [migrationReason, setMigrationReason] = useState("");
  const [filterType, setFilterType] = useState<"all" | "restaurant" | "bar">("all");
  const [viewMode, setViewMode] = useState<"venues" | "calendar">("venues");
  
  // Time slot form state
  const [timeSlotMode, setTimeSlotMode] = useState<"weekly" | "specific">("weekly");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [specificDate, setSpecificDate] = useState("");
  const [timeSlotStart, setTimeSlotStart] = useState("18:00");
  const [timeSlotEnd, setTimeSlotEnd] = useState("22:00");
  const [timeSlotCapacity, setTimeSlotCapacity] = useState("1");
  const [timeSlotNotes, setTimeSlotNotes] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    type: "restaurant",
    address: "",
    city: "深圳",
    district: "",
    contactName: "",
    contactPhone: "",
    commissionRate: "20",
    priceRange: "100-200",
    maxConcurrentEvents: "1",
    tags: [] as string[],
    cuisines: [] as string[],
    decorStyle: [] as string[],
    notes: "",
  });

  const { toast } = useToast();

  const { data: venues = [], isLoading } = useQuery<Venue[]>({
    queryKey: ["/api/admin/venues"],
  });

  // Query for all time slots (for calendar view)
  const { data: allTimeSlots = [], isLoading: allTimeSlotsLoading } = useQuery<AllTimeSlot[]>({
    queryKey: ["/api/admin/time-slots/all"],
    queryFn: () => fetch("/api/admin/time-slots/all", { credentials: "include" }).then(r => r.json()),
    enabled: viewMode === "calendar",
  });

  // Group time slots by day of week for calendar display
  const slotsByDay = useMemo(() => {
    const grouped: Record<number, AllTimeSlot[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    allTimeSlots.forEach(slot => {
      if (slot.dayOfWeek !== null) {
        grouped[slot.dayOfWeek].push(slot);
      }
    });
    return grouped;
  }, [allTimeSlots]);

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/admin/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues"] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: "场地创建成功",
        description: "场地已成功添加到系统",
      });
    },
    onError: () => {
      toast({
        title: "创建失败",
        description: "无法创建场地，请重试",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fetch(`/api/admin/venues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues"] });
      setShowEditDialog(false);
      setSelectedVenue(null);
      toast({
        title: "更新成功",
        description: "场地信息已更新",
      });
    },
    onError: () => {
      toast({
        title: "更新失败",
        description: "无法更新场地，请重试",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/venues/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues"] });
      setShowDeleteDialog(false);
      setSelectedVenue(null);
      toast({
        title: "删除成功",
        description: "场地已从系统中删除",
      });
    },
    onError: () => {
      toast({
        title: "删除失败",
        description: "无法删除场地，请重试",
        variant: "destructive",
      });
    },
  });

  // Time slots query - only fetch when dialog is open and venue is selected
  const { data: timeSlots = [], isLoading: timeSlotsLoading, refetch: refetchTimeSlots } = useQuery<VenueTimeSlot[]>({
    queryKey: ["/api/admin/venues", selectedVenue?.id, "time-slots"],
    queryFn: () => selectedVenue 
      ? fetch(`/api/admin/venues/${selectedVenue.id}/time-slots`, { credentials: "include" }).then(r => r.json())
      : Promise.resolve([]),
    enabled: showTimeSlotsDialog && !!selectedVenue,
  });

  // Create time slot batch mutation
  const createTimeSlotsMutation = useMutation({
    mutationFn: (data: { venueId: string; timeSlots: any[] }) =>
      fetch(`/api/admin/venues/${data.venueId}/time-slots/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ timeSlots: data.timeSlots }),
      }).then((r) => r.json()),
    onSuccess: () => {
      if (selectedVenue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", selectedVenue.id, "time-slots"] });
      }
      resetTimeSlotForm();
      toast({
        title: "时间段创建成功",
        description: "时间段已添加",
      });
    },
    onError: () => {
      toast({
        title: "创建失败",
        description: "无法创建时间段，请重试",
        variant: "destructive",
      });
    },
  });

  // Create single time slot mutation
  const createSingleTimeSlotMutation = useMutation({
    mutationFn: (data: { venueId: string; timeSlot: any }) =>
      fetch(`/api/admin/venues/${data.venueId}/time-slots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data.timeSlot),
      }).then((r) => r.json()),
    onSuccess: () => {
      if (selectedVenue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", selectedVenue.id, "time-slots"] });
      }
      resetTimeSlotForm();
      toast({
        title: "时间段创建成功",
        description: "时间段已添加",
      });
    },
    onError: () => {
      toast({
        title: "创建失败",
        description: "无法创建时间段，请重试",
        variant: "destructive",
      });
    },
  });

  // Delete time slot mutation
  const deleteTimeSlotMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/time-slots/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => {
      if (selectedVenue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", selectedVenue.id, "time-slots"] });
      }
      toast({
        title: "删除成功",
        description: "时间段已删除",
      });
    },
    onError: () => {
      toast({
        title: "删除失败",
        description: "无法删除时间段，请重试",
        variant: "destructive",
      });
    },
  });

  // Toggle time slot active status mutation
  const toggleTimeSlotMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/admin/time-slots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () => {
      if (selectedVenue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", selectedVenue.id, "time-slots"] });
      }
    },
  });

  // Active bookings query for migration
  const { data: activeBookings = [], isLoading: activeBookingsLoading } = useQuery<ActiveBooking[]>({
    queryKey: ["/api/admin/venues", selectedVenue?.id, "active-bookings"],
    queryFn: () => selectedVenue 
      ? fetch(`/api/admin/venues/${selectedVenue.id}/active-bookings`, { credentials: "include" }).then(r => r.json())
      : Promise.resolve([]),
    enabled: showMigrationDialog && !!selectedVenue,
  });

  // Alternative venues query for migration
  const { data: alternatives = [], isLoading: alternativesLoading } = useQuery<VenueAlternative[]>({
    queryKey: ["/api/admin/venues/bookings", selectedBooking?.id, "alternatives"],
    queryFn: () => selectedBooking
      ? fetch(`/api/admin/venues/bookings/${selectedBooking.id}/alternatives`, { credentials: "include" }).then(r => r.json())
      : Promise.resolve([]),
    enabled: !!selectedBooking,
  });

  // Migration mutation
  const migrateMutation = useMutation({
    mutationFn: ({ bookingId, newVenueId, reason }: { bookingId: string; newVenueId: string; reason: string }) =>
      fetch(`/api/admin/venues/bookings/${bookingId}/migrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newVenueId, reason }),
      }).then((r) => {
        if (!r.ok) throw new Error("Migration failed");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues"] });
      if (selectedVenue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", selectedVenue.id, "active-bookings"] });
      }
      setSelectedBooking(null);
      setMigrationReason("");
      toast({ title: "迁移成功", description: "预订已迁移到新场地" });
    },
    onError: () => {
      toast({ title: "迁移失败", description: "无法迁移预订，请重试", variant: "destructive" });
    },
  });

  const handleMigration = (venue: Venue) => {
    setSelectedVenue(venue);
    setShowMigrationDialog(true);
  };

  const executeMigration = (newVenueId: string) => {
    if (!selectedBooking) return;
    migrateMutation.mutate({ bookingId: selectedBooking.id, newVenueId, reason: migrationReason });
  };

  const resetTimeSlotForm = () => {
    setTimeSlotMode("weekly");
    setSelectedDays([]);
    setSpecificDate("");
    setTimeSlotStart("18:00");
    setTimeSlotEnd("22:00");
    setTimeSlotCapacity("1");
    setTimeSlotNotes("");
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "restaurant",
      address: "",
      city: "深圳",
      district: "",
      contactName: "",
      contactPhone: "",
      commissionRate: "20",
      priceRange: "100-200",
      maxConcurrentEvents: "1",
      tags: [],
      cuisines: [],
      decorStyle: [],
      notes: "",
    });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.type || !formData.address || !formData.city || !formData.district) {
      toast({
        title: "信息不完整",
        description: "请填写所有必填字段",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      name: formData.name,
      type: formData.type,
      address: formData.address,
      city: formData.city,
      district: formData.district,
      contactName: formData.contactName || undefined,
      contactPhone: formData.contactPhone || undefined,
      commissionRate: parseInt(formData.commissionRate),
      priceRange: formData.priceRange || undefined,
      maxConcurrentEvents: parseInt(formData.maxConcurrentEvents),
      tags: formData.tags.length > 0 ? formData.tags : undefined,
      cuisines: formData.cuisines.length > 0 ? formData.cuisines : undefined,
      decorStyle: formData.decorStyle.length > 0 ? formData.decorStyle : undefined,
      notes: formData.notes || undefined,
    });
  };

  const handleEdit = (venue: Venue) => {
    setSelectedVenue(venue);
    setFormData({
      name: venue.name,
      type: venue.type,
      address: venue.address,
      city: venue.city,
      district: venue.district,
      contactName: venue.contactName || "",
      contactPhone: venue.contactPhone || "",
      commissionRate: venue.commissionRate.toString(),
      priceRange: venue.priceRange || "100-200",
      maxConcurrentEvents: venue.maxConcurrentEvents.toString(),
      tags: venue.tags || [],
      cuisines: venue.cuisines || [],
      decorStyle: venue.decorStyle || [],
      notes: venue.notes || "",
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!selectedVenue) return;

    updateMutation.mutate({
      id: selectedVenue.id,
      data: {
        name: formData.name,
        type: formData.type,
        address: formData.address,
        city: formData.city,
        district: formData.district,
        contactName: formData.contactName || null,
        contactPhone: formData.contactPhone || null,
        commissionRate: parseInt(formData.commissionRate),
        priceRange: formData.priceRange || null,
        maxConcurrentEvents: parseInt(formData.maxConcurrentEvents),
        tags: formData.tags.length > 0 ? formData.tags : null,
        cuisines: formData.cuisines.length > 0 ? formData.cuisines : null,
        decorStyle: formData.decorStyle.length > 0 ? formData.decorStyle : null,
        notes: formData.notes || null,
      },
    });
  };

  const handleDelete = (venue: Venue) => {
    setSelectedVenue(venue);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (selectedVenue) {
      deleteMutation.mutate(selectedVenue.id);
    }
  };

  const toggleActive = (venue: Venue) => {
    updateMutation.mutate({
      id: venue.id,
      data: { isActive: !venue.isActive },
    });
  };

  const toggleTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const toggleCuisine = (cuisine: string) => {
    setFormData(prev => ({
      ...prev,
      cuisines: prev.cuisines.includes(cuisine)
        ? prev.cuisines.filter(c => c !== cuisine)
        : [...prev.cuisines, cuisine]
    }));
  };

  const toggleDecorStyle = (style: string) => {
    setFormData(prev => ({
      ...prev,
      decorStyle: prev.decorStyle.includes(style)
        ? prev.decorStyle.filter(s => s !== style)
        : [...prev.decorStyle, style]
    }));
  };

  const handleManageTimeSlots = (venue: Venue) => {
    setSelectedVenue(venue);
    resetTimeSlotForm();
    setShowTimeSlotsDialog(true);
  };

  const toggleDay = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day]
    );
  };

  const handleCreateTimeSlots = () => {
    if (!selectedVenue) return;

    if (timeSlotMode === "weekly") {
      if (selectedDays.length === 0) {
        toast({
          title: "请选择日期",
          description: "请至少选择一个星期几",
          variant: "destructive",
        });
        return;
      }

      const timeSlotData = selectedDays.map(day => ({
        dayOfWeek: day,
        specificDate: null,
        startTime: timeSlotStart,
        endTime: timeSlotEnd,
        maxConcurrentEvents: parseInt(timeSlotCapacity),
        notes: timeSlotNotes || null,
      }));

      createTimeSlotsMutation.mutate({
        venueId: selectedVenue.id,
        timeSlots: timeSlotData,
      });
    } else {
      if (!specificDate) {
        toast({
          title: "请选择日期",
          description: "请输入具体日期",
          variant: "destructive",
        });
        return;
      }

      createSingleTimeSlotMutation.mutate({
        venueId: selectedVenue.id,
        timeSlot: {
          dayOfWeek: null,
          specificDate,
          startTime: timeSlotStart,
          endTime: timeSlotEnd,
          maxConcurrentEvents: parseInt(timeSlotCapacity),
          notes: timeSlotNotes || null,
        },
      });
    }
  };

  const getDayLabel = (day: number) => {
    return DAYS_OF_WEEK.find(d => d.value === day)?.label || `Day ${day}`;
  };

  const getTypeLabel = (type: string) => {
    return VENUE_TYPES.find(t => t.value === type)?.label || type;
  };

  const filteredVenues = filterType === "all" 
    ? venues 
    : venues.filter(v => v.type === filterType);

  const activeVenues = venues.filter(v => v.isActive).length;
  const totalBookings = venues.reduce((sum, v) => sum + (v.bookingCount || 0), 0);
  const totalCommission = venues.reduce((sum, v) => sum + (v.totalCommission || 0), 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">场地管理</h1>
          <p className="text-muted-foreground mt-1">管理活动场地和合作商户</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} data-testid="button-create-venue">
          <Plus className="h-4 w-4 mr-2" />
          添加场地
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总场地数</CardTitle>
            <Store className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-total-venues">{venues.length}</div>
            <p className="text-xs text-muted-foreground">平台合作场地</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃场地</CardTitle>
            <Building className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-active-venues">{activeVenues}</div>
            <p className="text-xs text-muted-foreground">当前可用场地</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总预订数</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-total-bookings">{totalBookings}</div>
            <p className="text-xs text-muted-foreground">累计预订次数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">佣金收入</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-commission-earned">¥{totalCommission.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">累计佣金</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <TabsList>
            <TabsTrigger value="all" data-testid="filter-all">全部</TabsTrigger>
            <TabsTrigger value="restaurant" data-testid="filter-restaurant">餐厅</TabsTrigger>
            <TabsTrigger value="bar" data-testid="filter-bar">酒吧</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex gap-2">
          <Button
            variant={viewMode === "venues" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("venues")}
            data-testid="view-venues"
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            场地列表
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("calendar")}
            data-testid="view-calendar"
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            时间总览
          </Button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              每周时间段容量一览
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allTimeSlotsLoading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : allTimeSlots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">暂无时间段数据，请先在各场地添加时间段</div>
            ) : (
              <ScrollArea className="w-full">
                <div className="min-w-[800px]">
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <div key={day.value} className="text-center">
                        <div className="font-semibold py-2 bg-muted rounded-t-md">{day.label}</div>
                        <div className="border rounded-b-md min-h-[200px] p-2 space-y-2">
                          {slotsByDay[day.value].length === 0 ? (
                            <div className="text-xs text-muted-foreground py-4">无时间段</div>
                          ) : (
                            slotsByDay[day.value].map(slot => (
                              <div 
                                key={slot.id} 
                                className="p-2 bg-primary/10 rounded text-xs space-y-1"
                                data-testid={`calendar-slot-${slot.id}`}
                              >
                                <div className="font-medium truncate" title={slot.venueName}>
                                  {slot.venueName}
                                </div>
                                <div className="text-muted-foreground">
                                  {slot.startTime} - {slot.endTime}
                                </div>
                                <Badge variant="secondary" className="text-[10px]">
                                  容量: {slot.maxConcurrentEvents}
                                </Badge>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredVenues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {filterType === "all" ? "暂无场地记录" : `暂无${getTypeLabel(filterType)}记录`}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVenues.map((venue) => (
            <Card key={venue.id} data-testid={`card-venue-${venue.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {venue.name}
                    <Badge variant="outline">{getTypeLabel(venue.type)}</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground truncate">{venue.city} · {venue.district}</p>
                </div>
                {venue.isActive ? (
                  <Badge className="bg-green-500">活跃</Badge>
                ) : (
                  <Badge variant="secondary">已停用</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">地址</span>
                    <span className="font-medium text-right truncate max-w-[60%]">{venue.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">佣金比例</span>
                    <span className="font-medium">{venue.commissionRate}%</span>
                  </div>
                  {venue.priceRange && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">人均消费</span>
                      <span className="font-medium">¥{venue.priceRange}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">预订次数</span>
                    <span className="font-medium">{venue.bookingCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">总佣金</span>
                    <span className="font-medium">¥{(venue.totalCommission || 0).toLocaleString()}</span>
                  </div>
                </div>

                {venue.tags && venue.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {venue.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}

                {venue.cuisines && venue.cuisines.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {venue.cuisines.map(cuisine => (
                      <Badge key={cuisine} variant="outline" className="text-xs">{cuisine}</Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={venue.isActive}
                      onCheckedChange={() => toggleActive(venue)}
                      data-testid={`toggle-active-${venue.id}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {venue.isActive ? "活跃" : "停用"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleManageTimeSlots(venue)}
                      data-testid={`button-timeslots-${venue.id}`}
                      title="管理时间段"
                    >
                      <Clock className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMigration(venue)}
                      data-testid={`button-migrate-${venue.id}`}
                      title="应急迁移"
                      className="text-orange-600 border-orange-300 hover:bg-orange-50"
                    >
                      <ArrowRightLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(venue)}
                      data-testid={`button-edit-${venue.id}`}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(venue)}
                      data-testid={`button-delete-${venue.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>添加场地</DialogTitle>
            <DialogDescription>创建新的活动场地</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">场地名称 *</Label>
                <Input
                  id="name"
                  placeholder="例：海底捞火锅"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">场地类型 *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENUE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">地址 *</Label>
              <Textarea
                id="address"
                placeholder="详细地址"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                data-testid="input-address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">城市 *</Label>
                <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                  <SelectTrigger data-testid="select-city">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map(city => (
                      <SelectItem key={city.value} value={city.value}>{city.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="district">区域 *</Label>
                <Input
                  id="district"
                  placeholder="例：南山区"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  data-testid="input-district"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">联系人</Label>
                <Input
                  id="contactName"
                  placeholder="联系人姓名"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  data-testid="input-contact-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">联系电话</Label>
                <Input
                  id="contactPhone"
                  placeholder="联系电话"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  data-testid="input-contact-phone"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commissionRate">佣金比例 (%)</Label>
                <Input
                  id="commissionRate"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.commissionRate}
                  onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                  data-testid="input-commission-rate"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priceRange">人均消费</Label>
                <Select value={formData.priceRange} onValueChange={(v) => setFormData({ ...formData, priceRange: v })}>
                  <SelectTrigger data-testid="select-price-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_RANGES.map(range => (
                      <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxConcurrentEvents">最大同时活动数</Label>
                <Input
                  id="maxConcurrentEvents"
                  type="number"
                  min="1"
                  value={formData.maxConcurrentEvents}
                  onChange={(e) => setFormData({ ...formData, maxConcurrentEvents: e.target.value })}
                  data-testid="input-max-events"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>氛围标签</Label>
              <div className="flex flex-wrap gap-2">
                {TAGS.map(tag => (
                  <Badge
                    key={tag}
                    variant={formData.tags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate active-elevate-2"
                    onClick={() => toggleTag(tag)}
                    data-testid={`tag-${tag}`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>菜系类型</Label>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map(cuisine => (
                  <Badge
                    key={cuisine}
                    variant={formData.cuisines.includes(cuisine) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate active-elevate-2"
                    onClick={() => toggleCuisine(cuisine)}
                    data-testid={`cuisine-${cuisine}`}
                  >
                    {cuisine}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>装修风格</Label>
              <div className="flex flex-wrap gap-2">
                {DECOR_STYLES.map(style => (
                  <Badge
                    key={style}
                    variant={formData.decorStyle.includes(style) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate active-elevate-2"
                    onClick={() => toggleDecorStyle(style)}
                    data-testid={`decorStyle-${style}`}
                  >
                    {style}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">备注</Label>
              <Textarea
                id="notes"
                placeholder="内部备注信息"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                data-testid="input-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }} data-testid="button-cancel">
              取消
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-venue">
              {createMutation.isPending ? "创建中..." : "创建场地"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑场地</DialogTitle>
            <DialogDescription>修改场地信息</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">场地名称 *</Label>
                <Input
                  id="edit-name"
                  placeholder="例：海底捞火锅"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-edit-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-type">场地类型 *</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger data-testid="select-edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENUE_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">地址 *</Label>
              <Textarea
                id="edit-address"
                placeholder="详细地址"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                data-testid="input-edit-address"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-city">城市 *</Label>
                <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                  <SelectTrigger data-testid="select-edit-city">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CITIES.map(city => (
                      <SelectItem key={city.value} value={city.value}>{city.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-district">区域 *</Label>
                <Input
                  id="edit-district"
                  placeholder="例：南山区"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  data-testid="input-edit-district"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-contactName">联系人</Label>
                <Input
                  id="edit-contactName"
                  placeholder="联系人姓名"
                  value={formData.contactName}
                  onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  data-testid="input-edit-contact-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-contactPhone">联系电话</Label>
                <Input
                  id="edit-contactPhone"
                  placeholder="联系电话"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  data-testid="input-edit-contact-phone"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-commissionRate">佣金比例 (%)</Label>
                <Input
                  id="edit-commissionRate"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.commissionRate}
                  onChange={(e) => setFormData({ ...formData, commissionRate: e.target.value })}
                  data-testid="input-edit-commission-rate"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-priceRange">人均消费</Label>
                <Select value={formData.priceRange} onValueChange={(v) => setFormData({ ...formData, priceRange: v })}>
                  <SelectTrigger data-testid="select-edit-price-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_RANGES.map(range => (
                      <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-maxConcurrentEvents">最大同时活动数</Label>
                <Input
                  id="edit-maxConcurrentEvents"
                  type="number"
                  min="1"
                  value={formData.maxConcurrentEvents}
                  onChange={(e) => setFormData({ ...formData, maxConcurrentEvents: e.target.value })}
                  data-testid="input-edit-max-events"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>氛围标签</Label>
              <div className="flex flex-wrap gap-2">
                {TAGS.map(tag => (
                  <Badge
                    key={tag}
                    variant={formData.tags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate active-elevate-2"
                    onClick={() => toggleTag(tag)}
                    data-testid={`edit-tag-${tag}`}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>菜系类型</Label>
              <div className="flex flex-wrap gap-2">
                {CUISINES.map(cuisine => (
                  <Badge
                    key={cuisine}
                    variant={formData.cuisines.includes(cuisine) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate active-elevate-2"
                    onClick={() => toggleCuisine(cuisine)}
                    data-testid={`edit-cuisine-${cuisine}`}
                  >
                    {cuisine}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>装修风格</Label>
              <div className="flex flex-wrap gap-2">
                {DECOR_STYLES.map(style => (
                  <Badge
                    key={style}
                    variant={formData.decorStyle.includes(style) ? "default" : "outline"}
                    className="cursor-pointer hover-elevate active-elevate-2"
                    onClick={() => toggleDecorStyle(style)}
                    data-testid={`edit-decorStyle-${style}`}
                  >
                    {style}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">备注</Label>
              <Textarea
                id="edit-notes"
                placeholder="内部备注信息"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                data-testid="input-edit-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} data-testid="button-cancel-edit">
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-submit-edit">
              {updateMutation.isPending ? "更新中..." : "更新场地"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除场地 "{selectedVenue?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showTimeSlotsDialog} onOpenChange={setShowTimeSlotsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>管理时间段 - {selectedVenue?.name}</DialogTitle>
            <DialogDescription>设置场地可用时间段，支持每周固定或特定日期</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">添加时间段</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={timeSlotMode} onValueChange={(v) => setTimeSlotMode(v as "weekly" | "specific")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="weekly" data-testid="tab-weekly">每周固定</TabsTrigger>
                    <TabsTrigger value="specific" data-testid="tab-specific">特定日期</TabsTrigger>
                  </TabsList>
                </Tabs>

                {timeSlotMode === "weekly" ? (
                  <div className="space-y-3">
                    <Label>选择星期 (可多选)</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map(day => (
                        <Badge
                          key={day.value}
                          variant={selectedDays.includes(day.value) ? "default" : "outline"}
                          className="cursor-pointer hover-elevate active-elevate-2"
                          onClick={() => toggleDay(day.value)}
                          data-testid={`day-${day.value}`}
                        >
                          {day.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="specific-date">具体日期</Label>
                    <Input
                      id="specific-date"
                      type="date"
                      value={specificDate}
                      onChange={(e) => setSpecificDate(e.target.value)}
                      data-testid="input-specific-date"
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-time">开始时间</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={timeSlotStart}
                      onChange={(e) => setTimeSlotStart(e.target.value)}
                      data-testid="input-start-time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end-time">结束时间</Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={timeSlotEnd}
                      onChange={(e) => setTimeSlotEnd(e.target.value)}
                      data-testid="input-end-time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacity">可容纳活动数</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      value={timeSlotCapacity}
                      onChange={(e) => setTimeSlotCapacity(e.target.value)}
                      data-testid="input-capacity"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slot-notes">备注 (可选)</Label>
                  <Input
                    id="slot-notes"
                    placeholder="如：周末人流量大"
                    value={timeSlotNotes}
                    onChange={(e) => setTimeSlotNotes(e.target.value)}
                    data-testid="input-slot-notes"
                  />
                </div>

                <Button 
                  onClick={handleCreateTimeSlots}
                  disabled={createTimeSlotsMutation.isPending || createSingleTimeSlotMutation.isPending}
                  data-testid="button-add-timeslot"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createTimeSlotsMutation.isPending || createSingleTimeSlotMutation.isPending 
                    ? "添加中..." 
                    : timeSlotMode === "weekly" 
                      ? `添加 ${selectedDays.length} 个时间段`
                      : "添加时间段"
                  }
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">已设置的时间段</CardTitle>
              </CardHeader>
              <CardContent>
                {timeSlotsLoading ? (
                  <div className="text-center py-4 text-muted-foreground">加载中...</div>
                ) : timeSlots.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">暂无时间段，请添加</div>
                ) : (
                  <div className="space-y-2">
                    {timeSlots.map((slot) => (
                      <div 
                        key={slot.id} 
                        className="flex items-center justify-between p-3 border rounded-md"
                        data-testid={`timeslot-${slot.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="min-w-[80px]">
                            {slot.dayOfWeek !== null ? (
                              <Badge variant="outline">{getDayLabel(slot.dayOfWeek)}</Badge>
                            ) : (
                              <Badge variant="secondary">{slot.specificDate}</Badge>
                            )}
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">{slot.startTime} - {slot.endTime}</span>
                            <span className="text-muted-foreground ml-2">
                              (容量: {slot.maxConcurrentEvents})
                            </span>
                          </div>
                          {slot.notes && (
                            <span className="text-xs text-muted-foreground">{slot.notes}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={slot.isActive}
                            onCheckedChange={(checked) => 
                              toggleTimeSlotMutation.mutate({ id: slot.id, isActive: checked })
                            }
                            data-testid={`toggle-slot-${slot.id}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteTimeSlotMutation.mutate(slot.id)}
                            disabled={deleteTimeSlotMutation.isPending}
                            data-testid={`delete-slot-${slot.id}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTimeSlotsDialog(false)} data-testid="button-close-timeslots">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMigrationDialog} onOpenChange={(open) => { setShowMigrationDialog(open); if (!open) { setSelectedBooking(null); setMigrationReason(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              应急场地迁移 - {selectedVenue?.name}
            </DialogTitle>
            <DialogDescription>
              将此场地的活动预订迁移到其他可用场地
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {activeBookingsLoading ? (
              <div className="text-center py-4 text-muted-foreground">加载中...</div>
            ) : activeBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                此场地没有待迁移的活动预订
              </div>
            ) : (
              <div className="space-y-2">
                <Label>选择需要迁移的预订</Label>
                <div className="border rounded-lg divide-y">
                  {activeBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className={`p-3 cursor-pointer transition-colors ${selectedBooking?.id === booking.id ? 'bg-orange-50 border-orange-200' : 'hover:bg-muted/50'}`}
                      onClick={() => setSelectedBooking(booking)}
                      data-testid={`booking-${booking.id}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium">{booking.event_title || `活动 #${booking.event_id.slice(0,8)}`}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(booking.booking_date).toLocaleDateString('zh-CN')} {booking.booking_time} · {booking.participant_count}人
                          </div>
                        </div>
                        {selectedBooking?.id === booking.id && (
                          <Badge className="bg-orange-500">已选择</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedBooking && (
              <>
                <div className="space-y-2">
                  <Label>迁移原因</Label>
                  <Input
                    placeholder="例：场地临时装修、商家取消合作等"
                    value={migrationReason}
                    onChange={(e) => setMigrationReason(e.target.value)}
                    data-testid="input-migration-reason"
                  />
                </div>

                <div className="space-y-2">
                  <Label>可用替代场地</Label>
                  {alternativesLoading ? (
                    <div className="text-center py-4 text-muted-foreground">搜索中...</div>
                  ) : alternatives.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground border rounded-lg">
                      没有找到符合条件的替代场地
                    </div>
                  ) : (
                    <div className="border rounded-lg divide-y">
                      {alternatives.map((alt) => (
                        <div key={alt.venue.id} className="p-3 flex justify-between items-center">
                          <div>
                            <div className="font-medium">{alt.venue.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {alt.venue.city} {alt.venue.district} · 匹配度 {alt.matchScore}%
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {alt.reasons.slice(0, 2).map((r, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                              ))}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => executeMigration(alt.venue.id)}
                            disabled={migrateMutation.isPending}
                            data-testid={`migrate-to-${alt.venue.id}`}
                          >
                            迁移至此
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMigrationDialog(false)} data-testid="button-close-migration">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
