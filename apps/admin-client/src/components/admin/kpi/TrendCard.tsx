import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AdminKpi } from "./KpiCard";
import { Card, CardContent } from "@/components/ui/card";
import { safeFormat } from "@/lib/dateUtils";

interface TrendCardProps {
  kpi: AdminKpi | undefined;
  from: string | undefined;
  title: string;
  caption: string;
}

/**
 * One trend, not five.
 *
 * The KPI cards each carry a sparkline, which answers "is this going up or down".
 * A single larger chart answers a different question: *when* did it move. At this
 * scale (a handful of pools a month) that is the difference between "supply is
 * shrinking" and "we had a quiet week" — and only the larger chart makes the
 * monthly rhythm visible.
 *
 * Deliberately one chart and not a chart wall: the audit that preceded this
 * rebuild found the console already had 15 stacked blocks, and adding five
 * charts would have reproduced the same problem with prettier furniture.
 */
export function TrendCard({ kpi, from, title, caption }: TrendCardProps) {
  const points = useMemo(() => {
    if (!kpi?.series || !from) return [];
    const start = new Date(from).getTime();
    if (Number.isNaN(start)) return [];

    return kpi.series.map((value, index) => ({
      // Buckets are 7 days wide, matching the SQL in getKpiSeries.
      label: safeFormat(new Date(start + index * 7 * 24 * 60 * 60 * 1000), "MM-dd"),
      value,
    }));
  }, [kpi?.series, from]);

  const hasShape = points.filter((point) => typeof point.value === "number").length >= 2;
  if (!hasShape) return null;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{caption}</p>
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            每格 7 天
          </span>
        </div>

        <div className="h-[140px] w-full" data-testid="trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ stroke: "hsl(var(--border))" }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(value) => [
                  typeof value === "number" ? value.toLocaleString("zh-CN") : "—",
                  title,
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={1.75}
                fill="url(#trend-fill)"
                // A week with no denominator has no value — leave a gap rather
                // than drawing a zero that asserts the number was nil.
                connectNulls={false}
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
