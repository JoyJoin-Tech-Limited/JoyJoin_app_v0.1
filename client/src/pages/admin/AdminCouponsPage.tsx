import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Ticket, Plus, Edit, TrendingUp, Users, DollarSign } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { format, isPast, isFuture } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  valid_from: string;
  valid_until: string | null;
  usage_limit: number | null;
  is_active: boolean;
  created_at: string;
  used_count: string;
}

export default function AdminCouponsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    code: "",
    discountType: "percentage",
    discountValue: "",
    validFrom: "",
    validUntil: "",
    maxUses: "",
  });

  const { toast } = useToast();

  const { data: coupons = [], isLoading } = useQuery<Coupon[]>({
    queryKey: ["/api/admin/coupons"],
  });

  const { data: usageStats = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/coupons", selectedCoupon?.id, "usage"],
    enabled: !!selectedCoupon && showUsageDialog,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: "优惠券创建成功",
        description: "优惠券已成功创建",
      });
    },
    onError: () => {
      toast({
        title: "创建失败",
        description: "无法创建优惠券，请重试",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fetch(`/api/admin/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
      setShowEditDialog(false);
      setSelectedCoupon(null);
      toast({
        title: "更新成功",
        description: "优惠券已更新",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      discountType: "percentage",
      discountValue: "",
      validFrom: "",
      validUntil: "",
      maxUses: "",
    });
  };

  const handleCreate = () => {
    if (!formData.code || !formData.discountValue) {
      toast({
        title: "信息不完整",
        description: "请填写所有必填字段",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      code: formData.code,
      discountType: formData.discountType,
      discountValue: parseFloat(formData.discountValue),
      validFrom: formData.validFrom || undefined,
      validUntil: formData.validUntil || undefined,
      maxUses: formData.maxUses ? parseInt(formData.maxUses) : undefined,
    });
  };

  const handleEdit = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setFormData({
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value.toString(),
      validFrom: coupon.valid_from ? format(new Date(coupon.valid_from), "yyyy-MM-dd") : "",
      validUntil: coupon.valid_until ? format(new Date(coupon.valid_until), "yyyy-MM-dd") : "",
      maxUses: coupon.max_uses?.toString() || "",
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!selectedCoupon) return;

    updateMutation.mutate({
      id: selectedCoupon.id,
      data: {
        code: formData.code,
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        validFrom: formData.validFrom || undefined,
        validUntil: formData.validUntil || undefined,
        maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
      },
    });
  };

  const toggleActive = (coupon: Coupon) => {
    updateMutation.mutate({
      id: coupon.id,
      data: { isActive: !coupon.is_active },
    });
  };

  const viewUsage = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setShowUsageDialog(true);
  };

  const getStatusBadge = (coupon: Coupon) => {
    if (!coupon.is_active) {
      return <Badge variant="secondary">已禁用</Badge>;
    }
    if (coupon.valid_until && isPast(new Date(coupon.valid_until))) {
      return <Badge variant="destructive">已过期</Badge>;
    }
    if (coupon.usage_limit && parseInt(coupon.used_count) >= coupon.usage_limit) {
      return <Badge variant="secondary">已用完</Badge>;
    }
    return <Badge className="bg-green-500">活跃</Badge>;
  };

  const getDiscountDisplay = (coupon: Coupon) => {
    if (coupon.discount_type === "percentage") {
      return `${coupon.discount_value}% 折扣`;
    }
    return `¥${coupon.discount_value} 减免`;
  };

  const activeCoupons = coupons.filter(
    (c) => c.is_active && (!c.valid_until || isFuture(new Date(c.valid_until)))
  ).length;

  const totalUsage = coupons.reduce((sum, c) => sum + parseInt(c.used_count || "0"), 0);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">优惠券管理</h1>
          <p className="text-muted-foreground mt-1">创建和管理平台优惠券</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-coupon">
          <Plus className="h-4 w-4 mr-2" />
          创建优惠券
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃优惠券</CardTitle>
            <Ticket className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCoupons}</div>
            <p className="text-xs text-muted-foreground">当前可用优惠券</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总优惠券数</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coupons.length}</div>
            <p className="text-xs text-muted-foreground">历史创建总数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总使用次数</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage}</div>
            <p className="text-xs text-muted-foreground">累计使用次数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">优惠总额</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">待统计</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
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
      ) : coupons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无优惠券记录
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <Card key={coupon.id} data-testid={`card-coupon-${coupon.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg font-bold">{coupon.code}</CardTitle>
                  <p className="text-sm text-muted-foreground">{getDiscountDisplay(coupon)}</p>
                </div>
                {getStatusBadge(coupon)}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">使用次数</span>
                    <span className="font-medium">
                      {coupon.used_count}
                      {coupon.usage_limit && ` / ${coupon.usage_limit}`}
                    </span>
                  </div>
                  {coupon.valid_from && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">开始日期</span>
                      <span className="font-medium">
                        {format(new Date(coupon.valid_from), "yyyy/MM/dd")}
                      </span>
                    </div>
                  )}
                  {coupon.valid_until && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">结束日期</span>
                      <span className="font-medium">
                        {format(new Date(coupon.valid_until), "yyyy/MM/dd")}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleEdit(coupon)}
                    data-testid={`button-edit-${coupon.id}`}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => viewUsage(coupon)}
                    data-testid={`button-usage-${coupon.id}`}
                  >
                    查看使用
                  </Button>
                  <Button
                    size="sm"
                    variant={coupon.is_active ? "destructive" : "default"}
                    onClick={() => toggleActive(coupon)}
                    data-testid={`button-toggle-${coupon.id}`}
                  >
                    {coupon.is_active ? "禁用" : "启用"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建优惠券</DialogTitle>
            <DialogDescription>创建新的优惠券代码</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="code">优惠码 *</Label>
              <Input
                id="code"
                placeholder="SUMMER2024"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                data-testid="input-code"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountType">折扣类型 *</Label>
              <Select value={formData.discountType} onValueChange={(v) => setFormData({ ...formData, discountType: v })}>
                <SelectTrigger data-testid="select-discount-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">百分比折扣</SelectItem>
                  <SelectItem value="fixed">固定金额</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountValue">
                折扣数值 * {formData.discountType === "percentage" ? "(0-100)" : "(¥)"}
              </Label>
              <Input
                id="discountValue"
                type="number"
                min="0"
                max={formData.discountType === "percentage" ? "100" : undefined}
                placeholder={formData.discountType === "percentage" ? "20" : "50"}
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                data-testid="input-discount-value"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="validFrom">开始日期</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  data-testid="input-valid-from"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="validUntil">结束日期</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  data-testid="input-valid-until"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxUses">最大使用次数（留空为无限制）</Label>
              <Input
                id="maxUses"
                type="number"
                min="1"
                placeholder="100"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                data-testid="input-max-uses"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }} data-testid="button-cancel">
              取消
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-coupon">
              {createMutation.isPending ? "创建中..." : "创建优惠券"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑优惠券</DialogTitle>
            <DialogDescription>修改优惠券信息</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-code">优惠码</Label>
              <Input
                id="edit-code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                data-testid="input-edit-code"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-discountValue">
                折扣数值 {formData.discountType === "percentage" ? "(0-100)" : "(¥)"}
              </Label>
              <Input
                id="edit-discountValue"
                type="number"
                value={formData.discountValue}
                onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                data-testid="input-edit-discount-value"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-validFrom">开始日期</Label>
                <Input
                  id="edit-validFrom"
                  type="date"
                  value={formData.validFrom}
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  data-testid="input-edit-valid-from"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-validUntil">结束日期</Label>
                <Input
                  id="edit-validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  data-testid="input-edit-valid-until"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-maxUses">最大使用次数</Label>
              <Input
                id="edit-maxUses"
                type="number"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                data-testid="input-edit-max-uses"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} data-testid="button-cancel-edit">
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-submit-edit">
              {updateMutation.isPending ? "更新中..." : "更新优惠券"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showUsageDialog} onOpenChange={setShowUsageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>使用记录 - {selectedCoupon?.code}</DialogTitle>
            <DialogDescription>查看优惠券使用详情</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {usageStats.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">暂无使用记录</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {usageStats.map((usage: any, index: number) => (
                  <Card key={index}>
                    <CardContent className="py-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-medium">
                            {usage.first_name} {usage.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">{usage.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {format(new Date(usage.used_at), "yyyy/MM/dd HH:mm")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setShowUsageDialog(false)} data-testid="button-close-usage">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
