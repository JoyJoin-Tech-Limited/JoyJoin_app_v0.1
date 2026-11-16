import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { adminVenueDealCreateSchema } from "@shared/schema";
import type { Venue, VenueDeal } from "@/pages/admin/venueConstants";

export interface PoolGuaranteeContext {
  city: string;
  district?: string | null;
  eventType: string;
}

/** 与 server 的目录资格保持一致；后台只是提前过滤，最终仍由服务端校验。 */
export function isPoolGuaranteeVenueEligible(
  venue: Venue,
  context: PoolGuaranteeContext,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  const allowedTypes = context.eventType === "酒局" ? ["bar", "homebar"] : ["restaurant", "cafe"];
  return venue.isActive === true
    && venue.onboardingStatus === "active"
    && venue.partnerStatus === "active"
    && (!context.city || venue.city === context.city)
    && (!context.district || venue.district === context.district)
    && allowedTypes.includes(venue.type)
    && (!venue.contractEndDate || venue.contractEndDate >= today);
}

/** 复用共享创建 schema，legacy/坏面值/无效暗号不会进入保底选项。 */
export function isPoolGuaranteeDealRedeemable(deal: VenueDeal): boolean {
  if (!deal.isActive) return false;
  return adminVenueDealCreateSchema.safeParse({
    venueId: deal.venueId,
    title: deal.title,
    description: deal.description ?? "",
    discountType: deal.discountType,
    discountValue: deal.discountValue ?? undefined,
    setMenuPriceCents: deal.setMenuPriceCents ?? undefined,
    setMenuOriginalPriceCents: deal.setMenuOriginalPriceCents ?? undefined,
    redemptionMethod: deal.redemptionMethod,
    redemptionCode: deal.redemptionCode ?? undefined,
    isActive: deal.isActive,
  }).success;
}

export interface PoolGuaranteeValue {
  venueId: string | null;
  dealId: string | null;
}

interface PoolGuaranteeFieldsProps extends PoolGuaranteeContext {
  value: PoolGuaranteeValue;
  onChange: (next: PoolGuaranteeValue) => void;
  disabled?: boolean;
  /** 已成局：只允许查看当前保底，不允许换绑/解绑 */
  locked?: boolean;
}

const NONE = "__none__";

/**
 * 保底场地 + 保底权益（方案 B：建池即锁定）。
 * 创建与编辑对话框共用；编辑回填来自既有池列表数据，不新增池详情端点。
 * 切换场地会清空已选权益（权益必须属于该门店），选择「不绑定」会同时清空两者。
 */
export default function PoolGuaranteeFields({
  city,
  district,
  eventType,
  value,
  onChange,
  disabled,
  locked = false,
}: PoolGuaranteeFieldsProps) {
  const { data: venues = [] } = useQuery<Venue[]>({
    queryKey: ["/api/admin/venues", "pool-guarantee-options"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/venues");
      const body = await res.json();
      return Array.isArray(body) ? body : (body?.venues ?? []);
    },
  });

  const { data: deals = [], isLoading: dealsLoading } = useQuery<VenueDeal[]>({
    queryKey: ["/api/admin/venues", value.venueId, "deals", "guarantee"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/venues/${value.venueId}/deals`);
      const body = await res.json();
      return Array.isArray(body) ? body : [];
    },
    enabled: !!value.venueId,
  });

  const cityVenues = venues.filter((v) => isPoolGuaranteeVenueEligible(v, { city, district, eventType }));
  const activeDeals = deals.filter(isPoolGuaranteeDealRedeemable);
  const selectedVenue = venues.find((v) => v.id === value.venueId);
  // 编辑回填：权益可能已停用，仍要显示当前值让运营看懂现状
  const selectedDeal = deals.find((d) => d.id === value.dealId);

  return (
    <div className="space-y-3 rounded-md border p-4" data-testid="pool-guarantee-fields">
      <div>
        <Label className="text-base">保底场地与专属权益（可选）</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          绑定后本池只使用这家门店，报名页才会展示「专属优惠」。时段容量不足或门店停用将不成局并全额退款。
        </p>
        {locked && (
          <p className="mt-2 text-xs text-amber-700" data-testid="guarantee-locked-note">
            本池已成局，保底场地与权益已锁定，不能再换绑或解绑。
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="guaranteed-venue">保底场地</Label>
          <Select
            value={value.venueId ?? NONE}
            onValueChange={(v) =>
              onChange({ venueId: v === NONE ? null : v, dealId: null })
            }
            disabled={disabled || locked}
          >
            <SelectTrigger id="guaranteed-venue" data-testid="select-guaranteed-venue">
              <SelectValue placeholder="不绑定" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>不绑定</SelectItem>
              {cityVenues.map((venue) => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.brandName || venue.name}
                </SelectItem>
              ))}
              {value.venueId && selectedVenue && !cityVenues.some((v) => v.id === value.venueId) && (
                <SelectItem value={value.venueId}>
                  {selectedVenue.brandName || selectedVenue.name}（当前已选 · 不可用）
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="guaranteed-deal">保底权益</Label>
          <Select
            value={value.dealId ?? NONE}
            onValueChange={(v) => onChange({ ...value, dealId: v === NONE ? null : v })}
            disabled={disabled || locked || !value.venueId}
          >
            <SelectTrigger id="guaranteed-deal" data-testid="select-guaranteed-deal">
              <SelectValue placeholder={value.venueId ? "请选择权益" : "先选择保底场地"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>不绑定</SelectItem>
              {activeDeals.map((deal) => (
                <SelectItem key={deal.id} value={deal.id}>
                  {deal.title}
                </SelectItem>
              ))}
              {value.dealId && selectedDeal && !activeDeals.some((d) => d.id === value.dealId) && (
                <SelectItem value={value.dealId}>{selectedDeal.title}（当前已选 · 不可用）</SelectItem>
              )}
            </SelectContent>
          </Select>
          {value.venueId && !dealsLoading && activeDeals.length === 0 && !value.dealId && (
            <p className="text-xs text-muted-foreground" data-testid="guarantee-no-deals">
              该场地暂无可兑现的权益，请先在「场地优惠管理」中创建
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
