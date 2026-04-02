import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Database,
  Download,
  MapPin,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type ReadinessStatus = "ready" | "watch" | "needs_data";
type WarningLevel = "healthy" | "watch" | "critical";

interface OutcomeAnalyticsMetric {
  id: string;
  label: string;
  count: number;
  target: number;
  coverageRate: number;
  status: ReadinessStatus;
}

interface OutcomeAnalyticsCohort {
  key: string;
  city: string;
  eventType: string;
  archetype: string;
  submissionCount: number;
  uniqueUsers: number;
  completeSubmissions: number;
  completionRate: number;
  atmosphereLabelUsers: number;
  connectionLabelUsers: number;
  deepFeedbackUsers: number;
  triggerLabelUsers: number;
  dialogueFeedbackUsers: number;
  feedbackCoverageRate: number;
  deepFeedbackCoverageRate: number;
  warningLevel: WarningLevel;
  warningReasons: string[];
}

interface OutcomeAnalyticsResponse {
  generatedAt: string;
  overview: {
    submissionCount: number;
    completeSubmissions: number;
    completionRate: number;
    labeledUsers: number;
    uniqueUsers: number;
    poolCount: number;
    cityCount: number;
    archetypeCount: number;
    outcomeSummaryCount: number;
  };
  coverage: {
    cities: string[];
    eventTypes: string[];
    archetypes: string[];
  };
  readinessMetrics: OutcomeAnalyticsMetric[];
  cohorts: OutcomeAnalyticsCohort[];
  underInstrumentedCohorts: OutcomeAnalyticsCohort[];
  modelReadiness: {
    activeConfigName: string | null;
    totalMatches: number;
    successfulMatches: number;
    averageSatisfaction: number;
    configUpdatedAt: string | null;
    latestWeightsRecordedAt: string | null;
    triggerCount: number;
    avgTriggerEffectiveness: number;
    dialogueFeedbackCount: number;
    avgDialogueRating: number;
    outcomeSummaryCount: number;
    status: ReadinessStatus;
  };
}

const STATUS_LABELS: Record<ReadinessStatus, { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-emerald-100 text-emerald-700" },
  watch: { label: "Watch", className: "bg-amber-100 text-amber-700" },
  needs_data: { label: "Gap", className: "bg-rose-100 text-rose-700" },
};

const WARNING_LABELS: Record<WarningLevel, { label: string; className: string }> = {
  healthy: { label: "健康", className: "bg-emerald-100 text-emerald-700" },
  watch: { label: "观察", className: "bg-amber-100 text-amber-700" },
  critical: { label: "预警", className: "bg-rose-100 text-rose-700" },
};

const CHART_COLORS = ["#7c3aed", "#06b6d4", "#f97316", "#22c55e", "#ec4899", "#6366f1"];

function percent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function downloadCsv(rows: OutcomeAnalyticsCohort[]) {
  const header = [
    "city",
    "event_type",
    "archetype",
    "submission_count",
    "unique_users",
    "complete_submissions",
    "completion_rate",
    "feedback_coverage_rate",
    "deep_feedback_coverage_rate",
    "warning_level",
    "warning_reasons",
  ];

  const csvRows = rows.map((row) =>
    [
      row.city,
      row.eventType,
      row.archetype,
      row.submissionCount,
      row.uniqueUsers,
      row.completeSubmissions,
      row.completionRate.toFixed(4),
      row.feedbackCoverageRate.toFixed(4),
      row.deepFeedbackCoverageRate.toFixed(4),
      row.warningLevel,
      row.warningReasons.join(" / "),
    ]
      .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
      .join(","),
  );

  const blob = new Blob([[header.join(","), ...csvRows].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "outcome-analytics-view.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function AdminOutcomeAnalyticsPage() {
  const [cityFilter, setCityFilter] = useState("all");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [archetypeFilter, setArchetypeFilter] = useState("all");

  const { data, isLoading, error } = useQuery<OutcomeAnalyticsResponse>({
    queryKey: ["/api/admin/outcome-analytics"],
  });

  const filteredCohorts = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.cohorts.filter((cohort) => {
      if (cityFilter !== "all" && cohort.city !== cityFilter) {
        return false;
      }
      if (eventTypeFilter !== "all" && cohort.eventType !== eventTypeFilter) {
        return false;
      }
      if (archetypeFilter !== "all" && cohort.archetype !== archetypeFilter) {
        return false;
      }
      return true;
    });
  }, [archetypeFilter, cityFilter, data, eventTypeFilter]);

  const segmentedCharts = useMemo(() => {
    const byCity = new Map<string, number>();
    const byEventType = new Map<string, number>();
    const byArchetype = new Map<string, number>();

    filteredCohorts.forEach((cohort) => {
      byCity.set(cohort.city, (byCity.get(cohort.city) ?? 0) + cohort.submissionCount);
      byEventType.set(
        cohort.eventType,
        (byEventType.get(cohort.eventType) ?? 0) + cohort.submissionCount,
      );
      byArchetype.set(
        cohort.archetype,
        (byArchetype.get(cohort.archetype) ?? 0) + cohort.submissionCount,
      );
    });

    return {
      city: Array.from(byCity.entries()).map(([name, value]) => ({ name, value })),
      eventType: Array.from(byEventType.entries()).map(([name, value]) => ({
        name,
        value,
      })),
      archetype: Array.from(byArchetype.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    };
  }, [filteredCohorts]);

  const filteredReadiness = useMemo(() => {
    const totals = filteredCohorts.reduce(
      (acc, cohort) => {
        acc.sampleUsers += cohort.uniqueUsers;
        acc.completeSubmissions += cohort.completeSubmissions;
        acc.submissions += cohort.submissionCount;
        acc.atmosphere += cohort.atmosphereLabelUsers;
        acc.connection += cohort.connectionLabelUsers;
        acc.deep += cohort.deepFeedbackUsers;
        acc.trigger += cohort.triggerLabelUsers;
        acc.dialogue += cohort.dialogueFeedbackUsers;
        return acc;
      },
      {
        sampleUsers: 0,
        submissions: 0,
        completeSubmissions: 0,
        atmosphere: 0,
        connection: 0,
        deep: 0,
        trigger: 0,
        dialogue: 0,
      },
    );

    const sampleUsers = totals.sampleUsers || 1;
    const submissions = totals.submissions || 1;

    return [
      {
        label: "完整报名",
        count: totals.completeSubmissions,
        coverageRate: totals.completeSubmissions / submissions,
      },
      {
        label: "氛围评分",
        count: totals.atmosphere,
        coverageRate: totals.atmosphere / sampleUsers,
      },
      {
        label: "连接结果",
        count: totals.connection,
        coverageRate: totals.connection / sampleUsers,
      },
      {
        label: "深度反馈",
        count: totals.deep,
        coverageRate: totals.deep / sampleUsers,
      },
      {
        label: "触发器效果",
        count: totals.trigger,
        coverageRate: totals.trigger / sampleUsers,
      },
    ];
  }, [filteredCohorts]);

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Outcome analytics 加载失败
            </CardTitle>
            <CardDescription>请稍后重试或检查后台接口状态。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8" data-testid="admin-outcome-analytics-page">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Database className="h-7 w-7 text-primary" />
            Outcome / AI Readiness
          </h1>
          <p className="mt-1 text-muted-foreground">
            监控 outcome schema 使用、满意度标签覆盖，以及城市 / 活动 / archetype cohort 的建模准备度。
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => downloadCsv(filteredCohorts)}
          disabled={!filteredCohorts.length}
          data-testid="button-export-outcome-analytics"
        >
          <Download className="mr-2 h-4 w-4" />
          导出当前视图 CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading || !data
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))
          : (
            <>
              <Card data-testid="card-outcome-submissions">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">报名样本量</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.overview.submissionCount}</div>
                  <p className="text-xs text-muted-foreground">
                    覆盖 {data.overview.uniqueUsers} 位用户 / {data.overview.poolCount} 个活动池
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-outcome-completeness">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">提交完整度</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{percent(data.overview.completionRate)}</div>
                  <p className="text-xs text-muted-foreground">
                    {data.overview.completeSubmissions} 份满足建模前置字段
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-outcome-coverage">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">覆盖广度</CardTitle>
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {data.overview.cityCount} / {data.overview.archetypeCount}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    城市 / archetype 维度已落样
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-outcome-model-status">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium">模型准备度</CardTitle>
                  <Brain className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">{data.modelReadiness.totalMatches}</div>
                    <Badge className={STATUS_LABELS[data.modelReadiness.status].className}>
                      {STATUS_LABELS[data.modelReadiness.status].label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    active config：{data.modelReadiness.activeConfigName || "未启用"}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
      </div>

      {data ? (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>分群筛选</CardTitle>
                <CardDescription>
                  过滤 cohort 视图，查看城市 / 活动类型 / archetype 的数据充足度。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger data-testid="filter-city">
                    <SelectValue placeholder="全部城市" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部城市</SelectItem>
                    {data.coverage.cities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                  <SelectTrigger data-testid="filter-event-type">
                    <SelectValue placeholder="全部活动类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部活动类型</SelectItem>
                    {data.coverage.eventTypes.map((eventType) => (
                      <SelectItem key={eventType} value={eventType}>
                        {eventType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={archetypeFilter} onValueChange={setArchetypeFilter}>
                  <SelectTrigger data-testid="filter-archetype">
                    <SelectValue placeholder="全部 archetype" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部 archetype</SelectItem>
                    {data.coverage.archetypes.map((archetype) => (
                      <SelectItem key={archetype} value={archetype}>
                        {archetype}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  当前筛选
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">cohort 数</span>
                  <span className="font-medium">{filteredCohorts.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">样本量</span>
                  <span className="font-medium">
                    {filteredCohorts.reduce((sum, cohort) => sum + cohort.submissionCount, 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">预警 cohort</span>
                  <span className="font-medium">
                    {filteredCohorts.filter((cohort) => cohort.warningLevel !== "healthy").length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>按城市报名量</CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={segmentedCharts.city}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={88}
                      label={(entry) => entry.name}
                    >
                      {segmentedCharts.city.map((entry, index) => (
                        <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>按活动类型报名量</CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={segmentedCharts.eventType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top archetype 样本</CardTitle>
              </CardHeader>
              <CardContent className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={segmentedCharts.archetype} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={90} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--chart-2, 199 89% 48%))" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>标签充分度</CardTitle>
                <CardDescription>基于当前筛选 cohort 的标签覆盖估算。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {filteredReadiness.map((metric) => (
                  <div key={metric.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{metric.label}</span>
                      <span className="font-medium">
                        {metric.count} · {percent(metric.coverageRate)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(metric.coverageRate * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">事件 outcome 摘要覆盖</span>
                    <span className="font-medium">{data.modelReadiness.outcomeSummaryCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>模型 / 标签 readiness</CardTitle>
                <CardDescription>用于判断 AI matching 训练样本是否进入稳定迭代区间。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.readinessMetrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{metric.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {metric.count} / {metric.target} · {percent(metric.coverageRate)}
                      </p>
                    </div>
                    <Badge className={STATUS_LABELS[metric.status].className}>
                      {STATUS_LABELS[metric.status].label}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Under-instrumented cohorts</CardTitle>
              <CardDescription>优先补采反馈或补齐前置字段的 cohort。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredCohorts
                .filter((cohort) => cohort.warningLevel !== "healthy")
                .slice(0, 8)
                .map((cohort) => (
                  <div
                    key={cohort.key}
                    className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {cohort.city} · {cohort.eventType} · {cohort.archetype}
                        </p>
                        <Badge className={WARNING_LABELS[cohort.warningLevel].className}>
                          {WARNING_LABELS[cohort.warningLevel].label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {cohort.warningReasons.join(" / ") || "需要补充样本"}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground">报名量</p>
                      <p className="font-medium">{cohort.submissionCount}</p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground">完整度 / 标签覆盖</p>
                      <p className="font-medium">
                        {percent(cohort.completionRate)} / {percent(cohort.feedbackCoverageRate)}
                      </p>
                    </div>
                    <div className="text-sm">
                      <p className="text-muted-foreground">深度反馈</p>
                      <p className="font-medium">{percent(cohort.deepFeedbackCoverageRate)}</p>
                    </div>
                  </div>
                ))}

              {!filteredCohorts.filter((cohort) => cohort.warningLevel !== "healthy").length && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  当前筛选下暂无预警 cohort。
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
