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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Gift, Percent, CircleDollarSign, Edit, Trash2, Calendar, Eye, Tag } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/ui/use-toast";
import { Venue, VenueDeal, DISCOUNT_TYPES, REDEMPTION_METHODS } from "./venueConstants";

interface VenueDealsManagerProps {
  venue: Venue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VenueDealsManager({ venue, open, onOpenChange }: VenueDealsManagerProps) {
  const { toast } = useToast();
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

  const createDealMutation = useMutation({
    mutationFn: async (data: any) => {
      return await fetch(`/api/admin/venues/${venue?.id}/deals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()).catch((err) => { throw err; });
    },
    onSuccess: () => {
      if (venue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venue.id, "deals"] });
      }
      setShowDealFormDialog(false);
      resetDealForm();
      toast({ title: "优惠创建成功", description: "优惠已添加到场地" });
    },
    onError: () => {
      toast({ title: "创建失败", description: "无法创建优惠，请重试", variant: "destructive" });
    },
  });

  const updateDealMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await fetch(`/api/admin/venue-deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()).catch((err) => { throw err; });
    },
    onSuccess: () => {
      if (venue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venue.id, "deals"] });
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

  const deleteDealMutation = useMutation({
    mutationFn: async (id: string) => {
      return await fetch(`/api/admin/venue-deals/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => r.json()).catch((err) => { throw err; });
    },
    onSuccess: () => {
      if (venue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venue.id, "deals"] });
      }
      toast({ title: "删除成功", description: "优惠已删除" });
    },
    onError: () => {
      toast({ title: "删除失败", description: "无法删除优惠，请重试", variant: "destructive" });
    },
  });

  const toggleDealMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await fetch(`/api/admin/venue-deals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive }),
      }).then((r) => r.json()).catch((err) => { throw err; });
    },
    onSuccess: () => {
      if (venue) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venue.id, "deals"] });
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

  const handleCreateDeal = () => {
    setEditingDeal(null);
    resetDealForm();
    const today = new Date().toISOString().split("T")[0];
    const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setDealFormData((prev) => ({ ...prev, validFrom: today, validUntil: nextYear }));
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
            <DialogDescription>管理此场地的专属优惠活动</DialogDescription>
          </DialogHeader>

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
        onOpenChange={(open) => {
          setShowDealFormDialog(open);
          if (!open) {
            setEditingDeal(null);
            resetDealForm();
          }
        }}
      >
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
                    {DISCOUNT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
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
                    {REDEMPTION_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
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
                : editingDeal
                ? "更新优惠"
                : "添加优惠"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
