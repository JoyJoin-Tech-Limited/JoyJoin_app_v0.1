import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface MatchingThresholds {
  id?: string;
  highCompatibilityThreshold: number;
  mediumCompatibilityThreshold: number;
  lowCompatibilityThreshold: number;
  timeDecayEnabled: boolean;
  timeDecayRate: number;
  minThresholdAfterDecay: number;
  minGroupSizeForMatch: number;
  optimalGroupSize: number;
  scanIntervalMinutes: number;
  notes?: string;
}

export default function AdminMatchingConfigPage() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<MatchingThresholds>({
    highCompatibilityThreshold: 85,
    mediumCompatibilityThreshold: 70,
    lowCompatibilityThreshold: 55,
    timeDecayEnabled: true,
    timeDecayRate: 5,
    minThresholdAfterDecay: 50,
    minGroupSizeForMatch: 4,
    optimalGroupSize: 6,
    scanIntervalMinutes: 60,
    notes: "",
  });

  // Fetch current config
  const { data: config, isLoading } = useQuery<MatchingThresholds>({
    queryKey: ["/api/admin/matching-thresholds"],
  });

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (data: MatchingThresholds) => {
      return apiRequest("/api/admin/matching-thresholds", "PUT", data);
    },
    onSuccess: () => {
      toast({
        title: "配置已更新",
        description: "匹配阈值配置已成功保存",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matching-thresholds"] });
    },
    onError: (error: any) => {
      toast({
        title: "更新失败",
        description: error.message || "无法保存配置",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfigMutation.mutate(formData);
  };

  const handleReset = () => {
    if (config) {
      setFormData(config);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">实时匹配配置</h1>
        <p className="text-muted-foreground">
          调整匹配阈值和时间衰减参数，优化盲盒活动的匹配效果
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6">
          {/* Compatibility Thresholds */}
          <Card data-testid="card-compatibility-thresholds">
            <CardHeader>
              <CardTitle>兼容性阈值</CardTitle>
              <CardDescription>
                设置不同兼容性级别的分数门槛（0-100分）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="highThreshold">
                  高兼容性阈值（立即匹配）
                </Label>
                <Input
                  id="highThreshold"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.highCompatibilityThreshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      highCompatibilityThreshold: parseInt(e.target.value),
                    })
                  }
                  data-testid="input-high-threshold"
                />
                <p className="text-sm text-muted-foreground">
                  当组局平均分 ≥ 此值时，立即完成匹配（推荐：85分）
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="mediumThreshold">
                  中等兼容性阈值（基准线）
                </Label>
                <Input
                  id="mediumThreshold"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.mediumCompatibilityThreshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      mediumCompatibilityThreshold: parseInt(e.target.value),
                    })
                  }
                  data-testid="input-medium-threshold"
                />
                <p className="text-sm text-muted-foreground">
                  时间衰减的起始阈值（推荐：70分）
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="lowThreshold">
                  低兼容性阈值（参考线）
                </Label>
                <Input
                  id="lowThreshold"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.lowCompatibilityThreshold}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lowCompatibilityThreshold: parseInt(e.target.value),
                    })
                  }
                  data-testid="input-low-threshold"
                />
                <p className="text-sm text-muted-foreground">
                  最低可接受的匹配质量（推荐：55分）
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Time Decay Settings */}
          <Card data-testid="card-time-decay">
            <CardHeader>
              <CardTitle>时间衰减机制</CardTitle>
              <CardDescription>
                随着活动临近，逐步降低匹配标准以提高成局率
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="timeDecay">启用时间衰减</Label>
                  <p className="text-sm text-muted-foreground">
                    距离活动越近，阈值越低
                  </p>
                </div>
                <Switch
                  id="timeDecay"
                  checked={formData.timeDecayEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, timeDecayEnabled: checked })
                  }
                  data-testid="switch-time-decay"
                />
              </div>

              {formData.timeDecayEnabled && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="decayRate">
                      衰减速率（分/天）
                    </Label>
                    <Input
                      id="decayRate"
                      type="number"
                      min="0"
                      max="20"
                      value={formData.timeDecayRate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          timeDecayRate: parseInt(e.target.value),
                        })
                      }
                      data-testid="input-decay-rate"
                    />
                    <p className="text-sm text-muted-foreground">
                      每过24小时，阈值降低多少分（推荐：5分/天）
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="minThreshold">
                      衰减后最低阈值
                    </Label>
                    <Input
                      id="minThreshold"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.minThresholdAfterDecay}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          minThresholdAfterDecay: parseInt(e.target.value),
                        })
                      }
                      data-testid="input-min-threshold"
                    />
                    <p className="text-sm text-muted-foreground">
                      无论距离活动多近，阈值不会低于此值（推荐：50分）
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Group Size Settings */}
          <Card data-testid="card-group-size">
            <CardHeader>
              <CardTitle>组局配置</CardTitle>
              <CardDescription>
                设置小组成局的人数要求
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="minGroupSize">
                  最小成局人数
                </Label>
                <Input
                  id="minGroupSize"
                  type="number"
                  min="2"
                  max="10"
                  value={formData.minGroupSizeForMatch}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      minGroupSizeForMatch: parseInt(e.target.value),
                    })
                  }
                  data-testid="input-min-group-size"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="optimalGroupSize">
                  最优组局人数
                </Label>
                <Input
                  id="optimalGroupSize"
                  type="number"
                  min="2"
                  max="12"
                  value={formData.optimalGroupSize}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      optimalGroupSize: parseInt(e.target.value),
                    })
                  }
                  data-testid="input-optimal-group-size"
                />
              </div>
            </CardContent>
          </Card>

          {/* Scan Interval */}
          <Card data-testid="card-scan-interval">
            <CardHeader>
              <CardTitle>扫描频率</CardTitle>
              <CardDescription>
                定时任务扫描所有活动池的间隔（分钟）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <Label htmlFor="scanInterval">
                  扫描间隔（分钟）
                </Label>
                <Input
                  id="scanInterval"
                  type="number"
                  min="1"
                  max="1440"
                  value={formData.scanIntervalMinutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      scanIntervalMinutes: parseInt(e.target.value),
                    })
                  }
                  data-testid="input-scan-interval"
                />
                <p className="text-sm text-muted-foreground">
                  当前设置：每 {formData.scanIntervalMinutes} 分钟扫描一次
                  （注意：修改后需要重启服务器生效）
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card data-testid="card-notes">
            <CardHeader>
              <CardTitle>备注</CardTitle>
              <CardDescription>
                记录本次配置调整的原因或说明
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="例如：根据前100个用户的匹配数据，将高兼容阈值从80提升到85"
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                data-testid="textarea-notes"
              />
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={updateConfigMutation.isPending}
              data-testid="button-reset"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              重置
            </Button>
            <Button
              type="submit"
              disabled={updateConfigMutation.isPending}
              data-testid="button-save"
            >
              {updateConfigMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              保存配置
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
