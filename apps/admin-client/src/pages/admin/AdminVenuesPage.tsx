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
import { Store, Plus, Edit, Trash2, Building, TrendingUp, Calendar, DollarSign, Clock, X, CalendarDays, LayoutGrid, AlertTriangle, ArrowRightLeft, Gift, Percent, Tag, CircleDollarSign, Eye, EyeOff, MapPin } from "lucide-react";
import { shenzhenClusters, getDistrictsByCluster, getDistrictById, getClusterById } from "@shared/districts";
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
  clusterId: string | null;
  districtId: string | null;
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
  // 酒吧特有字段
  barThemes: string[] | null;
  alcoholOptions: string[] | null;
  vibeDescriptor: string | null;
}

const VENUE_TYPES = [
  { value: "restaurant", label: "餐厅" },
  { value: "bar", label: "酒吧" },
];

const CITIES = [
  { value: "深圳", label: "深圳" },
  { value: "香港", label: "香港" },
];

// 餐厅价格范围（人均）
const RESTAURANT_PRICE_RANGES = [
  { value: "150以下", label: "¥150以下/人" },
  { value: "150-200", label: "¥150-200/人" },
  { value: "200-300", label: "¥200-300/人" },
  { value: "300-500", label: "¥300-500/人" },
];

// 酒吧价格范围（每杯）
const BAR_PRICE_RANGES = [
  { value: "80以下", label: "¥80以下/杯" },
  { value: "80-150", label: "¥80-150/杯" },
];

// 兼容旧数据
const PRICE_RANGES = RESTAURANT_PRICE_RANGES;

const TAGS = ["cozy", "lively", "upscale", "casual"];
// 餐厅专属菜系（移除"酒吧"）
const CUISINES = ["粤菜", "川菜", "日料", "西餐", "火锅", "烧烤", "东南亚菜", "融合菜"];
const DECOR_STYLES = ["轻奢现代风", "绿植花园风", "复古工业风", "温馨日式风"];

// 酒吧特有选项
const BAR_THEMES = ["精酿", "清吧", "鸡尾酒吧", "Whisky Bar", "Wine Bar"];
const ALCOHOL_OPTIONS = ["可以喝酒", "微醺就好", "无酒精饮品"];

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

interface VenueDeal {
  id: string;
  venueId: string;
  title: string;
  discountType: "percentage" | "fixed" | "gift";
  discountValue: number | null;
  description: string | null;
  redemptionMethod: "show_page" | "code" | "qr_code";
  redemptionCode: string | null;
  minSpend: number | null;
  maxDiscount: number | null;
  perPersonLimit: boolean;
  validFrom: string | null;
  validUntil: string | null;
  terms: string | null;
  excludedDates: string[] | null;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}

const DISCOUNT_TYPES = [
  { value: "percentage", label: "折扣", icon: Percent },
  { value: "fixed", label: "立减", icon: CircleDollarSign },
  { value: "gift", label: "赠品", icon: Gift },
];

const REDEMPTION_METHODS = [
  { value: "show_page", label: "出示本页面" },
  { value: "code", label: "报暗号" },
  { value: "qr_code", label: "扫码核销" },
];

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
  
  // Venue deals state
  const [showDealsDialog, setShowDealsDialog] = useState(false);
  const [showDealFormDialog, setShowDealFormDialog] = useState(false);
  const [editingDeal, setEditingDeal] = useState<VenueDeal | null>(null);
  const [dealFilterStatus, setDealFilterStatus] = useState<"all" | "active" | "inactive" | "expired">("all");
  const [dealFormData, setDealFormData] = useState({
    title: "",
    discountType: "percentage" as "percentage" | "fixed" | "gift",
    discountValue: "",
    description: "",
    redemptionMethod: "show_page" as "show_page" | "code" | "qr_code",
    redemptionCode: "",
    minSpend: "",
    maxDiscount: "",
    perPersonLimit: false,
    validFrom: "",
    validUntil: "",
    terms: "",
  });
  
  const [formData, setFormData] = useState({
    name: "",
    type: "restaurant",
    address: "",
    city: "深圳",
    district: "",
    clusterId: "",
    districtId: "",
    contactName: "",
    contactPhone: "",
    commissionRate: "20",
    priceRange: "100-200",
    maxConcurrentEvents: "1",
    tags: [] as string[],
    cuisines: [] as string[],
    decorStyle: [] as string[],
    notes: "",
    // 酒吧特有字段
    barThemes: [] as string[],
    alcoholOptions: [] as string[],
    vibeDescriptor: "",
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

  // ============ VENUE DEALS ============
  
  // Query venue deals
  const { data: venueDeals = [], isLoading: venueDealsLoading } = useQuery<VenueDeal[]>({
    queryKey: ["/api/admin/venues", selectedVenue?.id, "deals"],
    queryFn: () => selectedVenue 
      ? fetch(`/api/admin/venues/${selectedVenue.id}/deals`, { credentials: "include" }).then(r => r.json())
      : Promise.resolve([]),
    enabled: showDealsDialog && !!selectedVenue,
  });

  // Filter deals by status
  const filteredDeals = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return venueDeals.filter(deal => {
      if (dealFilterStatus === "all") return true;
      if (dealFilterStatus === "active") return deal.isActive && (!deal.validUntil || deal.validUntil >= today);
      if (dealFilterStatus === "inactive") return !deal.isActive;
      if (dealFilterStatus === "expired") return deal.validUntil && deal.validUntil < today;
      return true;
    });
  }, [venueDeals, dealFilterStatus]);

  // Create deal mutation
  const createDealMutation = useMutation({
    mutationFn: (data: any) =>
      fetch(`/api/admin/venues/${selectedVenue?.id}/deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      if (selectedVenue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", selectedVenue.id, "deals"] });
      }
      setShowDealFormDialog(false);
      resetDealForm();
      toast({ title: "优惠创建成功", description: "优惠已添加到场地" });
    },
    onError: () => {
      toast({ title: "创建失败", description: "无法创建优惠，请重试", variant: "destructive" });
    },
  });

  // Update deal mutation
  const updateDealMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fetch(`/api/admin/venue-deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      if (selectedVenue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", selectedVenue.id, "deals"] });
      }
      setShowDealFormDialog(false);
      setEditingDeal(null);
      resetDealForm();
      toast({ title: "更新成功", description: "优惠信息已更新" });
    },
    onError: () => {
      toast({ title: "更新失败", description: "无法更新优惠，请重试", variant: "destructive" });
    },
  });

  // Delete deal mutation
  const deleteDealMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/venue-deals/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => {
      if (selectedVenue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", selectedVenue.id, "deals"] });
      }
      toast({ title: "删除成功", description: "优惠已删除" });
    },
    onError: () => {
      toast({ title: "删除失败", description: "无法删除优惠，请重试", variant: "destructive" });
    },
  });

  // Toggle deal active status
  const toggleDealMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/admin/venue-deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()),
    onSuccess: () => {
      if (selectedVenue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", selectedVenue.id, "deals"] });
      }
    },
  });

  const resetDealForm = () => {
    setDealFormData({
      title: "",
      discountType: "percentage",
      discountValue: "",
      description: "",
      redemptionMethod: "show_page",
      redemptionCode: "",
      minSpend: "",
      maxDiscount: "",
      perPersonLimit: false,
      validFrom: "",
      validUntil: "",
      terms: "",
    });
  };

  const handleManageDeals = (venue: Venue) => {
    setSelectedVenue(venue);
    setShowDealsDialog(true);
  };

  const handleCreateDeal = () => {
    setEditingDeal(null);
    resetDealForm();
    // Set default dates (today to 1 year from now)
    const today = new Date().toISOString().split('T')[0];
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDealFormData(prev => ({ ...prev, validFrom: today, validUntil: nextYear }));
    setShowDealFormDialog(true);
  };

  const handleEditDeal = (deal: VenueDeal) => {
    setEditingDeal(deal);
    setDealFormData({
      title: deal.title,
      discountType: deal.discountType,
      discountValue: deal.discountValue?.toString() || "",
      description: deal.description || "",
      redemptionMethod: deal.redemptionMethod,
      redemptionCode: deal.redemptionCode || "",
      minSpend: deal.minSpend?.toString() || "",
      maxDiscount: deal.maxDiscount?.toString() || "",
      perPersonLimit: deal.perPersonLimit,
      validFrom: deal.validFrom || "",
      validUntil: deal.validUntil || "",
      terms: deal.terms || "",
    });
    setShowDealFormDialog(true);
  };

  const handleSubmitDeal = () => {
    if (!dealFormData.title) {
      toast({ title: "请填写优惠标题", variant: "destructive" });
      return;
    }
    
    const dealData = {
      title: dealFormData.title,
      discountType: dealFormData.discountType,
      discountValue: dealFormData.discountValue ? parseInt(dealFormData.discountValue) : null,
      description: dealFormData.description || null,
      redemptionMethod: dealFormData.redemptionMethod,
      redemptionCode: dealFormData.redemptionCode || null,
      minSpend: dealFormData.minSpend ? parseInt(dealFormData.minSpend) : null,
      maxDiscount: dealFormData.maxDiscount ? parseInt(dealFormData.maxDiscount) : null,
      perPersonLimit: dealFormData.perPersonLimit,
      validFrom: dealFormData.validFrom || null,
      validUntil: dealFormData.validUntil || null,
      terms: dealFormData.terms || null,
    };
    
    if (editingDeal) {
      updateDealMutation.mutate({ id: editingDeal.id, data: dealData });
    } else {
      createDealMutation.mutate(dealData);
    }
  };

  const formatDiscountText = (deal: VenueDeal): string => {
    switch (deal.discountType) {
      case "percentage":
        return `${100 - (deal.discountValue || 0)}折`;
      case "fixed":
        return `立减¥${deal.discountValue}`;
      case "gift":
        return "赠品福利";
      default:
        return "专属优惠";
    }
  };

  const getDealStatus = (deal: VenueDeal): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    const today = new Date().toISOString().split('T')[0];
    if (!deal.isActive) return { label: "已停用", variant: "secondary" };
    if (deal.validUntil && deal.validUntil < today) return { label: "已过期", variant: "destructive" };
    if (deal.validFrom && deal.validFrom > today) return { label: "未开始", variant: "outline" };
    return { label: "生效中", variant: "default" };
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
      clusterId: "",
      districtId: "",
      contactName: "",
      contactPhone: "",
      commissionRate: "20",
      priceRange: "100-200",
      maxConcurrentEvents: "1",
      tags: [],
      cuisines: [],
      decorStyle: [],
      notes: "",
      barThemes: [],
      alcoholOptions: [],
      vibeDescriptor: "",
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
      clusterId: formData.clusterId || undefined,
      districtId: formData.districtId || undefined,
      contactName: formData.contactName || undefined,
      contactPhone: formData.contactPhone || undefined,
      commissionRate: parseInt(formData.commissionRate),
      priceRange: formData.priceRange || undefined,
      maxConcurrentEvents: parseInt(formData.maxConcurrentEvents),
      tags: formData.tags.length > 0 ? formData.tags : undefined,
      cuisines: formData.cuisines.length > 0 ? formData.cuisines : undefined,
      decorStyle: formData.decorStyle.length > 0 ? formData.decorStyle : undefined,
      notes: formData.notes || undefined,
      // 酒吧特有字段
      barThemes: formData.barThemes.length > 0 ? formData.barThemes : undefined,
      alcoholOptions: formData.alcoholOptions.length > 0 ? formData.alcoholOptions : undefined,
      vibeDescriptor: formData.vibeDescriptor || undefined,
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
      clusterId: venue.clusterId || "",
      districtId: venue.districtId || "",
      contactName: venue.contactName || "",
      contactPhone: venue.contactPhone || "",
      commissionRate: venue.commissionRate.toString(),
      priceRange: venue.priceRange || "100-200",
      maxConcurrentEvents: venue.maxConcurrentEvents.toString(),
      tags: venue.tags || [],
      cuisines: venue.cuisines || [],
      decorStyle: venue.decorStyle || [],
      notes: venue.notes || "",
      barThemes: venue.barThemes || [],
      alcoholOptions: venue.alcoholOptions || [],
      vibeDescriptor: venue.vibeDescriptor || "",
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
        clusterId: formData.clusterId || null,
        districtId: formData.districtId || null,
        contactName: formData.contactName || null,
        contactPhone: formData.contactPhone || null,
        commissionRate: parseInt(formData.commissionRate),
        priceRange: formData.priceRange || null,
        maxConcurrentEvents: parseInt(formData.maxConcurrentEvents),
        tags: formData.tags.length > 0 ? formData.tags : null,
        cuisines: formData.cuisines.length > 0 ? formData.cuisines : null,
        decorStyle: formData.decorStyle.length > 0 ? formData.decorStyle : null,
        notes: formData.notes || null,
        // 酒吧特有字段
        barThemes: formData.barThemes.length > 0 ? formData.barThemes : null,
        alcoholOptions: formData.alcoholOptions.length > 0 ? formData.alcoholOptions : null,
        vibeDescriptor: formData.vibeDescriptor || null,
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

  const toggleBarTheme = (theme: string) => {
    setFormData(prev => ({
      ...prev,
      barThemes: prev.barThemes.includes(theme)
        ? prev.barThemes.filter(t => t !== theme)
        : [...prev.barThemes, theme]
    }));
  };

  const toggleAlcoholOption = (option: string) => {
    setFormData(prev => ({
      ...prev,
      alcoholOptions: prev.alcoholOptions.includes(option)
        ? prev.alcoholOptions.filter(o => o !== option)
        : [...prev.alcoholOptions, option]
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
                      onClick={() => handleManageDeals(venue)}
                      data-testid={`button-deals-${venue.id}`}
                      title="管理优惠"
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    >
                      <Tag className="h-3 w-3" />
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

            {formData.city === "深圳" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clusterId" className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    片区
                  </Label>
                  <Select 
                    value={formData.clusterId} 
                    onValueChange={(v) => setFormData({ ...formData, clusterId: v, districtId: "" })}
                  >
                    <SelectTrigger data-testid="select-cluster">
                      <SelectValue placeholder="选择片区" />
                    </SelectTrigger>
                    <SelectContent>
                      {shenzhenClusters.map(cluster => (
                        <SelectItem key={cluster.id} value={cluster.id}>{cluster.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="districtId">商圈</Label>
                  <Select 
                    value={formData.districtId} 
                    onValueChange={(v) => setFormData({ ...formData, districtId: v })}
                    disabled={!formData.clusterId}
                  >
                    <SelectTrigger data-testid="select-district-id">
                      <SelectValue placeholder={formData.clusterId ? "选择商圈" : "请先选择片区"} />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.clusterId && getDistrictsByCluster(formData.clusterId).map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

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
                <Label htmlFor="priceRange">{formData.type === "bar" ? "人均消费(每杯)" : "人均消费"}</Label>
                <Select value={formData.priceRange} onValueChange={(v) => setFormData({ ...formData, priceRange: v })}>
                  <SelectTrigger data-testid="select-price-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(formData.type === "bar" ? BAR_PRICE_RANGES : RESTAURANT_PRICE_RANGES).map(range => (
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

            {/* 餐厅专属：菜系类型 */}
            {formData.type === "restaurant" && (
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
            )}

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

            {/* 酒吧特有字段 - 仅当类型为酒吧时显示 */}
            {formData.type === "bar" && (
              <>
                <div className="space-y-2">
                  <Label>酒吧主题</Label>
                  <div className="flex flex-wrap gap-2">
                    {BAR_THEMES.map(theme => (
                      <Badge
                        key={theme}
                        variant={formData.barThemes.includes(theme) ? "default" : "outline"}
                        className="cursor-pointer hover-elevate active-elevate-2"
                        onClick={() => toggleBarTheme(theme)}
                        data-testid={`barTheme-${theme}`}
                      >
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>支持的饮酒选项</Label>
                  <div className="flex flex-wrap gap-2">
                    {ALCOHOL_OPTIONS.map(option => (
                      <Badge
                        key={option}
                        variant={formData.alcoholOptions.includes(option) ? "default" : "outline"}
                        className="cursor-pointer hover-elevate active-elevate-2"
                        onClick={() => toggleAlcoholOption(option)}
                        data-testid={`alcoholOption-${option}`}
                      >
                        {option}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vibeDescriptor">氛围描述</Label>
                  <Input
                    id="vibeDescriptor"
                    placeholder="例：适合安静聊天、轻松社交氛围"
                    value={formData.vibeDescriptor}
                    onChange={(e) => setFormData({ ...formData, vibeDescriptor: e.target.value })}
                    data-testid="input-vibeDescriptor"
                  />
                </div>
              </>
            )}

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

            {formData.city === "深圳" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-clusterId" className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    片区
                  </Label>
                  <Select 
                    value={formData.clusterId} 
                    onValueChange={(v) => setFormData({ ...formData, clusterId: v, districtId: "" })}
                  >
                    <SelectTrigger data-testid="select-edit-cluster">
                      <SelectValue placeholder="选择片区" />
                    </SelectTrigger>
                    <SelectContent>
                      {shenzhenClusters.map(cluster => (
                        <SelectItem key={cluster.id} value={cluster.id}>{cluster.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-districtId">商圈</Label>
                  <Select 
                    value={formData.districtId} 
                    onValueChange={(v) => setFormData({ ...formData, districtId: v })}
                    disabled={!formData.clusterId}
                  >
                    <SelectTrigger data-testid="select-edit-district-id">
                      <SelectValue placeholder={formData.clusterId ? "选择商圈" : "请先选择片区"} />
                    </SelectTrigger>
                    <SelectContent>
                      {formData.clusterId && getDistrictsByCluster(formData.clusterId).map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

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
                <Label htmlFor="edit-priceRange">{formData.type === "bar" ? "人均消费(每杯)" : "人均消费"}</Label>
                <Select value={formData.priceRange} onValueChange={(v) => setFormData({ ...formData, priceRange: v })}>
                  <SelectTrigger data-testid="select-edit-price-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(formData.type === "bar" ? BAR_PRICE_RANGES : RESTAURANT_PRICE_RANGES).map(range => (
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

            {/* 餐厅专属：菜系类型 */}
            {formData.type === "restaurant" && (
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
            )}

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

            {/* 酒吧特有字段 - 仅当类型为酒吧时显示 */}
            {formData.type === "bar" && (
              <>
                <div className="space-y-2">
                  <Label>酒吧主题</Label>
                  <div className="flex flex-wrap gap-2">
                    {BAR_THEMES.map(theme => (
                      <Badge
                        key={theme}
                        variant={formData.barThemes.includes(theme) ? "default" : "outline"}
                        className="cursor-pointer hover-elevate active-elevate-2"
                        onClick={() => toggleBarTheme(theme)}
                        data-testid={`edit-barTheme-${theme}`}
                      >
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>支持的饮酒选项</Label>
                  <div className="flex flex-wrap gap-2">
                    {ALCOHOL_OPTIONS.map(option => (
                      <Badge
                        key={option}
                        variant={formData.alcoholOptions.includes(option) ? "default" : "outline"}
                        className="cursor-pointer hover-elevate active-elevate-2"
                        onClick={() => toggleAlcoholOption(option)}
                        data-testid={`edit-alcoholOption-${option}`}
                      >
                        {option}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-vibeDescriptor">氛围描述</Label>
                  <Input
                    id="edit-vibeDescriptor"
                    placeholder="例：适合安静聊天、轻松社交氛围"
                    value={formData.vibeDescriptor}
                    onChange={(e) => setFormData({ ...formData, vibeDescriptor: e.target.value })}
                    data-testid="input-edit-vibeDescriptor"
                  />
                </div>
              </>
            )}

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

      {/* Venue Deals Management Dialog */}
      <Dialog open={showDealsDialog} onOpenChange={setShowDealsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-amber-500" />
              场地优惠管理 - {selectedVenue?.name}
            </DialogTitle>
            <DialogDescription>
              管理此场地的专属优惠活动
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <Tabs value={dealFilterStatus} onValueChange={(v) => setDealFilterStatus(v as any)}>
                <TabsList>
                  <TabsTrigger value="all" data-testid="deal-filter-all">全部 ({venueDeals.length})</TabsTrigger>
                  <TabsTrigger value="active" data-testid="deal-filter-active">生效中</TabsTrigger>
                  <TabsTrigger value="inactive" data-testid="deal-filter-inactive">已停用</TabsTrigger>
                  <TabsTrigger value="expired" data-testid="deal-filter-expired">已过期</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button onClick={handleCreateDeal} data-testid="button-add-deal">
                <Plus className="h-4 w-4 mr-2" />
                添加优惠
              </Button>
            </div>

            {venueDealsLoading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : filteredDeals.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Gift className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    {dealFilterStatus === "all" ? "暂无优惠，点击上方按钮添加" : "暂无此类优惠"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredDeals.map((deal) => {
                  const status = getDealStatus(deal);
                  return (
                    <Card key={deal.id} data-testid={`card-deal-${deal.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                              {deal.discountType === "percentage" && <Percent className="h-5 w-5 text-white" />}
                              {deal.discountType === "fixed" && <CircleDollarSign className="h-5 w-5 text-white" />}
                              {deal.discountType === "gift" && <Gift className="h-5 w-5 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-amber-700 dark:text-amber-400">
                                  {formatDiscountText(deal)}
                                </span>
                                <Badge variant={status.variant}>{status.label}</Badge>
                              </div>
                              <p className="text-sm font-medium mt-0.5">{deal.title}</p>
                              {deal.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{deal.description}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                                {deal.validFrom && deal.validUntil && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {deal.validFrom} 至 {deal.validUntil}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3 w-3" />
                                  使用 {deal.usageCount} 次
                                </span>
                                <span>
                                  核销方式: {REDEMPTION_METHODS.find(m => m.value === deal.redemptionMethod)?.label}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={deal.isActive}
                              onCheckedChange={(checked) => toggleDealMutation.mutate({ id: deal.id, isActive: checked })}
                              data-testid={`toggle-deal-${deal.id}`}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditDeal(deal)}
                              data-testid={`edit-deal-${deal.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteDealMutation.mutate(deal.id)}
                              disabled={deleteDealMutation.isPending}
                              data-testid={`delete-deal-${deal.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDealsDialog(false)} data-testid="button-close-deals">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deal Form Dialog */}
      <Dialog open={showDealFormDialog} onOpenChange={(open) => { setShowDealFormDialog(open); if (!open) { setEditingDeal(null); resetDealForm(); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDeal ? "编辑优惠" : "添加优惠"}</DialogTitle>
            <DialogDescription>
              {editingDeal ? "修改优惠信息" : "为场地添加新的专属优惠"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deal-title">优惠标题 *</Label>
              <Input
                id="deal-title"
                placeholder="例：悦聚专属8折优惠"
                value={dealFormData.title}
                onChange={(e) => setDealFormData({ ...dealFormData, title: e.target.value })}
                data-testid="input-deal-title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>优惠类型 *</Label>
                <Select 
                  value={dealFormData.discountType} 
                  onValueChange={(v) => setDealFormData({ ...dealFormData, discountType: v as any })}
                >
                  <SelectTrigger data-testid="select-discount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISCOUNT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {dealFormData.discountType !== "gift" && (
                <div className="space-y-2">
                  <Label htmlFor="discount-value">
                    {dealFormData.discountType === "percentage" ? "折扣值 (输入20表示8折)" : "立减金额 (元)"}
                  </Label>
                  <Input
                    id="discount-value"
                    type="number"
                    placeholder={dealFormData.discountType === "percentage" ? "20" : "30"}
                    value={dealFormData.discountValue}
                    onChange={(e) => setDealFormData({ ...dealFormData, discountValue: e.target.value })}
                    data-testid="input-discount-value"
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="deal-description">优惠说明</Label>
              <Textarea
                id="deal-description"
                placeholder="详细描述优惠内容"
                value={dealFormData.description}
                onChange={(e) => setDealFormData({ ...dealFormData, description: e.target.value })}
                rows={2}
                data-testid="input-deal-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>核销方式</Label>
                <Select 
                  value={dealFormData.redemptionMethod} 
                  onValueChange={(v) => setDealFormData({ ...dealFormData, redemptionMethod: v as any })}
                >
                  <SelectTrigger data-testid="select-redemption-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REDEMPTION_METHODS.map(method => (
                      <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {dealFormData.redemptionMethod === "code" && (
                <div className="space-y-2">
                  <Label htmlFor="redemption-code">暗号</Label>
                  <Input
                    id="redemption-code"
                    placeholder="例：悦聚会员"
                    value={dealFormData.redemptionCode}
                    onChange={(e) => setDealFormData({ ...dealFormData, redemptionCode: e.target.value })}
                    data-testid="input-redemption-code"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valid-from">生效日期</Label>
                <Input
                  id="valid-from"
                  type="date"
                  value={dealFormData.validFrom}
                  onChange={(e) => setDealFormData({ ...dealFormData, validFrom: e.target.value })}
                  data-testid="input-valid-from"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="valid-until">失效日期</Label>
                <Input
                  id="valid-until"
                  type="date"
                  value={dealFormData.validUntil}
                  onChange={(e) => setDealFormData({ ...dealFormData, validUntil: e.target.value })}
                  data-testid="input-valid-until"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-spend">最低消费 (可选)</Label>
                <Input
                  id="min-spend"
                  type="number"
                  placeholder="无限制"
                  value={dealFormData.minSpend}
                  onChange={(e) => setDealFormData({ ...dealFormData, minSpend: e.target.value })}
                  data-testid="input-min-spend"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-discount">最高优惠金额 (可选)</Label>
                <Input
                  id="max-discount"
                  type="number"
                  placeholder="无限制"
                  value={dealFormData.maxDiscount}
                  onChange={(e) => setDealFormData({ ...dealFormData, maxDiscount: e.target.value })}
                  data-testid="input-max-discount"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deal-terms">使用条款</Label>
              <Textarea
                id="deal-terms"
                placeholder="例：每桌限用一次，不可与其他优惠叠加"
                value={dealFormData.terms}
                onChange={(e) => setDealFormData({ ...dealFormData, terms: e.target.value })}
                rows={2}
                data-testid="input-deal-terms"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="per-person-limit"
                checked={dealFormData.perPersonLimit}
                onCheckedChange={(checked) => setDealFormData({ ...dealFormData, perPersonLimit: !!checked })}
                data-testid="checkbox-per-person-limit"
              />
              <Label htmlFor="per-person-limit" className="text-sm cursor-pointer">
                每人限用一次
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDealFormDialog(false)} data-testid="button-cancel-deal">
              取消
            </Button>
            <Button 
              onClick={handleSubmitDeal} 
              disabled={createDealMutation.isPending || updateDealMutation.isPending}
              data-testid="button-submit-deal"
            >
              {createDealMutation.isPending || updateDealMutation.isPending 
                ? "保存中..." 
                : editingDeal ? "更新优惠" : "添加优惠"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
