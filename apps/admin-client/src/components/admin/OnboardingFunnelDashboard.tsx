import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AdminOnboardingFunnelResponse } from "@shared/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, Link2, Users, Flag } from "lucide-react";

const DAY_OPTIONS = [7, 30, 90] as const;

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Live V4 onboarding funnel (roadmap R1-4).
 *
 * Reads aggregate per-step enter/complete/abandon counts plus the
 * anonymous → login stitch rate from GET /api/admin/analytics/onboarding-funnel.
 * Replaces the legacy RegistrationFunnelDashboard (deprecated
 * registration_sessions telemetry).
 */
export default function OnboardingFunnelDashboard() {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, error } = useQuery<AdminOnboardingFunnelResponse>({
    queryKey: [`/api/admin/analytics/onboarding-funnel?days=${days}`],
  });

  if (error) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">加载失败</h3>
          <p className="text-muted-foreground">无法加载 Onboarding 漏斗数据，请稍后重试</p>
        </div>
      </div>
    );
  }

  const steps = data?.steps ?? [];
  const maxEntered = Math.max(1, ...steps.map((s) => s.entered));

  return (
    <div className="space-y-6">
      {/* Window selector + stitch KPIs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-funnel-window">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">统计窗口</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {DAY_OPTIONS.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={days === option ? "default" : "outline"}
                  onClick={() => setDays(option)}
                  data-testid={`button-days-${option}`}
                >
                  近{option}天
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              覆盖 {data?.stitch.anonymousSessions ?? 0} 个匿名会话
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stitch-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">匿名→登录 关联率</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-stitch-rate">
                  {formatPercent(data?.stitch.stitchRate ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {data?.stitch.stitchedSessions ?? 0} / {data?.stitch.anonymousSessions ?? 0} 匿名会话完成登录关联
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-funnel-total">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">漏斗总进入</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-entered">
                  {steps[0]?.entered ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">首个步骤的进入事件数</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-step funnel bars */}
      <Card data-testid="card-onboarding-steps">
        <CardHeader>
          <CardTitle>Onboarding 分步漏斗</CardTitle>
          <CardDescription>
            每个步骤的进入 → 完成 → 放弃事件数（{days} 天窗口）
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : steps.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无数据</div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, idx) => {
                const previous = idx > 0 ? steps[idx - 1] : null;
                const stepConversion =
                  previous && previous.entered > 0 ? step.entered / previous.entered : null;
                return (
                  <div key={step.step} className="space-y-1" data-testid={`funnel-step-${step.step}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {step.stepIndex !== null ? `#${step.stepIndex} ` : ""}
                        {step.step}
                      </span>
                      <span className="text-muted-foreground">
                        进入 {step.entered} · 完成 {step.completed} · 放弃 {step.abandoned}
                      </span>
                    </div>
                    <div className="h-7 bg-muted rounded overflow-hidden relative">
                      <div
                        className="h-full bg-primary/30 transition-all"
                        style={{ width: `${(step.entered / maxEntered) * 100}%` }}
                      />
                      <div
                        className="h-full bg-primary absolute inset-y-0 left-0 transition-all"
                        style={{ width: `${(step.completed / maxEntered) * 100}%` }}
                      />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                        完成率 {formatPercent(step.completionRate)}
                      </span>
                    </div>
                    {stepConversion !== null && (
                      <p className="text-xs text-muted-foreground" data-testid={`conversion-${step.step}`}>
                        较上一步转化 {formatPercent(stepConversion)}
                        {step.abandoned > 0 && ` · 放弃率 ${formatPercent(step.abandonmentRate)}`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Experiment bucket breakdown */}
      {data && data.experiments.length > 0 && (
        <Card data-testid="card-funnel-experiments">
          <CardHeader>
            <CardTitle>实验分桶</CardTitle>
            <CardDescription>按实验 flag / bucket 统计的进入与完成会话数</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.experiments.map((bucket) => (
                <div
                  key={`${bucket.flagKey}:${bucket.bucket}`}
                  className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0"
                  data-testid={`experiment-${bucket.flagKey}-${bucket.bucket}`}
                >
                  <span className="font-medium">
                    {bucket.flagKey} <span className="text-muted-foreground">/ {bucket.bucket}</span>
                  </span>
                  <span className="text-muted-foreground">
                    进入 {bucket.enteredSessions} · 完成 {bucket.completedSessions}
                    {bucket.enteredSessions > 0 &&
                      ` · 完成率 ${formatPercent(bucket.completedSessions / bucket.enteredSessions)}`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
