import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DollarSign, Edit, Star, Clock, Package } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PricingSetting {
  id: string;
  plan_type: string;
  display_name: string;
  display_name_en: string | null;
  description: string | null;
  price_in_cents: number;
  original_price_in_cents: number | null;
  duration_days: number | null;
  sort_order: number | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export default function AdminPricingPage() {
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<PricingSetting | null>(null);
  
  const [formData, setFormData] = useState({
    displayName: "",
    displayNameEn: "",
    description: "",
    priceInCents: "",
    originalPriceInCents: "",
    durationDays: "",
    sortOrder: "",
    isActive: true,
    isFeatured: false,
  });

  const { toast } = useToast();

  const { data: pricingSettings = [], isLoading } = useQuery<PricingSetting[]>({
    queryKey: ["/api/admin/pricing"],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fetch(`/api/admin/pricing/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pricing"] });
      setShowEditDialog(false);
      setSelectedSetting(null);
      toast({
        title: "更新成功",
        description: "定价设置已更新",
      });
    },
    onError: () => {
      toast({
        title: "更新失败",
        description: "无法更新定价设置，请重试",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (setting: PricingSetting) => {
    setSelectedSetting(setting);
    setFormData({
      displayName: setting.display_name || "",
      displayNameEn: setting.display_name_en || "",
      description: setting.description || "",
      priceInCents: setting.price_in_cents?.toString() || "",
      originalPriceInCents: setting.original_price_in_cents?.toString() || "",
      durationDays: setting.duration_days?.toString() || "",
      sortOrder: setting.sort_order?.toString() || "",
      isActive: setting.is_active,
      isFeatured: setting.is_featured,
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!selectedSetting) return;

    updateMutation.mutate({
      id: selectedSetting.id,
      data: {
        displayName: formData.displayName,
        displayNameEn: formData.displayNameEn || null,
        description: formData.description || null,
        priceInCents: parseInt(formData.priceInCents) || 0,
        originalPriceInCents: formData.originalPriceInCents ? parseInt(formData.originalPriceInCents) : null,
        durationDays: formData.durationDays ? parseInt(formData.durationDays) : null,
        sortOrder: formData.sortOrder ? parseInt(formData.sortOrder) : null,
        isActive: formData.isActive,
        isFeatured: formData.isFeatured,
      },
    });
  };

  const formatPrice = (cents: number) => {
    return `¥${(cents / 100).toFixed(2)}`;
  };

  const getPlanTypeLabel = (planType: string) => {
    const labels: Record<string, string> = {
      event_single: "单次活动",
      vip_monthly: "VIP月度",
      vip_quarterly: "VIP季度",
      pack_3: "3次套餐",
      pack_6: "6次套餐",
    };
    return labels[planType] || planType;
  };

  const getPlanIcon = (planType: string) => {
    if (planType.includes("vip")) return Star;
    if (planType.includes("pack")) return Package;
    return DollarSign;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-pricing">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-pricing-page">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">定价管理</h1>
          <p className="text-muted-foreground">管理套餐价格和优惠设置</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pricingSettings.map((setting) => {
          const Icon = getPlanIcon(setting.plan_type);
          const savings = setting.original_price_in_cents && setting.price_in_cents 
            ? setting.original_price_in_cents - setting.price_in_cents 
            : 0;
          const discountPercent = setting.original_price_in_cents 
            ? Math.round((1 - setting.price_in_cents / setting.original_price_in_cents) * 100)
            : 0;

          return (
            <Card 
              key={setting.id} 
              className={`relative ${!setting.is_active ? 'opacity-60' : ''}`}
              data-testid={`card-pricing-${setting.id}`}
            >
              {setting.is_featured && (
                <div className="absolute -top-2 -right-2">
                  <Badge className="bg-yellow-500 text-white" data-testid={`badge-featured-${setting.id}`}>
                    <Star className="w-3 h-3 mr-1" />
                    推荐
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-plan-name-${setting.id}`}>
                        {setting.display_name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {getPlanTypeLabel(setting.plan_type)}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleEdit(setting)}
                    data-testid={`button-edit-${setting.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-primary" data-testid={`text-price-${setting.id}`}>
                      {formatPrice(setting.price_in_cents)}
                    </span>
                    {setting.original_price_in_cents && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatPrice(setting.original_price_in_cents)}
                      </span>
                    )}
                  </div>
                  {savings > 0 && (
                    <p className="text-sm text-green-600" data-testid={`text-savings-${setting.id}`}>
                      节省 {formatPrice(savings)} ({discountPercent}% 优惠)
                    </p>
                  )}
                </div>

                {setting.description && (
                  <p className="text-sm text-muted-foreground" data-testid={`text-description-${setting.id}`}>
                    {setting.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {setting.duration_days && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{setting.duration_days}天</span>
                    </div>
                  )}
                  <Badge variant={setting.is_active ? "default" : "secondary"}>
                    {setting.is_active ? "启用" : "停用"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md" data-testid="dialog-edit-pricing">
          <DialogHeader>
            <DialogTitle>编辑定价设置</DialogTitle>
            <DialogDescription>
              修改 {selectedSetting?.display_name} 的价格和设置
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">套餐名称</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                data-testid="input-display-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayNameEn">英文名称</Label>
              <Input
                id="displayNameEn"
                value={formData.displayNameEn}
                onChange={(e) => setFormData({ ...formData, displayNameEn: e.target.value })}
                data-testid="input-display-name-en"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceInCents">价格 (分)</Label>
                <Input
                  id="priceInCents"
                  type="number"
                  value={formData.priceInCents}
                  onChange={(e) => setFormData({ ...formData, priceInCents: e.target.value })}
                  placeholder="8800 = ¥88"
                  data-testid="input-price"
                />
                {formData.priceInCents && (
                  <p className="text-xs text-muted-foreground">
                    = {formatPrice(parseInt(formData.priceInCents) || 0)}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="originalPriceInCents">原价 (分)</Label>
                <Input
                  id="originalPriceInCents"
                  type="number"
                  value={formData.originalPriceInCents}
                  onChange={(e) => setFormData({ ...formData, originalPriceInCents: e.target.value })}
                  placeholder="留空则不显示划线价"
                  data-testid="input-original-price"
                />
                {formData.originalPriceInCents && (
                  <p className="text-xs text-muted-foreground">
                    = {formatPrice(parseInt(formData.originalPriceInCents) || 0)}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="durationDays">有效期 (天)</Label>
                <Input
                  id="durationDays"
                  type="number"
                  value={formData.durationDays}
                  onChange={(e) => setFormData({ ...formData, durationDays: e.target.value })}
                  placeholder="留空则无期限"
                  data-testid="input-duration"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sortOrder">排序</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  data-testid="input-sort-order"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  data-testid="switch-is-active"
                />
                <Label htmlFor="isActive">启用套餐</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="isFeatured"
                  checked={formData.isFeatured}
                  onCheckedChange={(checked) => setFormData({ ...formData, isFeatured: checked })}
                  data-testid="switch-is-featured"
                />
                <Label htmlFor="isFeatured">推荐标签</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditDialog(false)}
              data-testid="button-cancel"
            >
              取消
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={updateMutation.isPending}
              data-testid="button-save"
            >
              {updateMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
