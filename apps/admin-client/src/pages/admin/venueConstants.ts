import { Percent, CircleDollarSign, Gift } from "lucide-react";

export interface VenueTimeSlot {
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

export const DAYS_OF_WEEK = [
  { value: 0, label: "周日" },
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
];

export interface Venue {
  id: string;
  name: string;
  brandName?: string | null;
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
  barThemes: string[] | null;
  alcoholOptions: string[] | null;
  vibeDescriptor: string | null;
  partnerCompanyName?: string | null;
  businessLicenseNo?: string | null;
  partnerEmail?: string | null;
  bankAccountInfo?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  onboardingStatus?: 'draft' | 'pending_review' | 'active' | 'suspended' | null;
}

export const VENUE_TYPES = [
  { value: "restaurant", label: "餐厅" },
  { value: "bar", label: "酒吧" },
];

export const CITIES = [
  { value: "深圳", label: "深圳" },
  { value: "香港", label: "香港" },
];

export const RESTAURANT_PRICE_RANGES = [
  { value: "150以下", label: "¥150以下/人" },
  { value: "150-200", label: "¥150-200/人" },
  { value: "200-300", label: "¥200-300/人" },
  { value: "300-500", label: "¥300-500/人" },
];

export const BAR_PRICE_RANGES = [
  { value: "80以下", label: "¥80以下/杯" },
  { value: "80-150", label: "¥80-150/杯" },
];

export const PRICE_RANGES = RESTAURANT_PRICE_RANGES;

export const TAGS = ["cozy", "lively", "upscale", "casual"];
export const CUISINES = ["中餐", "川菜", "粤菜", "火锅", "烧烤", "西餐", "日料"];
export const DECOR_STYLES = ["轻奢现代风", "绿植花园风", "复古工业风", "温馨日式风"];
export const BAR_THEMES = ["精酿", "清吧", "私密调酒·Homebar"];
export const TASTE_INTENSITY_OPTIONS = ["爱吃辣", "不辣清淡为主"];
export const ALCOHOL_OPTIONS = ["可以喝酒", "微醺就好", "无酒精饮品"];

export interface AllTimeSlot extends VenueTimeSlot {
  venueName: string;
  venueCity: string;
  venueDistrict: string;
}

export interface ActiveBooking {
  id: string;
  venue_id: string;
  event_id: string;
  booking_date: string;
  booking_time: string;
  participant_count: number;
  event_title?: string;
}

export interface VenueAlternative {
  venue: Venue;
  matchScore: number;
  reasons: string[];
}

export interface VenueDeal {
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

export const DISCOUNT_TYPES = [
  { value: "percentage", label: "折扣", icon: Percent },
  { value: "fixed", label: "立减", icon: CircleDollarSign },
  { value: "gift", label: "赠品", icon: Gift },
];

export const REDEMPTION_METHODS = [
  { value: "show_page", label: "出示本页面" },
  { value: "code", label: "报暗号" },
  { value: "qr_code", label: "扫码核销" },
];

export interface VenueFormData {
  name: string;
  brandName: string;
  type: string;
  address: string;
  city: string;
  district: string;
  clusterId: string;
  districtId: string;
  latitude: string;
  longitude: string;
  contactName: string;
  contactPhone: string;
  commissionRate: string;
  priceRange: string;
  budgetCategories: string[];
  maxConcurrentEvents: string;
  seatingCapacity: string;
  tags: string[];
  cuisines: string[];
  decorStyle: string[];
  tasteIntensity: string[];
  notes: string;
  barThemes: string[];
  alcoholOptions: string[];
  vibeDescriptor: string;
  partnerCompanyName: string;
  businessLicenseNo: string;
  partnerEmail: string;
  bankAccountInfo: string;
  contractStartDate: string;
  contractEndDate: string;
  onboardingStatus: "draft" | "pending_review" | "active" | "suspended";
}
