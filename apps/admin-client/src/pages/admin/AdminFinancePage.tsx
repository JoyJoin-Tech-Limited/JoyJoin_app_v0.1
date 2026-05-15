import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, CreditCard, TrendingUp, Receipt, Store, RotateCcw, HelpCircle, Download } from "lucide-react";
import { downloadCsv } from "@/lib/csvExport";
import FieldInfoTooltip from "@/components/discover/FieldInfoTooltip";
import { fmtDateTimeShort, safeFormat } from "@/lib/dateUtils";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/ui/use-toast";
import EmptyState from "@/components/admin/EmptyState";

interface FinanceStats {
  totalRevenue: number;
  subscriptionRevenue: number;
  eventRevenue: number;
  totalPayments: number;
}

interface Payment {
  id: string;
  user_id: string;
  amount: number;
  payment_type: "subscription" | "event" | "event_bundle";
  status: "completed" | "pending" | "failed" | "refunded";
  payment_method: string;
  created_at: string;
  user_first_name: string | null;
  user_last_name: string | null;
  user_email: string | null;
  event_title: string | null;
  subscription_plan: string | null;
}

interface VenueCommission {
  id: string;
  venue_name: string;
  commission_rate: number;
  booking_count: number;
  total_revenue: number;
  total_commission: number;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  completed: { label: "已完成", variant: "default" },
  pending: { label: "待处理", variant: "secondary" },
  failed: { label: "失败", variant: "destructive" },
  refunded: { label: "已退款", variant: "outline" },
};

const PAYMENT_TYPE_MAP: Record<string, { label: string; variant: "default" | "outline" }> = {
  subscription: { label: "会员", variant: "default" },
  event: { label: "活动", variant: "outline" },
  event_bundle: { label: "活动套餐", variant: "outline" },
};

interface RefundAttempt {
  id: string;
  payment_id: string;
  status: "pending" | "success" | "failed";
  reason: string | null;
  wechat_refund_id: string | null;
  amount: number;
  initiated_by: string | null;
  initiated_at: string;
  resolved_at: string | null;
  failure_reason: string | null;
  payment_wechat_order_id: string | null;
  payment_type: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  user_phone_number: string | null;
}

const REFUND_STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "退款中", variant: "secondary" },
  success: { label: "已退款", variant: "default" },
  failed: { label: "退款失败", variant: "destructive" },
};

export default function AdminFinancePage() {
  const [mainTab, setMainTab] = useState<"payments" | "commissions" | "refunds">("payments");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "subscription" | "event">("all");
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundPayment, setRefundPayment] = useState<Payment | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<FinanceStats>({
    queryKey: ["/api/admin/finance/stats"],
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: paymentFilter === "all" ? ["/api/admin/finance/payments"] : ["/api/admin/finance/payments", paymentFilter],
  });

  const { data: commissions = [], isLoading: commissionsLoading } = useQuery<VenueCommission[]>({
    queryKey: ["/api/admin/finance/commissions"],
  });

  const { data: refundAttempts = [], isLoading: refundsLoading } = useQuery<RefundAttempt[]>({
    queryKey: ["/api/admin/refund-attempts"],
  });

  const refundMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "退款失败" }));
        throw new Error(err.message || "退款失败");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "退款已提交", description: "退款申请已成功提交处理。" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finance/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/refund-attempts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finance/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/finance/commissions"] });
      setRefundDialogOpen(false);
      setRefundPayment(null);
      setRefundReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "退款失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: number) => {
    return `¥${(amount / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateTime = (dateTimeStr: string) =>
    safeFormat(dateTimeStr, "yyyy年MM月dd日 HH:mm", { fallback: dateTimeStr });

  const getUserName = (payment: Payment) => {
    const firstName = payment.user_first_name || "";
    const lastName = payment.user_last_name || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || "未知用户";
  };

  const sortedCommissions = [...commissions].sort((a, b) => b.total_commission - a.total_commission);

  if (statsLoading) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} data-testid={`skeleton-metric-${i}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">加载中...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-metric-total-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总收入</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-revenue">
              {formatCurrency(stats?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">所有收入总和</p>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-subscription-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">会员收入</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-subscription-revenue">
              {formatCurrency(stats?.subscriptionRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">会员订阅收入</p>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-event-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活动收入</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-event-revenue">
              {formatCurrency(stats?.eventRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">活动支付收入</p>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-total-payments">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总支付数</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-payments">
              {stats?.totalPayments || 0} 笔
            </div>
            <p className="text-xs text-muted-foreground">所有支付记录</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Card data-testid="card-finance-content">
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
          <CardHeader>
            <TabsList data-testid="tabs-main">
              <TabsTrigger value="payments" data-testid="tab-payments">
                支付记录
              </TabsTrigger>
              <TabsTrigger value="commissions" data-testid="tab-commissions">
                场地佣金
              </TabsTrigger>
              <TabsTrigger value="refunds" data-testid="tab-refunds" className="gap-1">
                退款历史
                {refundAttempts.some((r) => r.status === "failed") && (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {refundAttempts.filter((r) => r.status === "failed").length}
                  </span>
                )}
              </TabsTrigger>
              <div className="flex items-center px-2">
                <FieldInfoTooltip
                  title="退款流程说明"
                  description="退款申请提交后，系统会向微信支付发起退款请求。成功退款通常需要 1-3 分钟。失败的退款会显示红色标记，请检查用户账户状态或联系技术支持。"
                />
              </div>
            </TabsList>
          </CardHeader>

          <CardContent>
            {/* Payment Records Tab */}
            <TabsContent value="payments" className="space-y-4">
              <div className="flex items-center justify-between">
                <Tabs value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as "all" | "subscription" | "event")}>
                  <TabsList data-testid="tabs-payment-filter">
                    <TabsTrigger value="all" data-testid="filter-all">
                      全部
                    </TabsTrigger>
                    <TabsTrigger value="subscription" data-testid="filter-subscription">
                      会员
                    </TabsTrigger>
                    <TabsTrigger value="event" data-testid="filter-event">
                      活动
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const headers = ["ID", "用户", "类型", "金额", "关联内容", "状态", "支付方式", "创建时间"];
                    const rows = payments.map((p) => [
                      p.id,
                      `${p.user_first_name || ''} ${p.user_last_name || ''}`.trim() || p.user_email || '',
                      p.payment_type,
                      `¥${(p.amount / 100).toFixed(2)}`,
                      p.event_title || p.subscription_plan || '',
                      p.status,
                      p.payment_method,
                      fmtDateTimeShort(p.created_at),
                    ]);
                    downloadCsv({ filename: `payments-${safeFormat(new Date(), "yyyyMMdd")}.csv`, headers, rows });
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  导出 CSV
                </Button>
              </div>

              {paymentsLoading ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-loading-payments">
                  加载中...
                </div>
              ) : payments.length === 0 ? (
                <EmptyState title="暂无支付记录" data-testid="text-no-payments" />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-payment-id">支付ID</TableHead>
                        <TableHead data-testid="header-user">用户</TableHead>
                        <TableHead data-testid="header-payment-type">类型</TableHead>
                        <TableHead data-testid="header-amount">金额</TableHead>
                        <TableHead data-testid="header-context">关联内容</TableHead>
                        <TableHead data-testid="header-status">状态</TableHead>
                        <TableHead data-testid="header-payment-method">支付方式</TableHead>
                        <TableHead data-testid="header-created-at">创建时间</TableHead>
                        <TableHead data-testid="header-actions">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                          <TableCell className="font-mono text-sm" data-testid={`text-payment-id-${payment.id}`}>
                            {payment.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium" data-testid={`text-user-name-${payment.id}`}>
                                {getUserName(payment)}
                              </div>
                              {payment.user_email && (
                                <div className="text-xs text-muted-foreground" data-testid={`text-user-email-${payment.id}`}>
                                  {payment.user_email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={PAYMENT_TYPE_MAP[payment.payment_type]?.variant || "outline"}
                              data-testid={`badge-payment-type-${payment.id}`}
                            >
                              {PAYMENT_TYPE_MAP[payment.payment_type]?.label || payment.payment_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold" data-testid={`text-amount-${payment.id}`}>
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell data-testid={`text-context-${payment.id}`}>
                            {payment.event_title ? (
                              <span className="text-sm text-muted-foreground">{payment.event_title}</span>
                            ) : payment.subscription_plan ? (
                              <Badge variant="secondary" className="text-xs">{payment.subscription_plan}</Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={STATUS_MAP[payment.status]?.variant || "secondary"}
                              data-testid={`badge-status-${payment.id}`}
                            >
                              {STATUS_MAP[payment.status]?.label || payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-payment-method-${payment.id}`}>
                            {payment.payment_method === "wechat_pay" ? "微信支付" : payment.payment_method}
                          </TableCell>
                          <TableCell className="text-sm" data-testid={`text-created-at-${payment.id}`}>
                            {formatDateTime(payment.created_at)}
                          </TableCell>
                          <TableCell>
                            {payment.status === "completed" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRefundPayment(payment);
                                  setRefundDialogOpen(true);
                                }}
                                data-testid={`btn-refund-${payment.id}`}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" />
                                退款
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Refund History Tab */}
            <TabsContent value="refunds" className="space-y-4">
              <div className="flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams();
                    const since = new Date();
                    since.setDate(since.getDate() - 30);
                    params.append("since", since.toISOString());
                    window.open(`/api/admin/refund-attempts/export?${params.toString()}`);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  导出 CSV
                </Button>
              </div>
              {refundsLoading ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-loading-refunds">
                  加载中...
                </div>
              ) : refundAttempts.length === 0 ? (
                <EmptyState title="暂无退款记录" data-testid="text-no-refunds" />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>退款ID</TableHead>
                        <TableHead>用户</TableHead>
                        <TableHead>支付类型</TableHead>
                        <TableHead>金额</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>原因</TableHead>
                        <TableHead>发起时间</TableHead>
                        <TableHead>完成时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {refundAttempts.map((attempt) => (
                        <TableRow key={attempt.id} data-testid={`row-refund-${attempt.id}`}>
                          <TableCell className="font-mono text-sm">
                            {attempt.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {`${attempt.user_first_name || ""} ${attempt.user_last_name || ""}`.trim() || "未知用户"}
                            </div>
                            {attempt.user_phone_number && (
                              <div className="text-xs text-muted-foreground">{attempt.user_phone_number}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={PAYMENT_TYPE_MAP[attempt.payment_type || ""]?.variant || "outline"}>
                              {PAYMENT_TYPE_MAP[attempt.payment_type || ""]?.label || attempt.payment_type || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(attempt.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={REFUND_STATUS_MAP[attempt.status]?.variant || "secondary"}>
                              {REFUND_STATUS_MAP[attempt.status]?.label || attempt.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm" title={attempt.reason || undefined}>
                            {attempt.reason || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDateTime(attempt.initiated_at)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {attempt.resolved_at ? formatDateTime(attempt.resolved_at) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Venue Commissions Tab */}
            <TabsContent value="commissions" className="space-y-4">
              {commissionsLoading ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-loading-commissions">
                  加载中...
                </div>
              ) : sortedCommissions.length === 0 ? (
                <EmptyState title="暂无场地佣金数据" data-testid="text-no-commissions" />
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-venue-name">场地名称</TableHead>
                        <TableHead data-testid="header-commission-rate">佣金比例</TableHead>
                        <TableHead data-testid="header-booking-count">预订数量</TableHead>
                        <TableHead data-testid="header-total-revenue">总营收</TableHead>
                        <TableHead data-testid="header-total-commission">总佣金</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedCommissions.map((commission) => (
                        <TableRow key={commission.id} data-testid={`row-commission-${commission.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Store className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium" data-testid={`text-venue-name-${commission.id}`}>
                                {commission.venue_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-commission-rate-${commission.id}`}>
                            {commission.commission_rate}%
                          </TableCell>
                          <TableCell data-testid={`text-booking-count-${commission.id}`}>
                            {commission.booking_count} 次
                          </TableCell>
                          <TableCell className="font-semibold" data-testid={`text-total-revenue-${commission.id}`}>
                            {formatCurrency(commission.total_revenue)}
                          </TableCell>
                          <TableCell className="font-semibold text-primary" data-testid={`text-total-commission-${commission.id}`}>
                            {formatCurrency(commission.total_commission)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认退款</DialogTitle>
            <DialogDescription>
              为用户 <strong>{refundPayment ? getUserName(refundPayment) : ""}</strong> 的支付{" "}
              <span className="font-mono">{refundPayment?.id.slice(0, 8)}...</span>{" "}
              申请退款，金额 <strong>{refundPayment ? formatCurrency(refundPayment.amount) : ""}</strong>。
              {refundPayment?.event_title && (
                <span className="block mt-1">活动: <strong>{refundPayment.event_title}</strong></span>
              )}
              {refundPayment?.subscription_plan && (
                <span className="block mt-1">订阅计划: <strong>{refundPayment.subscription_plan}</strong></span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">退款原因</label>
              <Textarea
                placeholder="请输入退款原因（必填）"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                data-testid="input-refund-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!refundPayment || !refundReason.trim()) return;
                refundMutation.mutate({ paymentId: refundPayment.id, reason: refundReason.trim() });
              }}
              disabled={!refundReason.trim() || refundMutation.isPending}
              data-testid="btn-confirm-refund"
            >
              {refundMutation.isPending ? "处理中..." : "确认退款"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
