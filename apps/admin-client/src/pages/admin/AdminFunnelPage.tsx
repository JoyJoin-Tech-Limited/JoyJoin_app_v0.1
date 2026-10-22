import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Info, TrendingDown } from "lucide-react";

import AdminQueryError from "@/components/admin/AdminQueryError";
import EmptyState from "@/components/admin/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest } from "@/lib/queryClient";
import { safeFormat } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

interface Coverage {
  totalEvents: number;
  distinctTypes: number;
  lastEventAt: string | null;
  dataAvailable: boolean;
}

interface FunnelStep {
  key: string;
  label: string;
  count: number;
  rateFromStart: number | null;
  rateFromPrevious: number | null;
}

interface FunnelBranch {
  key: string;
  label: string;
  count: number;
}

interface Funnel {
  key: string;
  label: string;
  steps: FunnelStep[];
  branches: FunnelBranch[];
  dataAvailable: boolean;
  note: string | null;
}

interface Surface {
  key: string;
  label: string;
  eventCount: number;
  distinctTypes: number;
}

interface EventCount {
  eventType: string;
  count: number;
  lastSeen: string | null;
}

interface FunnelResponse {
  range: { from: string; to: string; description: string };
  funnel: Funnel;
  coverage: Coverage;
  surfaces: Surface[];
  asOf: string;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await apiRequest("GET", url);
  return (await response.json()) as T;
}

const RANGE_OPTIONS = [
  { days: 7, label: "近 7 天" },
  { days: 30, label: "近 30 天" },
  { days: 90, label: "近 90 天" },
] as const;

function formatPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

/**
 * 支付漏斗 — 单场局票从浏览到支付成功的每一步。
 *
 * Honesty rule (from lib/adminAnalytics.ts): coverage is rendered BEFORE
 * conversion. An empty event table and a 0% conversion rate look identical in a
 * chart but mean opposite things, so when there is no data the page says so
 * instead of drawing a funnel that dropped to zero.
 */
export default function AdminFunnelPage() {
  const [days, setDays] = useState<number>(30);

  const funnelQuery = useQuery({
    queryKey: ["/api/admin/analytics/funnel", days],
    queryFn: () => getJson<FunnelResponse>(`/api/admin/analytics/funnel?days=${days}`),
    staleTime: 60_000,
  });

  const funnel = funnelQuery.data?.funnel;
  const coverage = funnelQuery.data?.coverage;
  const surfaces = funnelQuery.data?.surfaces ?? [];

  const maxStepCount = useMemo(() => {
    if (!funnel || funnel.steps.length === 0) return 0;
    return Math.max(...funnel.steps.map((step) => step.count), 1);
  }, [funnel]);

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">支付漏斗</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {funnelQuery.data
            ? `${funnelQuery.data.range.description} · 数据截至 ${safeFormat(
                funnelQuery.data.asOf,
                "MM-dd HH:mm",
              )}`
            : "单场局票从浏览到支付成功的转化"}
        </p>
      </div>
      <div className="flex gap-1 rounded-md border p-1" data-testid="funnel-range">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.days}
            type="button"
            onClick={() => setDays(option.days)}
            data-testid={`funnel-range-${option.days}`}
            className={cn(
              "rounded px-3 py-1.5 text-sm transition-colors",
              days === option.days
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (funnelQuery.isLoading) {
    return (
      <div className="space-y-6 p-6" data-testid="admin-funnel-loading">
        {header}
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (funnelQuery.isError) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <AdminQueryError
          title="漏斗数据加载失败"
          error={funnelQuery.error}
          onRetry={() => funnelQuery.refetch()}
        />
      </div>
    );
  }

  const hasData = Boolean(coverage?.dataAvailable);

  return (
    <div className="space-y-6 p-6" data-testid="admin-funnel-page">
      {header}

      {!hasData && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="h-4 w-4 text-muted-foreground" />
              数据源接入中
            </CardTitle>
            <CardDescription>
              该时间段内没有记录到任何埋点事件，因此漏斗无法计算。这不是「0% 转化」，
              而是「还没有数据」。确认小程序端已发布带埋点的版本后，本页会自动出现数据。
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            已记录事件 {coverage?.totalEvents ?? 0} 条 · 事件类型 {coverage?.distinctTypes ?? 0} 种
            {coverage?.lastEventAt
              ? ` · 最近一条 ${safeFormat(coverage.lastEventAt, "MM-dd HH:mm")}`
              : ""}
          </CardContent>
        </Card>
      )}

      {hasData && funnel && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{funnel.label}</CardTitle>
            <CardDescription>
              每一步的转化率按上一步计算；整体转化率按第一步计算。支路不计入主链路。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {funnel.steps.map((step, index) => {
              const width = maxStepCount > 0 ? Math.max((step.count / maxStepCount) * 100, 2) : 2;
              return (
                <div key={step.key} data-testid={`funnel-step-${step.key}`}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="text-xs text-muted-foreground">{index + 1}</span>
                      {step.label}
                    </span>
                    <span className="flex items-center gap-3 tabular-nums text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {step.count.toLocaleString("zh-CN")}
                      </span>
                      <span className="w-14 text-right">{formatPct(step.rateFromPrevious)}</span>
                      <span className="w-16 text-right text-xs">
                        累计 {formatPct(step.rateFromStart)}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}

            {funnel.branches.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">支路（不计入主链路）</p>
                <div className="flex flex-wrap gap-2">
                  {funnel.branches.map((branch) => (
                    <Badge
                      key={branch.key}
                      variant="outline"
                      className="gap-1.5 font-normal"
                      data-testid={`funnel-branch-${branch.key}`}
                    >
                      {branch.label}
                      <span className="font-semibold tabular-nums">
                        {branch.count.toLocaleString("zh-CN")}
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {funnel.note && (
              <p className="flex items-start gap-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
                <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {funnel.note}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-muted-foreground" />
              埋点覆盖
            </CardTitle>
            <CardDescription>按产品面归类的事件量与类型数</CardDescription>
          </CardHeader>
          <CardContent>
            {surfaces.length === 0 ? (
              <EmptyState title="暂无埋点事件" description="该时间段内没有记录到事件。" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>产品面</TableHead>
                    <TableHead className="text-right">事件量</TableHead>
                    <TableHead className="text-right">类型数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {surfaces.map((surface) => (
                    <TableRow key={surface.key} data-testid={`surface-${surface.key}`}>
                      <TableCell className="font-medium">{surface.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {surface.eventCount.toLocaleString("zh-CN")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {surface.distinctTypes}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">口径说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0" />
              漏斗只统计「浏览支付页 → 切换方案 → 发起支付 → 支付成功」四个显式埋点，
              不按时间先后推断步骤。
            </p>
            <p className="flex items-start gap-2">
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0" />
              取消、失败、超时与中途离开作为支路单独展示，不折算进主链路，因此不会掩盖真实流失。
            </p>
            <p className="flex items-start gap-2">
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0" />
              事件写入与支付状态来自不同表，支付成功数以 payments.status = completed 为准。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export type { EventCount };
