import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  getCurrentWeights,
  getRecommendationConfidence,
  getRecommendedWeights,
  getRecommendationReadiness,
  getSuccessfulMatchRate,
  getWeightHistorySeries,
  STATIC_MATCHING_WEIGHTS,
  WEIGHT_DIMENSIONS,
} from "@/lib/adminEvolutionWeights";

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
  config: {
    totalMatches?: number;
    successfulMatches?: number;
    updatedAt?: string | null;
    personalityAlpha?: number;
    personalityBeta?: number;
    interestsAlpha?: number;
    interestsBeta?: number;
    intentAlpha?: number;
    intentBeta?: number;
    backgroundAlpha?: number;
    backgroundBeta?: number;
    cultureAlpha?: number;
    cultureBeta?: number;
    conversationSignatureAlpha?: number;
    conversationSignatureBeta?: number;
  } | null;
}

interface WeightHistoryEntry {
  recordedAt: string;
  changeReason: string | null;
  matchesSinceLastUpdate: number | null;
  personalityWeight: number | string | null;
  interestsWeight: number | string | null;
  intentWeight: number | string | null;
  backgroundWeight: number | string | null;
  cultureWeight: number | string | null;
  conversationSignatureWeight: number | string | null;
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

export default function AdminEvolutionPage() {
  const { toast } = useToast();
  const [newDialogueContent, setNewDialogueContent] = useState("");
  const [newDialogueCategory, setNewDialogueCategory] = useState("");

  const { data: overview, isLoading: overviewLoading } = useQuery<EvolutionOverview>({
    queryKey: ["/api/admin/evolution/overview"],
  });

  const { data: weightsData, isLoading: weightsLoading } = useQuery<WeightsData>({
    queryKey: ["/api/admin/evolution/weights"],
  });

  const { data: weightsHistoryData, isLoading: weightsHistoryLoading } = useQuery<WeightHistoryEntry[]>({
    queryKey: ["/api/admin/evolution/weights-history?limit=12"],
  });

  const { data: triggersData, isLoading: triggersLoading } = useQuery<{ all: TriggerStats[]; topPerforming: TriggerStats[]; underperforming: TriggerStats[] }>({
    queryKey: ["/api/admin/evolution/triggers"],
  });

  const { data: dialoguesData, isLoading: dialoguesLoading } = useQuery<{ dialogues: GoldenDialogue[]; stats: any }>({
    queryKey: ["/api/admin/evolution/golden-dialogues"],
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
    queryClient.invalidateQueries({ queryKey: ["/api/admin/evolution/triggers"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/evolution/golden-dialogues"] });
    toast({ title: "数据已刷新" });
  };

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

  const weightInsights = useMemo(() => {
    const currentWeights = getCurrentWeights(weightsData?.weights);
    const recommendedWeights = getRecommendedWeights(weightsData?.config);
    const readiness = getRecommendationReadiness(weightsData?.config);
    const confidence = getRecommendationConfidence(weightsData?.config);
    const successRate = getSuccessfulMatchRate(weightsData?.config);
    const historySeries = getWeightHistorySeries(weightsHistoryData);

    return {
      currentWeights,
      recommendedWeights,
      readiness,
      confidence,
      successRate,
      historySeries,
      totalMatches: weightsData?.config?.totalMatches || 0,
      successfulMatches: weightsData?.config?.successfulMatches || 0,
      updatedAt: weightsData?.config?.updatedAt || null,
    };
  }, [weightsData, weightsHistoryData]);

  const readinessBadgeClassName =
    weightInsights.readiness.tone === "positive"
      ? "bg-green-100 text-green-700"
      : weightInsights.readiness.tone === "warning"
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  const historyAvailable = weightInsights.historySeries.length >= 2;

  return (
    <div className="p-6 space-y-6" data-testid="admin-evolution-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            小悦进化系统
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
          <TabsTrigger value="triggers" data-testid="tab-triggers">触发器效果</TabsTrigger>
          <TabsTrigger value="dialogues" data-testid="tab-dialogues">黄金话术</TabsTrigger>
        </TabsList>

        <TabsContent value="weights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                自适应权重建议面板
              </CardTitle>
              <CardDescription>
                对比默认静态权重、当前线上权重与学习建议，并查看权重变化趋势
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weightsLoading || weightsHistoryLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="animate-pulse h-8 bg-muted rounded" />
                  ))}
                </div>
              ) : weightsData?.weights ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    <Card className="border-dashed">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">默认静态权重</CardTitle>
                        <CardDescription>当前产品基线</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">100%</div>
                        <p className="text-xs text-muted-foreground">6 个固定维度，便于与学习建议对照</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">反馈样本量</CardTitle>
                        <CardDescription>用于学习建议的历史反馈</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{weightInsights.totalMatches}</div>
                        <p className="text-xs text-muted-foreground">
                          成功匹配 {weightInsights.successfulMatches} · 成功率 {weightInsights.successRate.toFixed(0)}%
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">建议置信度</CardTitle>
                        <CardDescription>依据 Thompson Sampling 后验强度</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-2xl font-bold">{weightInsights.confidence}%</div>
                        <Progress value={weightInsights.confidence} className="h-2" />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">采纳就绪度</CardTitle>
                        <CardDescription>
                          {weightInsights.updatedAt
                            ? `最近更新 ${new Intl.DateTimeFormat("zh-CN", {
                                month: "numeric",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }).format(new Date(weightInsights.updatedAt))}`
                            : "暂无更新时间"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Badge variant="secondary" className={readinessBadgeClassName}>
                          {weightInsights.readiness.label}
                        </Badge>
                        <p className="text-xs text-muted-foreground">{weightInsights.readiness.description}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {weightInsights.readiness.tone !== "positive" && (
                    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>数据仍在积累中</AlertTitle>
                      <AlertDescription>
                        {weightInsights.readiness.description}
                        {!historyAvailable && " 当前历史点位较少，趋势图将展示不足数据状态。"}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="rounded-lg border">
                    <div className="grid grid-cols-[minmax(120px,1.5fr)_repeat(3,minmax(90px,1fr))_minmax(88px,.8fr)] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground">
                      <span>维度</span>
                      <span>静态基线</span>
                      <span>当前线上</span>
                      <span>学习建议</span>
                      <span>变化</span>
                    </div>
                    <div className="divide-y">
                      {WEIGHT_DIMENSIONS.map((dimension) => {
                        const baseline = STATIC_MATCHING_WEIGHTS[dimension.key];
                        const current = weightInsights.currentWeights[dimension.key];
                        const recommended = weightInsights.recommendedWeights[dimension.key];
                        const change = Number((recommended - current).toFixed(1));
                        return (
                          <div
                            key={dimension.key}
                            className="grid grid-cols-[minmax(120px,1.5fr)_repeat(3,minmax(90px,1fr))_minmax(88px,.8fr)] gap-3 px-4 py-4 text-sm items-center"
                            data-testid={`weight-${dimension.key}`}
                          >
                            <div className="space-y-2">
                              <span className="font-medium">{dimension.label}</span>
                              <div className="h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(recommended, 100)}%`, backgroundColor: dimension.color }}
                                />
                              </div>
                            </div>
                            <span>{baseline.toFixed(1)}%</span>
                            <span>{current.toFixed(1)}%</span>
                            <span className="font-medium">{recommended.toFixed(1)}%</span>
                            <span className={change === 0 ? "text-muted-foreground" : change > 0 ? "text-green-600" : "text-amber-600"}>
                              {change > 0 ? "+" : ""}
                              {change.toFixed(1)}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>权重变化趋势</CardTitle>
                      <CardDescription>展示每次学习更新后的线上权重，便于回看变化方向</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {historyAvailable ? (
                        <div className="h-[320px]" data-testid="weights-history-chart">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={weightInsights.historySeries}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="label" />
                              <YAxis unit="%" />
                              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                              <Legend />
                              {WEIGHT_DIMENSIONS.map((dimension) => (
                                <Line
                                  key={dimension.key}
                                  type="monotone"
                                  dataKey={dimension.key}
                                  name={dimension.label}
                                  stroke={dimension.color}
                                  strokeWidth={2}
                                  dot={{ r: 3 }}
                                  activeDot={{ r: 5 }}
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground" data-testid="weights-history-empty">
                          历史更新点不足，暂时无法形成有效趋势图。建议累计至少 2 次权重更新后再观察时间序列变化。
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <p className="text-muted-foreground">暂无权重数据</p>
              )}
            </CardContent>
          </Card>
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
                手动标记优秀的对话模式，帮助小悦学习
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
