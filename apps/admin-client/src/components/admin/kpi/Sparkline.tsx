import { useId, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

import { cn } from "@/lib/utils";

/**
 * A shape, not a chart.
 *
 * Why this exists: a delta chip (`+12.4%`) tells you the direction but not the
 * path — a one-day spike and a month-long slide produce the same number. The
 * sparkline is what lets an operator tell those apart at a glance, which is the
 * entire reason five KPI cards are worth screen space.
 *
 * Deliberate constraints:
 *  - No axes, grid, tooltip or legend. The number next to it is the message; any
 *    chrome here is decoration that competes with it.
 *  - `null` buckets are real gaps (`connectNulls={false}`). A week with no due
 *    pool has no formation rate — drawing it as 0 would claim "we formed
 *    nothing", which is a different and false statement.
 *  - `aria-hidden`: the value and the baseline sentence are the accessible
 *    content. A screen reader should not announce a path.
 */
interface SparklineProps {
  /** Oldest → newest. `null` = no data for that bucket. */
  data: Array<number | null>;
  /** Stroke/fill colour, e.g. `hsl(var(--primary))`. */
  color?: string;
  height?: number;
  className?: string;
}

export function Sparkline({ data, color, height = 40, className }: SparklineProps) {
  const gradientId = useId();

  const points = useMemo(
    () => data.map((value, index) => ({ index, value })),
    [data],
  );

  // A single point draws nothing useful, and an all-null series is a gap, not a
  // flat line at zero.
  const hasShape = useMemo(
    () => data.filter((value) => value !== null && Number.isFinite(value)).length >= 2,
    [data],
  );

  if (!hasShape) return null;

  const stroke = color ?? "hsl(var(--primary))";

  return (
    <div
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden="true"
      data-testid="kpi-sparkline"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          {/* Starts at zero so week-to-week height is comparable across cards. */}
          <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, 1)]} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            connectNulls={false}
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default Sparkline;
