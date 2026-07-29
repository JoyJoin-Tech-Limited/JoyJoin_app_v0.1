import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Gift, PackageCheck, Puzzle, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FlashEmptyState, FlashErrorState, FlashListSkeleton } from "./FlashQueryState";

type AnalyticsWindow = 7 | 30 | 90;

type EquipmentAnalytics = {
  window: {
    days: AnalyticsWindow;
    start: string;
    end: string;
    basis: "entitlement_created_at";
    timezone: "Asia/Shanghai";
  };
  summary: {
    total: number;
    pending: number;
    resolved: number;
    newItems: number;
    duplicates: number;
    fragmentsAwarded: number;
    guaranteed: number;
    claimRate: number;
    newItemRate: number;
  };
  sources: Array<{ sourceType: "blind_box" | "alang"; total: number; resolved: number }>;
  daily: Array<{
    date: string;
    total: number;
    resolved: number;
    newItems: number;
    duplicates: number;
    fragmentsAwarded: number;
  }>;
  pools: Array<{
    poolId: string;
    poolName: string;
    total: number;
    resolved: number;
    newItems: number;
    duplicates: number;
    fragmentsAwarded: number;
  }>;
};

function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function describeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/^\d+:\s*/, "") || "分析数据暂时无法加载";
}

function fillDailySeries(data: EquipmentAnalytics["daily"], startIso: string, days: number) {
  const byDate = new Map(data.map((row) => [row.date, row]));
  const start = new Date(startIso);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = date.toISOString().slice(0, 10);
    return byDate.get(key) ?? {
      date: key,
      total: 0,
      resolved: 0,
      newItems: 0,
      duplicates: 0,
      fragmentsAwarded: 0,
    };
  });
}

export function FlashEquipmentAnalytics() {
  const [days, setDays] = useState<AnalyticsWindow>(30);
  const query = useQuery<EquipmentAnalytics>({
    queryKey: [`/api/admin/equipment/analytics?days=${days}`],
  });
  const daily = useMemo(
    () => query.data ? fillDailySeries(query.data.daily, query.data.window.start, days) : [],
    [days, query.data],
  );

  if (query.isLoading) return <FlashListSkeleton />;
  if (query.isError || !query.data) {
    return <FlashErrorState message={describeError(query.error)} onRetry={() => void query.refetch()} />;
  }

  const { summary, sources, pools } = query.data;
  const sourceChart = sources.map((source) => ({
    name: source.sourceType === "blind_box" ? "盲盒活动" : "旧阿浪任务",
    资格: source.total,
    已领取: source.resolved,
  }));

  return (
    <div className="space-y-4" data-testid="panel-equipment-analytics">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">装备奖励数据分析</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            所有指标按北京时间的抽取资格创建日归入窗口，不包含用户身份、位置或私人内容。
          </p>
        </div>
        <Select value={String(days)} onValueChange={(value) => setDays(Number(value) as AnalyticsWindow)}>
          <SelectTrigger className="w-full sm:w-36" data-testid="select-equipment-analytics-window">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">最近 7 天</SelectItem>
            <SelectItem value="30">最近 30 天</SelectItem>
            <SelectItem value="90">最近 90 天</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <AnalyticsMetric label="生成资格" value={summary.total} hint={`${summary.pending} 个待领取`} icon={Gift} />
        <AnalyticsMetric label="截至当前领取率" value={percent(summary.claimRate)} hint={`${summary.resolved} 次已领取`} icon={PackageCheck} />
        <AnalyticsMetric label="新装备率" value={percent(summary.newItemRate)} hint={`${summary.newItems} 件新装备`} icon={Sparkles} />
        <AnalyticsMetric label="重复抽取" value={summary.duplicates} hint={`${summary.fragmentsAwarded} 碎片产出`} icon={Puzzle} />
        <AnalyticsMetric label="保底触发" value={summary.guaranteed} hint="第 4 抽新装备保护" icon={BarChart3} />
      </div>

      {summary.total === 0 ? (
        <FlashEmptyState
          title={`最近 ${days} 天还没有装备奖励数据`}
          description="真实活动生成抽取资格后，这里会显示领取、新装备、重复与碎片趋势。"
          icon={BarChart3}
        />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">按资格生成日观察领取结果</CardTitle>
                <CardDescription>同一天生成的资格，截至当前完成领取和获得新装备的数量；不是实际领取发生日。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72" role="img" aria-label={`最近${days}天按资格生成日统计：共${summary.total}个资格，已领取${summary.resolved}次，获得${summary.newItems}件新装备`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} minTickGap={24} />
                      <YAxis allowDecimals={false} />
                      <Tooltip labelFormatter={(value) => String(value)} />
                      <Legend />
                      <Line type="monotone" dataKey="total" name="生成资格" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="resolved" name="完成领取" stroke="#A8C5DD" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="newItems" name="新装备" stroke="#9ACD32" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">奖励来源</CardTitle>
                <CardDescription>盲盒活动场地与旧阿浪任务生成的资格及领取数。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72" role="img" aria-label={`奖励来源统计：${sourceChart.map((item) => `${item.name}${item.资格}个资格、${item.已领取}次已领取`).join("；") || "暂无来源数据"}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="资格" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="已领取" fill="#A8C5DD" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">装备池表现</CardTitle>
              <CardDescription>
                按资格数量排序，最多展示 20 个装备池。临近窗口末端的资格可能尚未领取；重复率也受用户库存和保底影响，只作观察，不直接归因于装备池质量。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pools.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">当前窗口没有装备池数据。</p>
              ) : (
                <div className="space-y-2">
                  {pools.map((pool) => {
                    const claimRate = pool.total > 0 ? pool.resolved / pool.total : 0;
                    const duplicateRate = pool.resolved > 0 ? pool.duplicates / pool.resolved : 0;
                    return (
                      <div key={pool.poolId} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_repeat(4,minmax(72px,auto))] sm:items-center">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{pool.poolName}</p>
                          <p className="text-xs text-muted-foreground">{pool.total} 个资格</p>
                        </div>
                        <PoolStat label="领取率" value={percent(claimRate)} />
                        <PoolStat label="新装备" value={String(pool.newItems)} />
                        <PoolStat label="重复率" value={percent(duplicateRate)} />
                        <PoolStat label="碎片" value={String(pool.fragmentsAwarded)} />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function AnalyticsMetric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: typeof Gift;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <span className="rounded-xl bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      </CardContent>
    </Card>
  );
}

function PoolStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium tabular-nums">{value}</p>
    </div>
  );
}
