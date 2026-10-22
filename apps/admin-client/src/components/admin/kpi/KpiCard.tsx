import { TrendingDown, TrendingUp, Minus, Lock, Info } from "lucide-react";
import { Link } from "wouter";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type AdminKpiUnit = "count" | "percent" | "hours" | "cny" | "cents";

export interface AdminKpi {
  key: string;
  label: string;
  value: number | null;
  unit: AdminKpiUnit;
  previous: number | null;
  deltaPct: number | null;
  insufficientBaseline: boolean;
  baseline: string;
  drill?: { label: string; href: string } | null;
  asOf: string;
  restricted?: boolean;
}

/** Metrics where a DECREASE is the good outcome. */
const LOWER_IS_BETTER = new Set([
  "match_latency_p50",
  "approval_latency_p50",
]);

function compactZh(n: number): string {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1).replace(/\.0$/, "")}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1).replace(/\.0$/, "")}万`;
  return n.toLocaleString("zh-CN");
}

export function formatKpiValue(value: number | null, unit: AdminKpiUnit): string {
  if (value === null || Number.isNaN(value)) return "—";
  switch (unit) {
    case "count":
      return compactZh(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "hours":
      return value < 10 ? `${value.toFixed(1)} 小时` : `${value.toFixed(0)} 小时`;
    case "cents": {
      const yuan = value / 100;
      return `¥${yuan >= 1000 ? yuan.toLocaleString("zh-CN", { maximumFractionDigits: 0 }) : yuan.toFixed(2)}`;
    }
    case "cny":
      return `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
    default:
      return String(value);
  }
}

interface KpiCardProps {
  kpi: AdminKpi;
  loading?: boolean;
}

export function KpiCard({ kpi, loading }: KpiCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-3 w-40" />
        </CardContent>
      </Card>
    );
  }

  if (kpi.restricted) {
    return (
      <Card data-testid={`kpi-${kpi.key}`}>
        <CardContent className="p-4 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">{kpi.label}</div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span className="text-sm">仅超级管理员可见</span>
          </div>
          <p className="text-xs text-muted-foreground/70">收入类指标按权限脱敏</p>
        </CardContent>
      </Card>
    );
  }

  const hasDelta = kpi.deltaPct !== null && !kpi.insufficientBaseline;
  const good =
    kpi.deltaPct === null || kpi.deltaPct === 0
      ? null
      : LOWER_IS_BETTER.has(kpi.key)
        ? kpi.deltaPct < 0
        : kpi.deltaPct > 0;

  const DeltaIcon = !hasDelta ? Minus : kpi.deltaPct! > 0 ? TrendingUp : TrendingDown;

  return (
    <Card data-testid={`kpi-${kpi.key}`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
          {kpi.drill ? (
            <Link
              href={kpi.drill.href}
              className="text-xs text-primary hover:underline shrink-0"
              data-testid={`kpi-${kpi.key}-drill`}
            >
              明细
            </Link>
          ) : null}
        </div>

        <div className="text-2xl font-semibold tabular-nums tracking-tight">
          {formatKpiValue(kpi.value, kpi.unit)}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          {kpi.insufficientBaseline ? (
            <span
              className="inline-flex items-center gap-1 text-muted-foreground"
              title="上一周期没有可比数据，因此不显示变化率"
            >
              <Info className="h-3 w-3" />
              基线不足
            </span>
          ) : hasDelta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 tabular-nums font-medium",
                good === null && "text-muted-foreground",
                good === true && "text-emerald-600",
                good === false && "text-rose-600",
              )}
            >
              <DeltaIcon className="h-3 w-3" />
              {Math.abs(kpi.deltaPct!).toFixed(1)}%
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <Minus className="h-3 w-3" />
              持平
            </span>
          )}
          <span className="text-muted-foreground/70">vs 上一周期</span>
        </div>

        {/* The baseline is part of the number, not a tooltip. A KPI without a
            named baseline must not be displayed at all. */}
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">{kpi.baseline}</p>
      </CardContent>
    </Card>
  );
}

export default KpiCard;
