import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertOctagon, ArrowRight, BarChart3, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard, formatKpiValue, type AdminKpi } from "@/components/admin/kpi/KpiCard";
import { ActionQueue, type ActionQueueRow } from "@/components/admin/kpi/ActionQueue";
import { TrendCard } from "@/components/admin/kpi/TrendCard";
import AdminQueryError from "@/components/admin/AdminQueryError";
import { apiRequest } from "@/lib/queryClient";
import { safeFormat } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

interface KpiResponse {
  range: { from: string; to: string; previousFrom: string; description: string };
  kpis: AdminKpi[];
  latency: {
    system: { p50: number | null; p90: number | null; sampleSize: number };
    approval: { p50: number | null; sampleSize: number } | null;
  };
  asOf: string;
}

interface QueueResponse {
  rows: ActionQueueRow[];
  totals: { open: number; critical: number };
  asOf: string;
}

const RANGE_OPTIONS = [
  { days: 7, label: "近 7 天" },
  { days: 30, label: "近 30 天" },
  { days: 90, label: "近 90 天" },
];

async function getJson<T>(url: string): Promise<T> {
  const res = await apiRequest("GET", url);
  return (await res.json()) as T;
}

/**
 * Deterministic insight sentences.
 *
 * These are NOT model output and NOT new numbers — every sentence restates a
 * figure already visible on the page and names the next action. If nothing
 * crosses a threshold, the strip says so instead of manufacturing a headline.
 */
function buildInsights(kpis: AdminKpi[], queue: ActionQueueRow[] | undefined): string[] {
  const out: string[] = [];
  const critical = queue?.filter((r) => !r.cleared && r.severity === "critical") ?? [];

  if (critical.length > 0) {
    out.push(
      `${critical.length} 项紧急事项待处理：${critical.map((r) => r.label).join("、")}。左侧优先清空。`,
    );
  }

  const formation = kpis.find((k) => k.key === "formation_rate");
  if (formation && formation.value !== null && formation.deltaPct !== null) {
    if (formation.deltaPct <= -5) {
      out.push(
        `成行率 ${formation.value.toFixed(1)}%，较上一周期下降 ${Math.abs(formation.deltaPct).toFixed(1)}%，先看「即将截止 · 报名不足」的场次。`,
      );
    } else if (formation.deltaPct >= 5) {
      out.push(
        `成行率 ${formation.value.toFixed(1)}%，较上一周期上升 ${formation.deltaPct.toFixed(1)}%。`,
      );
    }
  }

  const latency = kpis.find((k) => k.key === "match_latency_p50");
  if (latency && latency.value !== null && latency.deltaPct !== null && latency.deltaPct >= 10) {
    out.push(
      `排桌时延 ${formatKpiValue(latency.value, latency.unit)}，比上一周期慢 ${latency.deltaPct.toFixed(0)}%，值得看是哪一类场次拖慢了。`,
    );
  }

  const revenue = kpis.find((k) => k.key === "revenue_per_formed_event");
  if (revenue && revenue.value !== null) {
    out.push(
      `单场票实收 ${formatKpiValue(revenue.value, revenue.unit)}。只含单场局票现金，不含连局包与月卡预付款；也不含场地成本，因此不等于毛利。`,
    );
  }

  if (out.length === 0) {
    // 注意措辞：这里没有任何阈值，所以「一切正常」是无法被验证的断言。
    // 只能说「本次没有规则命中」，不能说「指标在正常区间内」。
    out.push("本期没有触发异常规则。尚未设置指标阈值，因此这里不做「是否正常」的判定。");
  }

  return out;
}

export default function AdminDashboardV2() {
  const [days, setDays] = useState(30);

  const kpiQuery = useQuery<KpiResponse>({
    queryKey: ["/api/admin/kpi", days],
    queryFn: () => getJson<KpiResponse>(`/api/admin/kpi?days=${days}`),
    staleTime: 60_000,
  });

  const queueQuery = useQuery<QueueResponse>({
    queryKey: ["/api/admin/action-queue"],
    queryFn: () => getJson<QueueResponse>("/api/admin/action-queue"),
    staleTime: 60_000,
  });

  const insights = useMemo(
    () => buildInsights(kpiQuery.data?.kpis ?? [], queueQuery.data?.rows),
    [kpiQuery.data, queueQuery.data],
  );

  const asOf = kpiQuery.data?.asOf ?? queueQuery.data?.asOf;

  return (
    <div className="p-6 space-y-5" data-testid="admin-dashboard-v2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">运营指挥台</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {kpiQuery.data?.range.description ?? "加载中"}
            {asOf ? ` · 数据截至 ${safeFormat(asOf, "MM-dd HH:mm")}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5" role="group" aria-label="时间范围">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setDays(option.days)}
                data-testid={`range-${option.days}`}
                className={cn(
                  "rounded px-2.5 py-1 text-xs transition-colors",
                  days === option.days
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/data-insights" data-testid="link-analytics">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              经营分析
            </Link>
          </Button>
        </div>
      </div>

      {kpiQuery.isError ? (
        <AdminQueryError
          title="指标加载失败"
          error={kpiQuery.error}
          onRetry={() => kpiQuery.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {kpiQuery.isLoading
            ? Array.from({ length: 5 }).map((_, i) => <KpiCard key={i} kpi={null as never} loading />)
            : kpiQuery.data?.kpis.map((kpi) => <KpiCard key={kpi.key} kpi={kpi} />)}
        </div>
      )}

      {/* Insight strip — restates visible numbers, never invents one. */}
      <Card className="border-primary/15 bg-primary/[0.03]">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
            <Info className="h-3.5 w-3.5" />
            本期解读
          </div>
          <ul className="space-y-1" data-testid="insight-strip">
            {insights.map((line, i) => (
              <li key={i} className="text-sm leading-relaxed text-foreground/90">
                {line}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* One trend, above the queue: the queue says what to do today, this says
          whether the business underneath it is moving. */}
      <TrendCard
        kpi={kpiQuery.data?.kpis.find((kpi) => kpi.key === "new_registrations")}
        from={kpiQuery.data?.range.from}
        title="新增报名走势"
        caption="按周汇总的报名人数。这是供给的上游 —— 报名少，后面的成行与收入都不会发生。"
      />

      {queueQuery.isError ? (
        <AdminQueryError
          title="待办加载失败"
          error={queueQuery.error}
          onRetry={() => queueQuery.refetch()}
        />
      ) : (
        <ActionQueue
          rows={queueQuery.data?.rows}
          totals={queueQuery.data?.totals}
          loading={queueQuery.isLoading}
        />
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card>
          <CardContent className="p-4 space-y-1.5">
            <div className="text-xs text-muted-foreground">排桌时延 · 系统段 P50</div>
            {kpiQuery.isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-xl font-semibold tabular-nums">
                {formatKpiValue(kpiQuery.data?.latency.system.p50 ?? null, "hours")}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground/80">
              报名截止 → 完成排桌，共 {kpiQuery.data?.latency.system.sampleSize ?? 0} 个样本
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1.5">
            <div className="text-xs text-muted-foreground">排桌时延 · 审批段 P50</div>
            {kpiQuery.data?.latency.approval ? (
              <>
                <div className="text-xl font-semibold tabular-nums">
                  {formatKpiValue(kpiQuery.data.latency.approval.p50, "hours")}
                </div>
                <p className="text-[11px] text-muted-foreground/80">
                  排桌完成 → 运营通过，共 {kpiQuery.data.latency.approval.sampleSize} 个样本
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground pt-1">
                审批开关关闭，当前无审批环节，指标不适用。
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-1.5">
            <div className="text-xs text-muted-foreground">紧急度</div>
            <div className="flex items-center gap-1.5">
              <AlertOctagon
                className={cn(
                  "h-4 w-4",
                  (queueQuery.data?.totals.critical ?? 0) > 0 ? "text-rose-600" : "text-muted-foreground/40",
                )}
              />
              <span className="text-xl font-semibold tabular-nums">
                {queueQuery.data?.totals.critical ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">项紧急</span>
            </div>
            <Link
              href="/admin/war-room"
              className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
            >
              进入今日战情
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-muted-foreground/60">
        旧版看板仍在，<Link href="/admin/dashboard?v=1" className="underline">切换到旧版</Link>。
      </p>
    </div>
  );
}
