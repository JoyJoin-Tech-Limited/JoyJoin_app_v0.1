import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Gift, Percent, CircleDollarSign, Edit, Trash2, Calendar, Eye, Tag } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/ui/use-toast";
import VenueDealPreview from "@/components/admin/VenueDealPreview";
import { formatDiscountLabel, formatSetMenuPriceLabel } from "@shared/copy/venueDealCopy";
import {
  Venue,
  VenueDeal,
  REDEMPTION_METHODS,
  DEAL_FORM_TYPES,
  DEAL_FORM_METHODS,
  zheToDiscountValue,
  discountValueToZhe,
  yuanToCents,
  centsToYuan,
} from "./venueConstants";

interface VenueDealsManagerProps {
  venue: Venue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface DealFormState {
  kind: "discount" | "set_menu";
  title: string;
  description: string;
  /** 折扣以「折」录入，1.0–9.9 */
  discountZhe: string;
  setMenuPriceYuan: string;
  setMenuOriginalPriceYuan: string;
  redemptionMethod: "show_page" | "code";
  redemptionCode: string;
}

export const EMPTY_DEAL_FORM: DealFormState = {
  kind: "discount",
  title: "",
  description: "",
  discountZhe: "",
  setMenuPriceYuan: "",
  setMenuOriginalPriceYuan: "",
  redemptionMethod: "show_page",
  redemptionCode: "",
};

const isModernDeal = (deal: VenueDeal) =>
  deal.discountType === "percentage" || deal.discountType === "set_menu";

/**
 * 表单 → API payload。折扣换算 discountValue=(10-折)*10；套餐元→分；不携带任何门槛/有效期字段。
 *
 * forUpdate（PATCH）时，目标类型用不到的面值字段必须显式给 null：
 * JSON 会丢弃 undefined，服务端合并既有行时就会保留旧类型的 discountValue / 套餐价，
 * 导致「折扣 ↔ 套餐」互转被创建不变量拒绝。null 在服务端的语义就是清除该字段。
 */
export function buildDealPayload(form: DealFormState, options: { forUpdate?: boolean } = {}) {
  const isSetMenu = form.kind === "set_menu";
  const unused = options.forUpdate ? null : undefined;
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    discountType: isSetMenu ? ("set_menu" as const) : ("percentage" as const),
    discountValue: isSetMenu ? unused : zheToDiscountValue(form.discountZhe) ?? undefined,
    setMenuPriceCents: isSetMenu ? yuanToCents(form.setMenuPriceYuan) ?? undefined : unused,
    setMenuOriginalPriceCents: isSetMenu
      ? yuanToCents(form.setMenuOriginalPriceYuan) ?? undefined
      : unused,
    // 定制套餐只能是出示页面，没有暗号
    redemptionMethod: isSetMenu ? ("show_page" as const) : form.redemptionMethod,
    redemptionCode:
      !isSetMenu && form.redemptionMethod === "code" ? form.redemptionCode.trim() : unused,
  };
}

export function validateDealForm(form: DealFormState): string | null {
  if (!form.title.trim()) return "请填写权益标题";
  if (form.title.trim().length > 20) return "标题最多 20 字";
  if (form.description.trim().length > 20) return "说明最多 20 字";
  if (form.kind === "discount") {
    if (zheToDiscountValue(form.discountZhe) === null) return "折扣需为 1.0–9.9 之间的一位小数";
    if (form.redemptionMethod === "code") {
      const code = form.redemptionCode.trim();
      if (code.length < 2 || code.length > 8) return "暗号需为 2–8 字";
    }
  } else {
    const price = yuanToCents(form.setMenuPriceYuan);
    const original = yuanToCents(form.setMenuOriginalPriceYuan);
    if (price === null) return "请填写有效的套餐一口价（元，最多两位小数）";
    if (original === null) return "请填写有效的套餐原价（元，最多两位小数）";
    if (original <= price) return "原价必须大于一口价";
  }
  return null;
}

/** 新建/编辑共用的表单字段；legacy 行由父组件只渲染文案字段。 */
export function DealFormFields({
  value,
  onChange,
}: {
  value: DealFormState;
  onChange: (next: DealFormState) => void;
}) {
  const set = (patch: Partial<DealFormState>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>权益类型 *</Label>
        <div className="grid grid-cols-2 gap-2">
          {DEAL_FORM_TYPES.map((type) => (
            <Button
              key={type.value}
              type="button"
              variant={
                (type.value === "set_menu") === (value.kind === "set_menu") ? "default" : "outline"
              }
              onClick={() =>
                set({
                  kind: type.value === "set_menu" ? "set_menu" : "discount",
                  redemptionMethod: type.value === "set_menu" ? "show_page" : value.redemptionMethod,
                })
              }
              data-testid={`deal-kind-${type.value}`}
            >
              {type.label}
            </Button>
          ))}
        </div>
      </div>

      {value.kind === "discount" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="deal-discount-zhe">折扣（折）*</Label>
            <Input
              id="deal-discount-zhe"
              type="number"
              step="0.1"
              min="1"
              max="9.9"
              placeholder="例：8 表示 8 折"
              value={value.discountZhe}
              onChange={(e) => set({ discountZhe: e.target.value })}
              data-testid="input-discount-zhe"
            />
            <p className="text-xs text-muted-foreground">1.0–9.9，一位小数；无门槛，全单通用</p>
          </div>
          <div className="space-y-2">
            <Label>核销方式</Label>
            <Select
              value={value.redemptionMethod}
              onValueChange={(v) => set({ redemptionMethod: v as "show_page" | "code" })}
            >
              <SelectTrigger data-testid="select-redemption-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_FORM_METHODS.map((method) => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {value.redemptionMethod === "code" && (
            <div className="space-y-2">
              <Label htmlFor="deal-redemption-code">到店暗号（2–8 字）*</Label>
              <Input
                id="deal-redemption-code"
                placeholder="例：悦聚同桌"
                maxLength={8}
                value={value.redemptionCode}
                onChange={(e) => set({ redemptionCode: e.target.value })}
                data-testid="input-redemption-code"
              />
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deal-set-menu-price">一口价（元）*</Label>
              <Input
                id="deal-set-menu-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="598"
                value={value.setMenuPriceYuan}
                onChange={(e) => set({ setMenuPriceYuan: e.target.value })}
                data-testid="input-set-menu-price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deal-set-menu-original">原价（元）*</Label>
              <Input
                id="deal-set-menu-original"
                type="number"
                step="0.01"
                min="0"
                placeholder="758"
                value={value.setMenuOriginalPriceYuan}
                onChange={(e) => set({ setMenuOriginalPriceYuan: e.target.value })}
                data-testid="input-set-menu-original"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">原价必须大于一口价；说明里写清套餐内容</p>
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="deal-title">权益标题（20 字内）*</Label>
        <Input
          id="deal-title"
          placeholder={value.kind === "discount" ? "例：本场专属折扣" : "例：六人分享套餐"}
          maxLength={20}
          value={value.title}
          onChange={(e) => set({ title: e.target.value })}
          data-testid="input-deal-title"
        />
        <p className="text-xs text-muted-foreground">{value.title.length}/20</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="deal-description">说明（20 字内）</Label>
        <Textarea
          id="deal-description"
          placeholder={value.kind === "discount" ? "无门槛全单通用" : "例：6菜1汤加一壶特调"}
          maxLength={20}
          rows={2}
          value={value.description}
          onChange={(e) => set({ description: e.target.value })}
          data-testid="input-deal-description"
        />
        <p className="text-xs text-muted-foreground">{value.description.length}/20</p>
      </div>
    </div>
  );
}

export default function VenueDealsManager({ venue, open, onOpenChange }: VenueDealsManagerProps) {
  const { toast } = useToast();
  const [showDealFormDialog, setShowDealFormDialog] = useState(false);
  const [editingDeal, setEditingDeal] = useState<VenueDeal | null>(null);
  const [dealFilterStatus, setDealFilterStatus] = useState<"all" | "active" | "inactive" | "expired">("all");
  const [dealForm, setDealForm] = useState<DealFormState>(EMPTY_DEAL_FORM);
  const [legacyForm, setLegacyForm] = useState({ title: "", description: "" });
  const [deactivateTarget, setDeactivateTarget] = useState<{
    deal: VenueDeal;
    affectedPools: Array<{ id: string; title: string; dateTime?: string }>;
  } | null>(null);

  const { data: venueDeals = [], isLoading: venueDealsLoading } = useQuery<VenueDeal[]>({
    queryKey: ["/api/admin/venues", venue?.id, "deals"],
    queryFn: async () => {
      if (!venue) return [];
      try {
        const res = await apiRequest("GET", `/api/admin/venues/${venue.id}/deals`);
        return await res.json();
      } catch (err) {
        console.error(err);
        return [];
      }
    },
    enabled: open && !!venue,
  });

  const filteredDeals = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return venueDeals.filter((deal) => {
      if (dealFilterStatus === "all") return true;
      if (dealFilterStatus === "active") return deal.isActive && (!deal.validUntil || deal.validUntil >= today);
      if (dealFilterStatus === "inactive") return !deal.isActive;
      if (dealFilterStatus === "expired") return deal.validUntil && deal.validUntil < today;
      return true;
    });
  }, [venueDeals, dealFilterStatus]);

  const invalidateDeals = () => {
    if (venue) queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venue.id, "deals"] });
  };

  // 4xx/5xx 必须当失败处理：旧实现只 r.json()，400 校验拒绝也会走 onSuccess
  const requestJson = async (url: string, init: RequestInit) => {
    const res = await fetch(url, { credentials: "include", ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(body?.message || "请求失败") as Error & {
        code?: string;
        affectedPools?: Array<{ id: string; title: string; dateTime?: string }>;
      };
      error.code = body?.code;
      error.affectedPools = body?.affectedPools;
      throw error;
    }
    return body;
  };

  const closeForm = () => {
    setShowDealFormDialog(false);
    setEditingDeal(null);
    setDealForm(EMPTY_DEAL_FORM);
  };

  const saveDealMutation = useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: any }) =>
      requestJson(id ? `/api/admin/venue-deals/${id}` : `/api/admin/venues/${venue?.id}/deals`, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      invalidateDeals();
      closeForm();
      toast({
        title: variables.id ? "更新成功" : "优惠创建成功",
        description: variables.id ? "权益信息已更新" : "权益已添加到场地",
      });
    },
    onError: (error: any) => {
      toast({
        title: "保存失败",
        description: error?.message || "无法保存优惠，请重试",
        variant: "destructive",
      });
    },
  });

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) =>
      requestJson(`/api/admin/venue-deals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateDeals();
      toast({ title: "删除成功", description: "优惠已删除" });
    },
    onError: (error: any) => {
      const pools = error?.affectedPools?.map((p: any) => p.title).join("、");
      toast({
        title: error?.code === "DEAL_BOUND_TO_POOL" ? "该权益已被活动池绑定" : "删除失败",
        description:
          error?.code === "DEAL_BOUND_TO_POOL"
            ? `请先在活动池中解绑：${pools || "相关活动池"}`
            : error?.message || "无法删除优惠，请重试",
        variant: "destructive",
      });
    },
  });

  const toggleDealMutation = useMutation({
    mutationFn: async ({ id, isActive, confirmDeactivate }: { id: string; isActive: boolean; confirmDeactivate?: boolean }) =>
      requestJson(`/api/admin/venue-deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmDeactivate ? { isActive, confirmDeactivate } : { isActive }),
      }),
    onSuccess: () => {
      invalidateDeals();
      setDeactivateTarget(null);
    },
    onError: (error: any, variables) => {
      if (error?.code === "DEAL_BOUND_TO_POOL" && !variables.confirmDeactivate) {
        const deal = venueDeals.find((d) => d.id === variables.id);
        if (deal) {
          setDeactivateTarget({ deal, affectedPools: error.affectedPools ?? [] });
          return;
        }
      }
      toast({
        title: "操作失败",
        description: error?.message || "无法更新状态，请重试",
        variant: "destructive",
      });
    },
  });

  const handleCreateDeal = () => {
    setEditingDeal(null);
    setDealForm(EMPTY_DEAL_FORM);
    setShowDealFormDialog(true);
  };

  const handleEditDeal = (deal: VenueDeal) => {
    setEditingDeal(deal);
    if (isModernDeal(deal)) {
      setDealForm({
        kind: deal.discountType === "set_menu" ? "set_menu" : "discount",
        title: deal.title,
        description: deal.description || "",
        discountZhe: discountValueToZhe(deal.discountValue),
        setMenuPriceYuan: centsToYuan(deal.setMenuPriceCents),
        setMenuOriginalPriceYuan: centsToYuan(deal.setMenuOriginalPriceCents),
        redemptionMethod: deal.redemptionMethod === "code" ? "code" : "show_page",
        redemptionCode: deal.redemptionCode || "",
      });
    } else {
      setLegacyForm({ title: deal.title, description: deal.description || "" });
    }
    setShowDealFormDialog(true);
  };

  const handleSubmitDeal = () => {
    if (editingDeal && !isModernDeal(editingDeal)) {
      if (!legacyForm.title.trim()) {
        toast({ title: "请填写权益标题", variant: "destructive" });
        return;
      }
      saveDealMutation.mutate({
        id: editingDeal.id,
        data: { title: legacyForm.title.trim(), description: legacyForm.description.trim() },
      });
      return;
    }
    const error = validateDealForm(dealForm);
    if (error) {
      toast({ title: error, variant: "destructive" });
      return;
    }
    saveDealMutation.mutate({
      id: editingDeal?.id,
      data: buildDealPayload(dealForm, { forUpdate: Boolean(editingDeal?.id) }),
    });
  };

  const formatDiscountText = (deal: VenueDeal): string => {
    switch (deal.discountType) {
      case "percentage":
        return formatDiscountLabel(deal.discountValue ?? 0) || "专属折扣";
      case "set_menu":
        return `${formatSetMenuPriceLabel(deal.setMenuPriceCents ?? 0)} 套餐`;
      case "fixed":
        return `立减¥${deal.discountValue}（旧格式）`;
      case "gift":
        return "赠品福利（旧格式）";
      default:
        return "专属优惠";
    }
  };

  const getDealStatus = (deal: VenueDeal): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } => {
    const today = new Date().toISOString().split("T")[0];
    if (!deal.isActive) return { label: "已停用", variant: "secondary" };
    if (deal.validUntil && deal.validUntil < today) return { label: "已过期", variant: "destructive" };
    if (deal.validFrom && deal.validFrom > today) return { label: "未开始", variant: "outline" };
    return { label: "生效中", variant: "default" };
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-amber-500" />
              场地优惠管理 - {venue?.name}
            </DialogTitle>
            <DialogDescription>
              只有两种形态：统一折扣 / 定制套餐。无门槛、无有效期，规则固定为「仅限本场活动 · 本桌使用」
            </DialogDescription>
          </DialogHeader>

          {/* 状态说明：后台配置与用户端可见性不是一回事。保留到小程序接入 venue_deals 为止，
              否则运营会以为「已配置 = 用户已看到」。文案只陈述事实，不承诺上线时间。 */}
          <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            小程序端尚未展示场地优惠：此处配置目前仅在后台生效，用户看不到，也不参与收银台费用说明。
          </div>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <Tabs value={dealFilterStatus} onValueChange={(v) => setDealFilterStatus(v as any)}>
                <TabsList>
                  <TabsTrigger value="all" data-testid="deal-filter-all">
                    全部 ({venueDeals.length})
                  </TabsTrigger>
                  <TabsTrigger value="active" data-testid="deal-filter-active">
                    生效中
                  </TabsTrigger>
                  <TabsTrigger value="inactive" data-testid="deal-filter-inactive">
                    已停用
                  </TabsTrigger>
                  <TabsTrigger value="expired" data-testid="deal-filter-expired">
                    已过期
                  </TabsTrigger>
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
                              {deal.discountType === "set_menu" && <Tag className="h-5 w-5 text-white" />}
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
                                  核销方式: {REDEMPTION_METHODS.find((m) => m.value === deal.redemptionMethod)?.label}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={deal.isActive}
                              onCheckedChange={(checked) =>
                                toggleDealMutation.mutate({ id: deal.id, isActive: checked })
                              }
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
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-close-deals">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDealFormDialog}
        onOpenChange={(next) => {
          if (!next) closeForm();
          else setShowDealFormDialog(true);
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDeal ? "编辑优惠" : "添加优惠"}</DialogTitle>
            <DialogDescription>
              {editingDeal && !isModernDeal(editingDeal)
                ? "旧格式权益仅支持修改文案或停用，新权益请重新创建"
                : "右侧为用户将看到的卡面与出示页预览"}
            </DialogDescription>
          </DialogHeader>

          {editingDeal && !isModernDeal(editingDeal) ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="legacy-deal-title">权益标题（20 字内）*</Label>
                <Input
                  id="legacy-deal-title"
                  maxLength={20}
                  value={legacyForm.title}
                  onChange={(e) => setLegacyForm({ ...legacyForm, title: e.target.value })}
                  data-testid="input-legacy-deal-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legacy-deal-description">说明</Label>
                <Textarea
                  id="legacy-deal-description"
                  rows={2}
                  value={legacyForm.description}
                  onChange={(e) => setLegacyForm({ ...legacyForm, description: e.target.value })}
                  data-testid="input-legacy-deal-description"
                />
              </div>
            </div>
          ) : (
            <div className="grid gap-6 py-4 md:grid-cols-[1fr_280px]">
              <DealFormFields value={dealForm} onChange={setDealForm} />
              <div className="space-y-2">
                <Label>实时预览</Label>
                <VenueDealPreview
                  kind={dealForm.kind}
                  title={dealForm.title}
                  description={dealForm.description}
                  discountValue={zheToDiscountValue(dealForm.discountZhe)}
                  setMenuPriceCents={yuanToCents(dealForm.setMenuPriceYuan)}
                  setMenuOriginalPriceCents={yuanToCents(dealForm.setMenuOriginalPriceYuan)}
                  method={dealForm.kind === "set_menu" ? "show_page" : dealForm.redemptionMethod}
                  code={dealForm.redemptionCode}
                  venueName={venue?.brandName || venue?.name}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeForm} data-testid="button-cancel-deal">
              取消
            </Button>
            <Button
              onClick={handleSubmitDeal}
              disabled={saveDealMutation.isPending}
              data-testid="button-submit-deal"
            >
              {saveDealMutation.isPending ? "保存中..." : editingDeal ? "更新优惠" : "添加优惠"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivateTarget} onOpenChange={(next) => !next && setDeactivateTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>停用已被绑定的权益？</DialogTitle>
            <DialogDescription>
              以下活动池把「{deactivateTarget?.deal.title}」作为保底权益。停用后这些池在排桌时将无法成局，
              并按既有流程重试，最迟活动前 24 小时取消且向已付款用户全额退款。
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm" data-testid="deactivate-affected-pools">
            {deactivateTarget?.affectedPools.map((pool) => (
              <li key={pool.id}>· {pool.title}</li>
            ))}
            {deactivateTarget && deactivateTarget.affectedPools.length === 0 && <li>· 相关活动池</li>}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)} data-testid="button-cancel-deactivate">
              先不停用
            </Button>
            <Button
              variant="destructive"
              disabled={toggleDealMutation.isPending}
              onClick={() =>
                deactivateTarget &&
                toggleDealMutation.mutate({
                  id: deactivateTarget.deal.id,
                  isActive: false,
                  confirmDeactivate: true,
                })
              }
              data-testid="button-confirm-deactivate"
            >
              确认停用
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
