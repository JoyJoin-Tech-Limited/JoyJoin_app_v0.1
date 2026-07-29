import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, CircleAlert, PackageCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FlashOverview } from "@/lib/flashAdmin";
import { getFlashReadinessItems } from "@/lib/flashAdmin";
import { FlashErrorState, FlashListSkeleton } from "./FlashQueryState";

type EquipmentConsistency = {
  status: "healthy" | "warning" | "blocked";
  summary: { checks: number; passed: number; blocking: number; warnings: number };
  issues: Array<{
    code: string;
    severity: "blocking" | "warning";
    title: string;
    detail: string;
    entityId: string | null;
  }>;
};

export function FlashOperationsConsistency() {
  const overview = useQuery<FlashOverview>({ queryKey: ["/api/admin/alang/overview"] });
  const equipment = useQuery<EquipmentConsistency>({ queryKey: ["/api/admin/equipment/consistency"] });

  if (overview.isLoading || equipment.isLoading) return <FlashListSkeleton />;
  if (overview.isError || equipment.isError || !overview.data || !equipment.data) {
    return (
      <FlashErrorState
        message="整体一致性检查暂时无法完成"
        onRetry={() => void Promise.all([overview.refetch(), equipment.refetch()])}
      />
    );
  }

  const catalogIssues = getFlashReadinessItems(overview.data.readiness);
  const equipmentIssues = equipment.data.issues;
  const todayPublished = overview.data.today?.shifts.filter((shift) => shift.status === "published").length ?? 0;
  const nextDraft = overview.data.nextDraft?.shifts.length ?? 0;
  const blocking = catalogIssues.length + equipment.data.summary.blocking;
  const warnings = equipment.data.summary.warnings + Number(todayPublished === 0) + Number(nextDraft === 0);
  const healthy = blocking === 0 && warnings === 0;

  return (
    <div className="space-y-4" data-testid="panel-flash-operations-consistency">
      <div>
        <h3 className="text-lg font-semibold">街头盲盒整体一致性检查</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          同时核对 NPC、地点、任务、当日/次日排班及装备奖励，避免只检查单个模块。
        </p>
      </div>

      <Alert className={blocking > 0 ? "border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20" : healthy ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20" : "border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20"}>
        {blocking > 0 ? <CircleAlert className="h-4 w-4" /> : healthy ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        <AlertTitle>{blocking > 0 ? `存在 ${blocking} 个阻断项` : healthy ? "整体配置一致" : `可以运行，但有 ${warnings} 个提醒`}</AlertTitle>
        <AlertDescription>阻断项必须先处理；排班提醒需结合当天是否为 NPC 可出现日判断。</AlertDescription>
      </Alert>

      <div className="grid gap-4 xl:grid-cols-3">
        <ConsistencySection
          title="NPC、地点与任务目录"
          description="沿用小程序上线使用的同一套服务端准备度检查。"
          icon={CheckCircle2}
          status={catalogIssues.length === 0 ? "pass" : "block"}
          items={catalogIssues.length === 0
            ? ["正式 NPC、审核地点和人工任务目录均已就绪。"]
            : catalogIssues.map((issue) => `${issue.label}：${issue.detail}`)}
        />
        <ConsistencySection
          title="今日 / 次日排班"
          description="检查今日发布结果与次日草案是否存在。"
          icon={CalendarClock}
          status={todayPublished > 0 && nextDraft > 0 ? "pass" : "warning"}
          items={[
            todayPublished > 0 ? `今日已有 ${todayPublished} 个已发布班次。` : "今日没有已发布班次，请确认今天是否为可出现日。",
            nextDraft > 0 ? `次日已有 ${nextDraft} 个草案班次。` : "次日尚未生成排班草案。",
          ]}
        />
        <ConsistencySection
          title="装备 / 奖励"
          description="检查开关、装备状态、装备池构成和商店状态。"
          icon={PackageCheck}
          status={equipment.data.status === "blocked" ? "block" : equipment.data.status === "warning" ? "warning" : "pass"}
          items={equipmentIssues.length === 0
            ? ["装备奖励配置的 5 项规则全部通过。"]
            : equipmentIssues.map((issue) => `${issue.title}：${issue.detail}`)}
        />
      </div>
    </div>
  );
}

function ConsistencySection({
  title,
  description,
  icon: Icon,
  status,
  items,
}: {
  title: string;
  description: string;
  icon: typeof CheckCircle2;
  status: "pass" | "warning" | "block";
  items: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4" />{title}</CardTitle>
          <Badge variant={status === "block" ? "destructive" : "secondary"}>
            {status === "pass" ? "通过" : status === "warning" ? "提醒" : "阻断"}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          {items.map((item) => <li key={item} className="rounded-lg bg-muted/50 px-3 py-2">{item}</li>)}
        </ul>
      </CardContent>
    </Card>
  );
}
