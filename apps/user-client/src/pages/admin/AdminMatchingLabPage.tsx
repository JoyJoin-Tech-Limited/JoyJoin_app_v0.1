import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Sliders, TestTube2, Zap, Save, RotateCcw, Play, Users } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MatchingConfig {
  configName: string;
  personalityWeight: number;
  interestsWeight: number;
  intentWeight: number;
  backgroundWeight: number;
  cultureWeight: number;
  minGroupSize: number;
  maxGroupSize: number;
  preferredGroupSize: number;
  maxSameArchetypeRatio: number;
  minChemistryScore: number;
  isActive: boolean;
}

interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  archetype: string | null;
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface MatchGroup {
  groupId: string;
  userIds: string[];
  avgChemistryScore: number;
  diversityScore: number;
  overallScore: number;
  users: User[];
}

interface TestResult {
  testId: string;
  groups: MatchGroup[];
  metrics: {
    totalUsers: number;
    groupCount: number;
    avgChemistryScore: number;
    avgDiversityScore: number;
    overallMatchQuality: number;
    executionTimeMs: number;
  };
}

const DEFAULT_CONFIG: MatchingConfig = {
  configName: "default",
  personalityWeight: 40,
  interestsWeight: 25,
  intentWeight: 10,
  backgroundWeight: 15,
  cultureWeight: 10,
  minGroupSize: 5,
  maxGroupSize: 10,
  preferredGroupSize: 7,
  maxSameArchetypeRatio: 40,
  minChemistryScore: 60,
  isActive: true,
};

export default function AdminMatchingLabPage() {
  const [config, setConfig] = useState<MatchingConfig>(DEFAULT_CONFIG);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const { toast } = useToast();

  // 加载当前配置
  const { data: currentConfig, isLoading: configLoading } = useQuery<MatchingConfig>({
    queryKey: ["/api/matching/config"],
  });

  // 当配置加载完成时更新本地状态
  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig);
    }
  }, [currentConfig]);

  // 加载所有用户（用于测试场景）- 请求更多用户以确保有足够archetype用户
  const { data: usersResponse, isLoading: usersLoading } = useQuery<UsersResponse>({
    queryKey: ["/api/admin/users?limit=200"],
  });

  const allUsers = usersResponse?.users || [];

  // 保存配置
  const saveConfigMutation = useMutation({
    mutationFn: (newConfig: MatchingConfig) =>
      fetch("/api/matching/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newConfig),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to save config");
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matching/config"] });
      toast({
        title: "配置保存成功",
        description: "匹配算法权重已更新",
      });
    },
    onError: () => {
      toast({
        title: "保存失败",
        description: "无法保存配置，请重试",
        variant: "destructive",
      });
    },
  });

  // 运行测试场景
  const runTestMutation = useMutation({
    mutationFn: ({ userIds, config: testConfig }: { userIds: string[]; config: MatchingConfig }) =>
      fetch("/api/matching/test-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userIds, config: testConfig }),
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to run test");
        return r.json();
      }),
    onSuccess: (data: TestResult) => {
      setTestResult(data);
      toast({
        title: "测试完成",
        description: `成功创建 ${data.groups.length} 个小组`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "测试失败",
        description: error.message || "无法运行测试场景",
        variant: "destructive",
      });
    },
  });

  const totalWeight = config.personalityWeight + config.interestsWeight + 
                      config.intentWeight + config.backgroundWeight + config.cultureWeight;

  const handleWeightChange = (key: keyof MatchingConfig, value: number) => {
    setConfig({ ...config, [key]: value });
  };

  const handleSave = () => {
    if (totalWeight !== 100) {
      toast({
        title: "权重总和必须为100%",
        description: `当前总和: ${totalWeight}%`,
        variant: "destructive",
      });
      return;
    }
    saveConfigMutation.mutate(config);
  };

  const handleReset = () => {
    if (currentConfig) {
      setConfig(currentConfig);
    } else {
      setConfig(DEFAULT_CONFIG);
    }
  };

  const handleRunTest = () => {
    if (selectedUserIds.length < 5) {
      toast({
        title: "用户数量不足",
        description: "至少需要选择5个用户进行测试",
        variant: "destructive",
      });
      return;
    }
    runTestMutation.mutate({ userIds: selectedUserIds, config });
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const selectRandomUsers = (count: number) => {
    const usersWithArchetype = allUsers.filter(u => u.archetype);
    const shuffled = [...usersWithArchetype].sort(() => Math.random() - 0.5);
    setSelectedUserIds(shuffled.slice(0, count).map(u => u.id));
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">匹配实验室</h1>
        <p className="text-muted-foreground mt-1">调整AI匹配算法参数和测试场景</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 左侧：算法权重配置 */}
        <div className="space-y-6">
          <Card data-testid="card-algorithm-weights">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Sliders className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>算法权重配置</CardTitle>
                    <CardDescription>调整5个维度的权重 (总和必须为100%)</CardDescription>
                  </div>
                </div>
                <Badge variant={totalWeight === 100 ? "default" : "destructive"} data-testid="badge-total-weight">
                  {totalWeight}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 性格化学反应权重 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">性格化学反应</Label>
                  <span className="text-sm font-semibold text-primary" data-testid="text-personality-weight">
                    {config.personalityWeight}%
                  </span>
                </div>
                <Slider
                  value={[config.personalityWeight]}
                  onValueChange={([value]) => handleWeightChange("personalityWeight", value)}
                  min={0}
                  max={100}
                  step={5}
                  data-testid="slider-personality-weight"
                />
                <p className="text-xs text-muted-foreground">
                  基于14种社交原型的兼容性评分
                </p>
              </div>

              <Separator />

              {/* 兴趣重叠度权重 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">兴趣重叠度</Label>
                  <span className="text-sm font-semibold text-primary" data-testid="text-interests-weight">
                    {config.interestsWeight}%
                  </span>
                </div>
                <Slider
                  value={[config.interestsWeight]}
                  onValueChange={([value]) => handleWeightChange("interestsWeight", value)}
                  min={0}
                  max={100}
                  step={5}
                  data-testid="slider-interests-weight"
                />
                <p className="text-xs text-muted-foreground">
                  共同兴趣和话题的匹配度
                </p>
              </div>

              <Separator />

              {/* 背景多样性权重 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">背景多样性</Label>
                  <span className="text-sm font-semibold text-primary" data-testid="text-background-weight">
                    {config.backgroundWeight}%
                  </span>
                </div>
                <Slider
                  value={[config.backgroundWeight]}
                  onValueChange={([value]) => handleWeightChange("backgroundWeight", value)}
                  min={0}
                  max={100}
                  step={5}
                  data-testid="slider-background-weight"
                />
                <p className="text-xs text-muted-foreground">
                  年龄、行业、地域等背景的多样性
                </p>
              </div>

              <Separator />

              {/* 对话平衡权重 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">意图对齐</Label>
                  <span className="text-sm font-semibold text-primary" data-testid="text-intent-weight">
                    {config.intentWeight}%
                  </span>
                </div>
                <Slider
                  value={[config.intentWeight]}
                  onValueChange={([value]) => handleWeightChange("intentWeight", value)}
                  min={0}
                  max={100}
                  step={5}
                  data-testid="slider-intent-weight"
                />
                <p className="text-xs text-muted-foreground">
                  社交目的和意图的一致性
                </p>
              </div>

              <Separator />

              {/* 文化适应权重 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">文化适应</Label>
                  <span className="text-sm font-semibold text-primary" data-testid="text-culture-weight">
                    {config.cultureWeight}%
                  </span>
                </div>
                <Slider
                  value={[config.cultureWeight]}
                  onValueChange={([value]) => handleWeightChange("cultureWeight", value)}
                  min={0}
                  max={100}
                  step={5}
                  data-testid="slider-culture-weight"
                />
                <p className="text-xs text-muted-foreground">
                  语言偏好和文化背景的匹配度
                </p>
              </div>

              <Separator />

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSave}
                  disabled={totalWeight !== 100 || saveConfigMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-config"
                >
                  <Save className="mr-2 h-4 w-4" />
                  保存配置
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  data-testid="button-reset-config"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：测试场景 */}
        <div className="space-y-6">
          <Card data-testid="card-test-scenarios">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TestTube2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle>测试场景</CardTitle>
                  <CardDescription>选择用户运行匹配测试</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  已选择 <span className="font-semibold text-primary" data-testid="text-selected-count">{selectedUserIds.length}</span> 个用户
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectRandomUsers(10)}
                    data-testid="button-select-10-users"
                  >
                    随机10人
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectRandomUsers(20)}
                    data-testid="button-select-20-users"
                  >
                    随机20人
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-[300px] rounded-md border p-4">
                {usersLoading ? (
                  <div className="text-sm text-muted-foreground">加载用户列表...</div>
                ) : allUsers.filter(u => u.archetype).length === 0 ? (
                  <div className="text-sm text-muted-foreground">暂无可用用户</div>
                ) : (
                  <div className="space-y-2">
                    {allUsers.filter(u => u.archetype).map((user) => (
                      <div
                        key={user.id}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover-elevate ${
                          selectedUserIds.includes(user.id) ? "bg-primary/10" : ""
                        }`}
                        onClick={() => toggleUserSelection(user.id)}
                        data-testid={`user-item-${user.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">
                            {user.displayName || user.firstName || "未命名用户"}
                          </div>
                          {user.archetype && (
                            <Badge variant="outline" className="text-xs">
                              {user.archetype}
                            </Badge>
                          )}
                        </div>
                        {selectedUserIds.includes(user.id) && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <Button
                onClick={handleRunTest}
                disabled={selectedUserIds.length < 5 || runTestMutation.isPending}
                className="w-full"
                data-testid="button-run-test"
              >
                <Play className="mr-2 h-4 w-4" />
                运行测试 ({selectedUserIds.length} 人)
              </Button>
            </CardContent>
          </Card>

          {/* 测试结果 */}
          {testResult && (
            <Card data-testid="card-test-results">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>匹配结果</CardTitle>
                    <CardDescription>
                      {testResult.metrics.groupCount} 个小组 · 
                      执行时间 {testResult.metrics.executionTimeMs}ms
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 整体指标 */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <div className="text-2xl font-bold text-primary" data-testid="text-avg-chemistry">
                      {testResult.metrics.avgChemistryScore}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">化学反应</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <div className="text-2xl font-bold text-primary" data-testid="text-avg-diversity">
                      {testResult.metrics.avgDiversityScore}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">多样性</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <div className="text-2xl font-bold text-primary" data-testid="text-overall-quality">
                      {testResult.metrics.overallMatchQuality}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">整体质量</div>
                  </div>
                </div>

                <Separator />

                {/* 各组详情 */}
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3">
                    {testResult.groups.map((group, idx) => (
                      <div
                        key={group.groupId}
                        className="p-3 rounded-lg border"
                        data-testid={`group-result-${idx}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">小组 {idx + 1}</span>
                            <Badge variant="outline">{group.userIds.length}人</Badge>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">总分 </span>
                            <span className="font-semibold">{group.overallScore}</span>
                          </div>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <div>化学: {group.avgChemistryScore}</div>
                          <div>多样: {group.diversityScore}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
