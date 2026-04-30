import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Zap, MessageSquare, TrendingUp, Target, Sparkles, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EvolutionOverview {
  weights: {
    totalMatches: number;
    successfulMatches: number;
    avgSatisfaction: number;
    lastUpdated: string | null;
  };
  triggers: {
    total: number;
    avgEffectiveness: number;
    totalActivations: number;
  };
  dialogues: {
    totalDialogues: number;
    activeDialogues: number;
    manuallyTagged: number;
    avgSuccessRate: number;
    byCategory: Record<string, number>;
  };
  systemHealth: string;
  lastAnalyzed: string;
}

interface TriggerStats {
  triggerId: string;
  triggerName: string;
  currentThreshold: number;
  effectivenessScore: number;
  totalTriggers: number;
  successRate: number;
}

interface WeightsData {
  weights: {
    personalityWeight: number;
    interestsWeight: number;
    intentWeight: number;
    backgroundWeight: number;
    cultureWeight: number;
    conversationSignatureWeight: number;
  };
  config: any;
}

interface ShadowRecommendationDimensionMetric {
  score: number;
  sampleCount: number;
  confidence: number;
  liveWeight: number;
  recommendedWeight: number;
  delta: number;
}

interface ShadowRecommendation {
  id: string;
  recordedAt: string;
  shadowMetadata?: {
    outcomeScore?: number;
    signalCoverage?: number;
    sampleSize?: number;
    overallConfidence?: number;
    outcomeSignals?: {
      wouldMeetAgain?: boolean | null;
      mutualConnectionCount?: number | null;
      eventId?: string;
    };
    dimensionMetrics?: Record<string, ShadowRecommendationDimensionMetric>;
  } | null;
}

interface ShadowRecommendationData {
  latest: ShadowRecommendation | null;
  recommendations: ShadowRecommendation[];
}

interface GoldenDialogue {
  id: string;
  category: string;
  dialogueContent: string;
  refinedVersion: string | null;
  successRate: string;
  usageCount: number;
  isActive: boolean;
  isManuallyTagged: boolean;
  createdAt: string;
}

interface EventPoolOption {
  id: string;
  title: string;
  status: string;
  totalRegistrations: number;
  predictiveRerankEnabledOverride?: boolean | null;
}

interface ShadowExperimentResult {
  groupKey: string;
  memberUserIds: string[];
  memberCount: number;
  deterministicScore: number;
  deterministicRank: number;
  predictedScore: number;
  predictedRank: number;
  scoreDelta: number;
  rankDelta: number;
  confidence: number | string;
  predictedOutcomeRate: number | string;
  avgChemistryScore: number;
  diversityScore: number;
  communicationBalance: number;
  temperatureLevel: string;
}

interface ShadowExperiment {
  id: string;
  poolId: string;
  poolTitle: string | null;
  mode: string;
  modelVersion: string;
  deterministicGroupCount: number;
  deterministicAverageScore: number | null;
  outcomeSampleCount: number;
  outcomePositiveRate: number | string;
  averageConfidence: number | string;
  rankAgreementRate: number | string;
  averageScoreDelta: number | null;
  summary: {
    outcomeValidation: {
      sampleCount: number;
      positiveRate: number | string;
      avgAtmosphereScore: number | string | null;
    };
    averageConfidence: number | string;
    averageScoreDelta: number;
    rankAgreementRate: number | string;
    topRankChanged: boolean;
    liveRankingProtected: boolean;
  };
  createdAt: string;
}

interface ShadowExperimentDetail extends ShadowExperiment {
  results: ShadowExperimentResult[];
}

interface PredictiveRerankStatus {
  shadowPoolCount: number;
  outcomeMetrics: Array<{
    arm: "control" | "treatment";
    sampleCount: number;
    positiveRate: number | string;
    avgAtmosphereScore: number | string | null;
  }>;
  config: {
    predictiveRerankEnabled: boolean;
    predictiveRerankExposurePercent: number;
    predictiveRerankMaxPositionShift: number;
    predictiveRerankConfidenceThreshold: number;
    predictiveRerankAutoDisableEnabled: boolean;
    predictiveRerankMinShadowExperiments: number;
    predictiveRerankAutoDisabledAt: string | null;
    predictiveRerankAutoDisabledReason: string | null;
  } | null;
}

function toPercent(value: number | string | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(parsed)) {
    return "—";
  }

  return `${(parsed * 100).toFixed(1)}%`;
}

function toFixedNumber(value: number | string | null | undefined, digits = 1): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(parsed)) {
    return "—";
  }

  return parsed.toFixed(digits);
}
const weightDefinitions = [
  { key: "personalityWeight", label: "人格匹配", color: "bg-purple-500", metricKey: "personality" },
  { key: "interestsWeight", label: "兴趣匹配", color: "bg-blue-500", metricKey: "interests" },
  { key: "intentWeight", label: "意图匹配", color: "bg-green-500", metricKey: "intent" },
  { key: "backgroundWeight", label: "背景多样性", color: "bg-orange-500", metricKey: "background" },
  { key: "cultureWeight", label: "文化语言", color: "bg-pink-500", metricKey: "culture" },
  { key: "conversationSignatureWeight", label: "对话签名", color: "bg-cyan-500", metricKey: "conversationSignature" },
] as const;

export default function AdminEvolutionPage() {
  const { toast } = useToast();
  const [newDialogueContent, setNewDialogueContent] = useState("");
  const [newDialogueCategory, setNewDialogueCategory] = useState("");
  const [selectedShadowPoolId, setSelectedShadowPoolId] = useState("");

  const { data: overview, isLoading: overviewLoading } = useQuery<EvolutionOverview>({
    queryKey: ["/api/admin/evolution/overview"],
  });

  const { data: weightsData, isLoading: weightsLoading } = useQuery<WeightsData>({
    queryKey: ["/api/admin/evolution/weights"],
  });

  const { data: shadowRecommendationData, isLoading: shadowRecommendationsLoading } = useQuery<ShadowRecommendationData>({
    queryKey: ["/api/admin/evolution/weight-recommendations"],
  });

  const { data: predictiveRerankStatus, isLoading: predictiveRerankStatusLoading } = useQuery<PredictiveRerankStatus>({
    queryKey: ["/api/admin/predictive-rerank-status"],
  });

  const { data: triggersData, isLoading: triggersLoading } = useQuery<{ all: TriggerStats[]; topPerforming: TriggerStats[]; underperforming: TriggerStats[] }>({
    queryKey: ["/api/admin/evolution/triggers"],
  });

  const { data: dialoguesData, isLoading: dialoguesLoading } = useQuery<{ dialogues: GoldenDialogue[]; stats: any }>({
    queryKey: ["/api/admin/evolution/golden-dialogues"],
  });

  const { data: eventPools } = useQuery<EventPoolOption[]>({
    queryKey: ["/api/admin/event-pools"],
  });

  const { data: shadowExperiments, isLoading: shadowLoading } = useQuery<ShadowExperiment[]>({
    queryKey: [
      "/api/admin/matching-shadow-experiments",
      { poolId: selectedShadowPoolId || null, limit: 10 },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "10" });
      if (selectedShadowPoolId) {
        params.set("poolId", selectedShadowPoolId);
      }
      const response = await fetch(`/api/admin/matching-shadow-experiments?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to load shadow experiments");
      }
      return response.json();
    },
  });

  const latestShadowExperimentId = shadowExperiments?.[0]?.id;

  const { data: latestShadowExperiment, isLoading: latestShadowExperimentLoading } = useQuery<ShadowExperimentDetail>({
    queryKey: ["/api/admin/matching-shadow-experiments", latestShadowExperimentId, "detail"],
    enabled: Boolean(latestShadowExperimentId),
    queryFn: async () => {
      const response = await fetch(`/api/admin/matching-shadow-experiments/${latestShadowExperimentId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to load matching shadow experiment");
      }
      return response.json();
    },
  });

  const runShadowExperimentMutation = useMutation({
    mutationFn: async (poolId: string) => {
      const response = await apiRequest("POST", "/api/admin/matching-shadow-experiments", { poolId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matching-shadow-experiments"] });
      toast({ title: "影子批处理完成", description: "已生成预测兼容性对比结果" });
    },
    onError: () => {
      toast({ title: "影子批处理失败", description: "请稍后重试", variant: "destructive" });
    },
  });

  const poolOverrideMutation = useMutation({
    mutationFn: async (override: boolean | null) => {
      if (!selectedShadowPoolId) {
        throw new Error("请先选择活动池");
      }

      const response = await apiRequest("PATCH", `/api/admin/event-pools/${selectedShadowPoolId}`, {
        predictiveRerankEnabledOverride: override,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-pools"] });
      toast({ title: "活动池实验开关已更新" });
    },
    onError: (error: Error) => {
      toast({ title: "更新失败", description: error.message, variant: "destructive" });
    },
  });

  const handleAddGoldenDialogue = async () => {
    if (!newDialogueContent.trim() || !newDialogueCategory) {
      toast({ title: "请填写话术内容和分类", variant: "destructive" });
      return;
    }

    try {
      await apiRequest("POST", "/api/admin/evolution/golden-dialogues", {
        dialogueContent: newDialogueContent,
        category: newDialogueCategory,
      });
      toast({ title: "黄金话术添加成功" });
      setNewDialogueContent("");
      setNewDialogueCategory("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/evolution/golden-dialogues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/evolution/overview"] });
    } catch (error) {
      toast({ title: "添加失败", variant: "destructive" });
    }
  };

  const handleRefreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/evolution/overview"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/evolution/weights"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/evolution/weight-recommendations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/evolution/triggers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/evolution/golden-dialogues"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/matching-shadow-experiments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/predictive-rerank-status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/event-pools"] });
    toast({ title: "数据已刷新" });
  };

  const handleRunShadowExperiment = () => {
    if (!selectedShadowPoolId) {
      toast({ title: "请选择活动池", description: "影子批处理需要指定一个活动池", variant: "destructive" });
      return;
    }

    runShadowExperimentMutation.mutate(selectedShadowPoolId);
  };
  const latestShadowRecommendation = shadowRecommendationData?.latest;
  const latestShadowMetrics = latestShadowRecommendation?.shadowMetadata?.dimensionMetrics;
  const selectedPool = eventPools?.find((pool) => pool.id === selectedShadowPoolId);
  const controlMetrics = predictiveRerankStatus?.outcomeMetrics.find((metric) => metric.arm === "control");
  const treatmentMetrics = predictiveRerankStatus?.outcomeMetrics.find((metric) => metric.arm === "treatment");

  const categories = [
    { value: "greeting", label: "开场白" },
    { value: "gender_ask", label: "性别询问" },
    { value: "age_ask", label: "年龄询问" },
    { value: "interest_probe", label: "兴趣探索" },
    { value: "intent_probe", label: "意图探索" },
    { value: "closing", label: "结束语" },
    { value: "encouragement", label: "鼓励话术" },
    { value: "humor", label: "幽默话术" },
  ];

  return (
    <div className="p-6 space-y-6" data-testid="admin-evolution-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            悦仔进化系统
          </h1>
          <p className="text-muted-foreground">
            AI驱动的对话优化与匹配权重自动调整
          </p>
        </div>
        <Button onClick={handleRefreshData} variant="outline" size="sm" data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新数据
        </Button>
      </div>

      {overviewLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-matches">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
              <CardTitle className="text-sm font-medium">总匹配数</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview?.weights.totalMatches || 0}</div>
              <p className="text-xs text-muted-foreground">
                成功: {overview?.weights.successfulMatches || 0}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-satisfaction">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
              <CardTitle className="text-sm font-medium">平均满意度</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(overview?.weights.avgSatisfaction || 0).toFixed(2)}
              </div>
              <Progress value={(overview?.weights.avgSatisfaction || 0) * 20} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card data-testid="card-trigger-activations">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
              <CardTitle className="text-sm font-medium">触发器激活</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview?.triggers.totalActivations || 0}</div>
              <p className="text-xs text-muted-foreground">
                平均效果: {((overview?.triggers.avgEffectiveness || 0) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-golden-dialogues">
            <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2">
              <CardTitle className="text-sm font-medium">黄金话术</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview?.dialogues.activeDialogues || 0}</div>
              <p className="text-xs text-muted-foreground">
                人工标记: {overview?.dialogues.manuallyTagged || 0}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="weights" className="space-y-4">
        <TabsList>
          <TabsTrigger value="weights" data-testid="tab-weights">权重优化</TabsTrigger>
          <TabsTrigger value="shadow" data-testid="tab-shadow">影子实验</TabsTrigger>
          <TabsTrigger value="triggers" data-testid="tab-triggers">触发器效果</TabsTrigger>
          <TabsTrigger value="dialogues" data-testid="tab-dialogues">黄金话术</TabsTrigger>
        </TabsList>

        <TabsContent value="weights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                匹配维度权重 (Thompson Sampling优化)
              </CardTitle>
              <CardDescription>
                系统会根据用户反馈自动调整各维度权重
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weightsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="animate-pulse h-8 bg-muted rounded" />
                  ))}
                </div>
              ) : weightsData?.weights ? (
                <div className="space-y-4">
                  {weightDefinitions.map(({ key, label, color }) => {
                    const rawValue = weightsData.weights[key as keyof typeof weightsData.weights] || 0;
                    const value = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;
                    const percentage = value < 1 ? value * 100 : value;
                    return (
                      <div key={key} className="space-y-2" data-testid={`weight-${key}`}>
                        <div className="flex justify-between text-sm">
                          <span>{label}</span>
                          <span className="font-medium">{percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full ${color} transition-all duration-500`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-lg border border-dashed p-4 space-y-4" data-testid="shadow-weight-recommendations">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          影子模式推荐
                        </p>
                        <p className="text-sm text-muted-foreground">
                          基于真实反馈生成建议，仅供管理员观察与比较，不会影响线上匹配排序。
                        </p>
                      </div>
                      {latestShadowRecommendation?.shadowMetadata?.overallConfidence != null && (
                        <Badge variant="secondary">
                          置信度 {(latestShadowRecommendation.shadowMetadata.overallConfidence * 100).toFixed(0)}%
                        </Badge>
                      )}
                    </div>

                    {shadowRecommendationsLoading ? (
                      <div className="space-y-2">
                        {[1, 2].map((i) => (
                          <div key={i} className="animate-pulse h-10 bg-muted rounded" />
                        ))}
                      </div>
                    ) : latestShadowRecommendation?.shadowMetadata ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div className="rounded-md bg-muted/50 p-3">
                            <p className="text-muted-foreground">推荐样本</p>
                            <p className="font-semibold">{latestShadowRecommendation.shadowMetadata.sampleSize ?? 0}</p>
                          </div>
                          <div className="rounded-md bg-muted/50 p-3">
                            <p className="text-muted-foreground">信号覆盖</p>
                            <p className="font-semibold">
                              {(((latestShadowRecommendation.shadowMetadata.signalCoverage ?? 0) as number) * 100).toFixed(0)}%
                            </p>
                          </div>
                          <div className="rounded-md bg-muted/50 p-3">
                            <p className="text-muted-foreground">结果评分</p>
                            <p className="font-semibold">{latestShadowRecommendation.shadowMetadata.outcomeScore?.toFixed(2) ?? "—"}</p>
                          </div>
                          <div className="rounded-md bg-muted/50 p-3">
                            <p className="text-muted-foreground">再见意愿</p>
                            <p className="font-semibold">
                              {latestShadowRecommendation.shadowMetadata.outcomeSignals?.wouldMeetAgain == null
                                ? "未知"
                                : latestShadowRecommendation.shadowMetadata.outcomeSignals?.wouldMeetAgain
                                  ? "是"
                                  : "否"}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {weightDefinitions.map(({ key, label, metricKey }) => {
                            const liveRawValue = weightsData.weights[key as keyof typeof weightsData.weights] || 0;
                            const liveValue = typeof liveRawValue === 'string' ? parseFloat(liveRawValue) : liveRawValue;
                            const livePercentage = liveValue < 1 ? liveValue * 100 : liveValue;
                            const metric = latestShadowMetrics?.[metricKey];
                            const recommendedPercentage = metric ? metric.recommendedWeight * 100 : livePercentage;

                            return (
                              <div key={`${key}-shadow`} className="rounded-md border p-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                  <span className="font-medium">{label}</span>
                                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <span>线上 {livePercentage.toFixed(1)}%</span>
                                    <span>建议 {recommendedPercentage.toFixed(1)}%</span>
                                    <span>
                                      Δ {metric ? `${metric.delta >= 0 ? "+" : ""}${(metric.delta * 100).toFixed(1)}%` : "0.0%"}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                  <span>维度评分 {metric?.score?.toFixed(0) ?? "—"}</span>
                                  <span>样本 {metric?.sampleCount ?? 0}</span>
                                  <span>置信度 {metric ? `${(metric.confidence * 100).toFixed(0)}%` : "—"}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium">最近推荐记录</p>
                          <div className="space-y-2">
                            {shadowRecommendationData?.recommendations?.slice(0, 5).map((recommendation) => (
                              <div
                                key={recommendation.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm"
                              >
                                <div className="space-x-3">
                                  <span>{new Date(recommendation.recordedAt).toLocaleString()}</span>
                                  <span className="text-muted-foreground">
                                    结果 {recommendation.shadowMetadata?.outcomeScore?.toFixed(2) ?? "—"}
                                  </span>
                                </div>
                                <div className="space-x-3 text-muted-foreground">
                                  <span>样本 {recommendation.shadowMetadata?.sampleSize ?? 0}</span>
                                  <span>
                                    置信度 {recommendation.shadowMetadata?.overallConfidence != null
                                      ? `${(recommendation.shadowMetadata.overallConfidence * 100).toFixed(0)}%`
                                      : "—"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无影子模式推荐数据</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">暂无权重数据</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shadow" className="space-y-4">
          <Card data-testid="predictive-rerank-live-status">
            <CardHeader>
              <CardTitle>线上受限重排状态</CardTitle>
              <CardDescription>
                观察 Phase D A/B 实验的门槛、自动停用状态，以及 control / treatment 的近两周结果差异。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {predictiveRerankStatusLoading ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">影子门槛</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{predictiveRerankStatus?.shadowPoolCount ?? 0}</div>
                        <p className="text-xs text-muted-foreground">
                          需要 ≥ {predictiveRerankStatus?.config?.predictiveRerankMinShadowExperiments ?? 0} 个活动池
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">实验开关</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {predictiveRerankStatus?.config?.predictiveRerankEnabled ? "ON" : "OFF"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Treatment {predictiveRerankStatus?.config?.predictiveRerankExposurePercent ?? 0}% ·
                          最大位移 ±{predictiveRerankStatus?.config?.predictiveRerankMaxPositionShift ?? 0}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Control 近两周</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{toPercent(controlMetrics?.positiveRate)}</div>
                        <p className="text-xs text-muted-foreground">
                          样本 {controlMetrics?.sampleCount ?? 0} · 气氛 {toFixedNumber(controlMetrics?.avgAtmosphereScore)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Treatment 近两周</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{toPercent(treatmentMetrics?.positiveRate)}</div>
                        <p className="text-xs text-muted-foreground">
                          样本 {treatmentMetrics?.sampleCount ?? 0} · 气氛 {toFixedNumber(treatmentMetrics?.avgAtmosphereScore)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {predictiveRerankStatus?.config?.predictiveRerankAutoDisabledAt && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                      <p className="font-medium text-destructive">实验已被自动停用</p>
                      <p className="text-muted-foreground">
                        {predictiveRerankStatus.config.predictiveRerankAutoDisabledReason || "未记录停用原因"}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card data-testid="shadow-experiment-controls">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                预测兼容性影子批处理
              </CardTitle>
              <CardDescription>
                仅在管理后台运行预测模型，对照确定性分组排名；不会写入实时匹配结果。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row">
                <Select value={selectedShadowPoolId} onValueChange={setSelectedShadowPoolId}>
                  <SelectTrigger className="md:w-[320px]" data-testid="select-shadow-pool">
                    <SelectValue placeholder="选择活动池" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventPools?.map((pool) => (
                      <SelectItem key={pool.id} value={pool.id}>
                        {pool.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleRunShadowExperiment}
                  disabled={runShadowExperimentMutation.isPending}
                  data-testid="button-run-shadow"
                >
                  {runShadowExperimentMutation.isPending ? "运行中..." : "运行影子批处理"}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={selectedPool?.predictiveRerankEnabledOverride === false ? "destructive" : "secondary"}>
                  {selectedPool?.predictiveRerankEnabledOverride === false
                    ? "该池已禁用线上重排"
                    : selectedPool?.predictiveRerankEnabledOverride === true
                      ? "该池强制允许线上重排"
                      : "该池跟随全局开关"}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selectedShadowPoolId || poolOverrideMutation.isPending}
                  onClick={() => poolOverrideMutation.mutate(false)}
                  data-testid="button-disable-pool-rerank"
                >
                  禁用当前池线上重排
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selectedShadowPoolId || poolOverrideMutation.isPending}
                  onClick={() => poolOverrideMutation.mutate(null)}
                  data-testid="button-reset-pool-rerank"
                >
                  清除池级覆盖
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                批处理读取历史反馈样本做结果校准，只输出影子实验记录与置信度对比。
              </p>
            </CardContent>
          </Card>

          {shadowLoading || latestShadowExperimentLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-muted rounded w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : latestShadowExperiment ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card data-testid="shadow-outcome-sample">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">验证样本</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {latestShadowExperiment.summary.outcomeValidation.sampleCount}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      正向率 {toPercent(latestShadowExperiment.summary.outcomeValidation.positiveRate)}
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="shadow-confidence">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">平均置信度</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {toPercent(latestShadowExperiment.summary.averageConfidence)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      模型版本 {latestShadowExperiment.modelVersion}
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="shadow-rank-agreement">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">排名一致率</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {toPercent(latestShadowExperiment.summary.rankAgreementRate)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      实时风险 {latestShadowExperiment.summary.liveRankingProtected ? "已隔离" : "需检查"}
                    </p>
                  </CardContent>
                </Card>

                <Card data-testid="shadow-delta">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">平均分差</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {latestShadowExperiment.summary.averageScoreDelta > 0 ? "+" : ""}
                      {latestShadowExperiment.summary.averageScoreDelta}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      最新实验：{latestShadowExperiment.poolTitle || latestShadowExperiment.poolId}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card data-testid="shadow-latest-run">
                <CardHeader>
                  <CardTitle>最新影子实验对比</CardTitle>
                  <CardDescription>
                    确定性排名 vs 预测排名、置信度与分差，用于运营侧观察模型影响。
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {latestShadowExperiment.results.map((result) => (
                    <div
                      key={result.groupKey}
                      className="rounded-lg border p-4 space-y-2"
                      data-testid={`shadow-result-${result.groupKey}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{result.groupKey}</div>
                          <div className="text-xs text-muted-foreground">
                            {result.memberCount} 人 · 温度 {result.temperatureLevel}
                          </div>
                        </div>
                        <Badge variant={result.rankDelta === 0 ? "secondary" : "default"}>
                          Δ排名 {result.rankDelta > 0 ? "+" : ""}
                          {result.rankDelta}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                        <div>
                          <div className="text-muted-foreground">确定性</div>
                          <div className="font-medium">
                            #{result.deterministicRank} · {result.deterministicScore}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">预测</div>
                          <div className="font-medium">
                            #{result.predictedRank} · {result.predictedScore}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">置信度</div>
                          <div className="font-medium">{toPercent(result.confidence)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">预测成功率</div>
                          <div className="font-medium">{toPercent(result.predictedOutcomeRate)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">分差</div>
                          <div className="font-medium">
                            {result.scoreDelta > 0 ? "+" : ""}
                            {result.scoreDelta}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card data-testid="shadow-history">
                <CardHeader>
                  <CardTitle>最近批处理记录</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {shadowExperiments?.map((experiment) => (
                    <div
                      key={experiment.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">{experiment.poolTitle || experiment.poolId}</div>
                        <div className="text-muted-foreground">
                          样本 {experiment.outcomeSampleCount} · 一致率 {toPercent(experiment.rankAgreementRate)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{toPercent(experiment.averageConfidence)}</div>
                        <div className="text-muted-foreground">
                          气氛均值 {toFixedNumber(experiment.summary.outcomeValidation.avgAtmosphereScore)}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                还没有影子实验记录，选择活动池后可运行首个批处理。
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="triggers" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  表现最佳触发器
                </CardTitle>
              </CardHeader>
              <CardContent>
                {triggersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse h-12 bg-muted rounded" />
                    ))}
                  </div>
                ) : triggersData?.topPerforming?.length ? (
                  <div className="space-y-2">
                    {triggersData.topPerforming.slice(0, 5).map((trigger) => (
                      <div
                        key={trigger.triggerId}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        data-testid={`trigger-top-${trigger.triggerId}`}
                      >
                        <div>
                          <p className="font-medium text-sm">{trigger.triggerName}</p>
                          <p className="text-xs text-muted-foreground">
                            触发 {trigger.totalTriggers} 次
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {(trigger.successRate * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">暂无数据</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                  需要优化的触发器
                </CardTitle>
              </CardHeader>
              <CardContent>
                {triggersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse h-12 bg-muted rounded" />
                    ))}
                  </div>
                ) : triggersData?.underperforming?.length ? (
                  <div className="space-y-2">
                    {triggersData.underperforming.slice(0, 5).map((trigger) => (
                      <div
                        key={trigger.triggerId}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                        data-testid={`trigger-low-${trigger.triggerId}`}
                      >
                        <div>
                          <p className="font-medium text-sm">{trigger.triggerName}</p>
                          <p className="text-xs text-muted-foreground">
                            触发 {trigger.totalTriggers} 次
                          </p>
                        </div>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                          {(trigger.successRate * 100).toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">所有触发器表现良好</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dialogues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>添加黄金话术</CardTitle>
              <CardDescription>
                手动标记优秀的对话模式，帮助悦仔学习
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={newDialogueCategory} onValueChange={setNewDialogueCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="选择话术分类" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="输入优秀的话术内容..."
                value={newDialogueContent}
                onChange={(e) => setNewDialogueContent(e.target.value)}
                className="min-h-[100px]"
                data-testid="input-dialogue-content"
              />
              <Button onClick={handleAddGoldenDialogue} data-testid="button-add-dialogue">
                添加话术
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>话术库</CardTitle>
              <CardDescription>
                共 {dialoguesData?.stats?.activeDialogues || 0} 条活跃话术
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dialoguesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse h-20 bg-muted rounded" />
                  ))}
                </div>
              ) : dialoguesData?.dialogues?.length ? (
                <div className="space-y-3">
                  {dialoguesData.dialogues.slice(0, 10).map((dialogue) => (
                    <div
                      key={dialogue.id}
                      className="p-4 border rounded-lg space-y-2"
                      data-testid={`dialogue-${dialogue.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">{dialogue.category}</Badge>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            使用 {dialogue.usageCount} 次
                          </span>
                          <Badge variant="secondary">
                            {(parseFloat(dialogue.successRate) * 100).toFixed(0)}%
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm">{dialogue.dialogueContent}</p>
                      {dialogue.refinedVersion && (
                        <p className="text-sm text-primary border-l-2 border-primary pl-2">
                          精炼版: {dialogue.refinedVersion}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">暂无话术数据</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
