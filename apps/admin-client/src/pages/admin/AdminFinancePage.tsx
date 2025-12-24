import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, CreditCard, TrendingUp, Receipt, Store } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

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
  payment_type: "subscription" | "event";
  status: "completed" | "pending" | "failed";
  payment_method: string;
  created_at: string;
  user_first_name: string | null;
  user_last_name: string | null;
  user_email: string | null;
}

interface VenueCommission {
  id: string;
  venue_name: string;
  commission_rate: number;
  booking_count: number;
  total_revenue: number;
  total_commission: number;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  completed: { label: "已完成", variant: "default" },
  pending: { label: "待处理", variant: "secondary" },
  failed: { label: "失败", variant: "destructive" },
};

const PAYMENT_TYPE_MAP: Record<string, { label: string; variant: "default" | "outline" }> = {
  subscription: { label: "会员", variant: "default" },
  event: { label: "活动", variant: "outline" },
};

export default function AdminFinancePage() {
  const [mainTab, setMainTab] = useState<"payments" | "commissions">("payments");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "subscription" | "event">("all");

  const { data: stats, isLoading: statsLoading } = useQuery<FinanceStats>({
    queryKey: ["/api/admin/finance/stats"],
  });

  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/admin/finance/payments", paymentFilter === "all" ? undefined : paymentFilter],
  });

  const { data: commissions = [], isLoading: commissionsLoading } = useQuery<VenueCommission[]>({
    queryKey: ["/api/admin/finance/commissions"],
  });

  const formatCurrency = (amount: number) => {
    return `¥${amount.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateTime = (dateTimeStr: string) => {
    try {
      const date = new Date(dateTimeStr);
      return format(date, "yyyy年MM月dd日 HH:mm", { locale: zhCN });
    } catch (e) {
      return dateTimeStr;
    }
  };

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
            </TabsList>
          </CardHeader>

          <CardContent>
            {/* Payment Records Tab */}
            <TabsContent value="payments" className="space-y-4">
              <Tabs value={paymentFilter} onValueChange={(v) => setPaymentFilter(v as any)}>
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

              {paymentsLoading ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-loading-payments">
                  加载中...
                </div>
              ) : payments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-no-payments">
                  暂无支付记录
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-payment-id">支付ID</TableHead>
                        <TableHead data-testid="header-user">用户</TableHead>
                        <TableHead data-testid="header-payment-type">类型</TableHead>
                        <TableHead data-testid="header-amount">金额</TableHead>
                        <TableHead data-testid="header-status">状态</TableHead>
                        <TableHead data-testid="header-payment-method">支付方式</TableHead>
                        <TableHead data-testid="header-created-at">创建时间</TableHead>
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
                <div className="py-12 text-center text-muted-foreground" data-testid="text-no-commissions">
                  暂无场地佣金数据
                </div>
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
    </div>
  );
}
