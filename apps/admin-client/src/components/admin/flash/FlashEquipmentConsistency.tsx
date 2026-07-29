import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlashErrorState, FlashListSkeleton } from "./FlashQueryState";

type ConsistencyResult = {
  status: "healthy" | "warning" | "blocked";
  summary: {
    checks: number;
    passed: number;
    blocking: number;
    warnings: number;
  };
  issues: Array<{
    code: string;
    severity: "blocking" | "warning";
    title: string;
    detail: string;
    entityType: "rollout" | "item" | "pool";
    entityId: string | null;
    entityName: string | null;
  }>;
  checkedAt: string;
};

function describeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).replace(/^\d+:\s*/, "") || "一致性检查暂时无法完成";
}

export function FlashEquipmentConsistency() {
  const query = useQuery<ConsistencyResult>({
    queryKey: ["/api/admin/equipment/consistency"],
  });

  if (query.isLoading) return <FlashListSkeleton />;
  if (query.isError || !query.data) {
    return <FlashErrorState message={describeError(query.error)} onRetry={() => void query.refetch()} />;
  }

  const { status, summary, issues } = query.data;
  const statusCopy = status === "healthy"
    ? { title: "配置一致，可以继续运营", description: "当前没有发现阻断项或配置警告。", icon: CheckCircle2 }
    : status === "blocked"
      ? { title: "存在上线阻断项", description: "请先处理红色问题，再开放装备奖励或我的形象。", icon: CircleAlert }
      : { title: "配置可运行，但建议整理", description: "没有上线阻断项；黄色问题不会立即中断运行。", icon: AlertTriangle };
  const StatusIcon = statusCopy.icon;

  return (
    <div className="space-y-4" data-testid="panel-equipment-consistency">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">装备配置一致性检查</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            检查装备开关、启用装备、奖池构成和商店状态。正式闪现不发奖励，因此不在这里检查。
          </p>
        </div>
        <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching} data-testid="button-refresh-equipment-consistency">
          <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
          重新检查
        </Button>
      </div>

      <Alert className={status === "blocked" ? "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20" : status === "warning" ? "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20" : "border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20"}>
        <StatusIcon className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{statusCopy.title}</AlertTitle>
        <AlertDescription>{statusCopy.description}</AlertDescription>
      </Alert>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="检查规则" value={summary.checks} />
        <SummaryCard label="已通过" value={summary.passed} tone="success" />
        <SummaryCard label="阻断项" value={summary.blocking} tone="danger" />
        <SummaryCard label="警告项" value={summary.warnings} tone="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>检查结果</CardTitle>
          <CardDescription>红色项会影响功能开放；黄色项是配置含义或发放覆盖提醒。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {issues.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-100">
              <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="text-sm">5 项规则全部通过，无需处理。</p>
            </div>
          ) : issues.map((issue) => (
            <div key={`${issue.code}-${issue.entityId ?? "global"}`} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={issue.severity === "blocking" ? "destructive" : "secondary"}>
                  {issue.severity === "blocking" ? "阻断" : "警告"}
                </Badge>
                <p className="font-medium">{issue.title}</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{issue.detail}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "text-emerald-600" : tone === "warning" ? "text-amber-600" : tone === "danger" ? "text-red-600" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
