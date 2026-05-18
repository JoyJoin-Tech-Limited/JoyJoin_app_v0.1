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
import { Store, Plus, Edit, Trash2, Building, TrendingUp, Calendar, DollarSign, Clock, X, CalendarDays, LayoutGrid, AlertTriangle, ArrowRightLeft, Gift, Percent, Tag, CircleDollarSign, Eye, EyeOff, MapPin, Map } from "lucide-react";
import FieldInfoTooltip from "@/components/discover/FieldInfoTooltip";
import { shenzhenClusters, getDistrictsByCluster, getDistrictById, getClusterById } from "@shared/districts";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import AmapPicker from "@/components/discover/AmapPicker";
import VenueCreateDialog from "./VenueCreateDialog";
import VenueEditDialog from "./VenueEditDialog";
import VenueDealsManager from "./VenueDealsManager";

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
  latitude: number | null;
  longitude: number | null;
  contactName: string | null;
  contactPhone: string | null;
  commissionRate: number;
  tags: string[] | null;
  cuisines: string[] | null;
  decorStyle: string[] | null;
  priceRange: string | null;
  budgetCategories: string[] | null;
  maxConcurrentEvents: number;
  seatingCapacity: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  bookingCount?: number;
  totalCommission?: number;
  // 酒吧特有字段
  barThemes: string[] | null;
  alcoholOptions: string[] | null;
  vibeDescriptor: string | null;
  // Partner onboarding fields (optional)
  partnerCompanyName?: string | null;
  businessLicenseNo?: string | null;
  partnerEmail?: string | null;
  bankAccountInfo?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  onboardingStatus?: 'draft' | 'pending_review' | 'active' | 'suspended' | null;
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
// 餐厅专属菜系 - 与用户表单对齐
const CUISINES = ["中餐", "川菜", "粤菜", "火锅", "烧烤", "西餐", "日料"];
const DECOR_STYLES = ["轻奢现代风", "绿植花园风", "复古工业风", "温馨日式风"];

// 酒吧特有选项 - 与用户表单对齐
const BAR_THEMES = ["精酿", "清吧", "私密调酒·Homebar"];
// 口味偏好选项（餐厅）
const TASTE_INTENSITY_OPTIONS = ["爱吃辣", "不辣清淡为主"];
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
  const [showDealsDialog, setShowDealsDialog] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [filterType, setFilterType] = useState<"all" | "restaurant" | "bar">("all");
  const [viewMode, setViewMode] = useState<"venues" | "calendar">("venues");
  
  // Time slot form state
  
  // Venue deals state
  
  // Map picker state
  const [showMapPicker, setShowMapPicker] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    type: "restaurant",
    address: "",
    city: "深圳",
    district: "",
    clusterId: "",
    districtId: "",
    latitude: "",
    longitude: "",
    contactName: "",
    contactPhone: "",
    commissionRate: "20",
    priceRange: "150以下",
    budgetCategories: [] as string[],
    maxConcurrentEvents: "1",
    seatingCapacity: "8",
    tags: [] as string[],
    cuisines: [] as string[],
    decorStyle: [] as string[],
    tasteIntensity: [] as string[],
    notes: "",
    // 酒吧特有字段
    barThemes: [] as string[],
    alcoholOptions: [] as string[],
    vibeDescriptor: "",
    // 合作伙伴字段
    partnerCompanyName: "",
    businessLicenseNo: "",
    partnerEmail: "",
    bankAccountInfo: "",
    contractStartDate: "",
    contractEndDate: "",
    onboardingStatus: "draft" as "draft" | "pending_review" | "active" | "suspended",
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
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/venues/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.message || `Failed to delete venue: ${res.status}`);
      }
      // 204 No Content — return nothing
      return res.status === 204 ? null : await res.json();
    },
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

  // Create time slot batch mutation

  // Create single time slot mutation

  // Delete time slot mutation

  // Toggle time slot active status mutation

  // Active bookings query for migration

  // Alternative venues query for migration

  // Migration mutation

  const handleMigration = (venue: Venue) => {
    setSelectedVenue(venue);
    setShowMigrationDialog(true);
  };


  // ============ VENUE DEALS ============
  
  // Query venue deals

  // Filter deals by status

  // Create deal mutation

  // Update deal mutation

  // Delete deal mutation

  // Toggle deal active status


  const handleManageDeals = (venue: Venue) => {
    setSelectedVenue(venue);
    setShowDealsDialog(true);
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
      latitude: "",
      longitude: "",
      contactName: "",
      contactPhone: "",
      commissionRate: "20",
      priceRange: "150以下",
      budgetCategories: [],
      maxConcurrentEvents: "1",
      seatingCapacity: "8",
      tags: [],
      cuisines: [],
      decorStyle: [],
      tasteIntensity: [],
      notes: "",
      barThemes: [],
      alcoholOptions: [],
      vibeDescriptor: "",
      partnerCompanyName: "",
      businessLicenseNo: "",
      partnerEmail: "",
      bankAccountInfo: "",
      contractStartDate: "",
      contractEndDate: "",
      onboardingStatus: "draft",
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

    // 深圳场地必须选择片区和商圈
    if (formData.city === "深圳" && (!formData.clusterId || !formData.districtId)) {
      toast({
        title: "位置信息不完整",
        description: "深圳场地必须选择片区和商圈",
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
      budgetCategories: formData.budgetCategories.length > 0 ? formData.budgetCategories : undefined,
      maxConcurrentEvents: parseInt(formData.maxConcurrentEvents),
      seatingCapacity: parseInt(formData.seatingCapacity),
      tags: formData.tags.length > 0 ? formData.tags : undefined,
      cuisines: formData.cuisines.length > 0 ? formData.cuisines : undefined,
      decorStyle: formData.decorStyle.length > 0 ? formData.decorStyle : undefined,
      tasteIntensity: formData.tasteIntensity.length > 0 ? formData.tasteIntensity : undefined,
      notes: formData.notes || undefined,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null,
      // 酒吧特有字段
      barThemes: formData.barThemes.length > 0 ? formData.barThemes : undefined,
      alcoholOptions: formData.alcoholOptions.length > 0 ? formData.alcoholOptions : undefined,
      vibeDescriptor: formData.vibeDescriptor || undefined,
      partnerCompanyName: formData.partnerCompanyName || undefined,
      businessLicenseNo: formData.businessLicenseNo || undefined,
      partnerEmail: formData.partnerEmail || undefined,
      bankAccountInfo: formData.bankAccountInfo || undefined,
      contractStartDate: formData.contractStartDate || undefined,
      contractEndDate: formData.contractEndDate || undefined,
      onboardingStatus: formData.onboardingStatus || undefined,
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
      latitude: venue.latitude?.toString() || "",
      longitude: venue.longitude?.toString() || "",
      contactName: venue.contactName || "",
      contactPhone: venue.contactPhone || "",
      commissionRate: venue.commissionRate.toString(),
      priceRange: venue.priceRange || "150以下",
      budgetCategories: (venue as any).budgetCategories || (venue as any).budget_categories || [],
      maxConcurrentEvents: venue.maxConcurrentEvents.toString(),
      seatingCapacity: ((venue as any).seatingCapacity ?? (venue as any).seating_capacity ?? 8).toString(),
      tags: venue.tags || [],
      cuisines: venue.cuisines || [],
      decorStyle: venue.decorStyle || [],
      tasteIntensity: (venue as any).tasteIntensity || [],
      notes: venue.notes || "",
      barThemes: venue.barThemes || [],
      alcoholOptions: venue.alcoholOptions || [],
      vibeDescriptor: venue.vibeDescriptor || "",
      partnerCompanyName: venue.partnerCompanyName || "",
      businessLicenseNo: venue.businessLicenseNo || "",
      partnerEmail: venue.partnerEmail || "",
      bankAccountInfo: venue.bankAccountInfo || "",
      contractStartDate: venue.contractStartDate || "",
      contractEndDate: venue.contractEndDate || "",
      onboardingStatus: venue.onboardingStatus || "draft",
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!selectedVenue) return;

    // 深圳场地必须选择片区和商圈
    if (formData.city === "深圳" && (!formData.clusterId || !formData.districtId)) {
      toast({
        title: "位置信息不完整",
        description: "深圳场地必须选择片区和商圈",
        variant: "destructive",
      });
      return;
    }

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
        budgetCategories: formData.budgetCategories.length > 0 ? formData.budgetCategories : null,
        maxConcurrentEvents: parseInt(formData.maxConcurrentEvents),
        seatingCapacity: parseInt(formData.seatingCapacity),
        tags: formData.tags.length > 0 ? formData.tags : null,
        cuisines: formData.cuisines.length > 0 ? formData.cuisines : null,
        decorStyle: formData.decorStyle.length > 0 ? formData.decorStyle : null,
        tasteIntensity: formData.tasteIntensity.length > 0 ? formData.tasteIntensity : null,
        notes: formData.notes || null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        // 酒吧特有字段
        barThemes: formData.barThemes.length > 0 ? formData.barThemes : null,
        alcoholOptions: formData.alcoholOptions.length > 0 ? formData.alcoholOptions : null,
        vibeDescriptor: formData.vibeDescriptor || null,
        partnerCompanyName: formData.partnerCompanyName || null,
        businessLicenseNo: formData.businessLicenseNo || null,
        partnerEmail: formData.partnerEmail || null,
        bankAccountInfo: formData.bankAccountInfo || null,
        contractStartDate: formData.contractStartDate || null,
        contractEndDate: formData.contractEndDate || null,
        onboardingStatus: formData.onboardingStatus || null,
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

  const toggleTasteIntensity = (taste: string) => {
    setFormData(prev => ({
      ...prev,
      tasteIntensity: prev.tasteIntensity.includes(taste)
        ? prev.tasteIntensity.filter(t => t !== taste)
        : [...prev.tasteIntensity, taste]
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
    setShowTimeSlotsDialog(true);
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
          {filteredVenues.map((venue) => {
            const onboardingStatus = venue.onboardingStatus;
            const onboardingStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
              draft: { label: "草稿", variant: "secondary", className: "text-muted-foreground" },
              pending_review: { label: "待审核", variant: "outline", className: "border-amber-400 text-amber-700" },
              suspended: { label: "已暂停", variant: "destructive", className: "" },
            };
            const statusConfig = onboardingStatus && onboardingStatus !== 'active' ? onboardingStatusConfig[onboardingStatus] : null;
            return (
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
                {/* Onboarding status badge */}
                {statusConfig && (
                  <Badge
                    variant={statusConfig.variant}
                    className={`text-xs ${statusConfig.className}`}
                  >
                    {statusConfig.label}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">地址</span>
                    <span className="font-medium text-right truncate max-w-[60%]">{venue.address}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1">
                      佣金比例
                      <FieldInfoTooltip
                        title="佣金比例"
                        description="JoyJoin 从该场地每笔活动收入中抽取的佣金百分比。例如 20% 表示用户支付 ¥1000，场地实际收到 ¥800。"
                      />
                    </span>
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

                {/* Partner info if available */}
                {(venue.partnerCompanyName || venue.contractEndDate) && (
                  <div className="text-xs text-muted-foreground mt-1 pt-1 border-t">
                    {venue.partnerCompanyName && <div>🏢 {venue.partnerCompanyName}</div>}
                    {venue.contractEndDate && <div>合同到期: {venue.contractEndDate}</div>}
                  </div>
                )}

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
            );
          })}
        </div>
      )}



      <VenueCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleCreate}
        onCancel={() => setShowCreateDialog(false)}
        isPending={createMutation.isPending}
        setShowMapPicker={setShowMapPicker}
      />

      <VenueEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleUpdate}
        isPending={updateMutation.isPending}
        setShowMapPicker={setShowMapPicker}
      />

      <VenueDealsManager
        venue={selectedVenue}
        open={showDealsDialog}
        onOpenChange={setShowDealsDialog}
      />

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




      {/* Amap Picker Dialog */}
      <AmapPicker
        open={showMapPicker}
        onOpenChange={setShowMapPicker}
        onSelect={(location) => {
          setFormData((prev) => ({
            ...prev,
            address: location.address,
            latitude: String(location.lat),
            longitude: String(location.lng),
          }));
        }}
        initialCenter={{ lat: 22.5431, lng: 114.0579 }}
      />
    </div>
  );
}
