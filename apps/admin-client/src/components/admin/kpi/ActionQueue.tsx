import { CheckCircle2, ChevronRight, AlertOctagon, AlertTriangle, Circle } from "lucide-react";
import { Link } from "wouter";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type QueueSeverity = "critical" | "warning" | "info";

export interface ActionQueueItem {
  id: string;
  label: string;
  detail: string;
  href: string;
}

export interface ActionQueueRow {
  key: string;
  label: string;
  count: number;
  correctNumber: string;
  recommendedAction: string;
  slaHours: number | null;
  owner: "operator" | "ops" | "super_admin";
  severity: QueueSeverity;
  href: string;
  cleared: boolean;
  items?: ActionQueueItem[];
}

const OWNER_LABEL: Record<ActionQueueRow["owner"], string> = {
  operator: "运营",
  ops: "现场",
  super_admin: "超管",
};

const SEVERITY_STYLE: Record<QueueSeverity, { stripe: string; icon: typeof Circle; iconClass: string }> = {
  critical: { stripe: "bg-rose-500", icon: AlertOctagon, iconClass: "text-rose-600" },
  warning: { stripe: "bg-amber-500", icon: AlertTriangle, iconClass: "text-amber-600" },
  info: { stripe: "bg-muted-foreground/30", icon: Circle, iconClass: "text-muted-foreground/50" },
};

function slaText(hours: number | null): string {
  if (hours === null) return "无硬时限";
  if (hours <= 0) return "已超期";
  if (hours < 1) return `${Math.round(hours * 60)} 分钟`;
  if (hours < 48) return `${Math.round(hours)} 小时`;
  return `${Math.round(hours / 24)} 天`;
}

interface ActionQueueProps {
  rows: ActionQueueRow[] | undefined;
  loading?: boolean;
  totals?: { open: number; critical: number };
}

export function ActionQueue({ rows, loading, totals }: ActionQueueProps) {
  return (
    <Card data-testid="action-queue">
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-base">决策队列</CardTitle>
          {totals ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {totals.open} 项待处理
              {totals.critical > 0 ? ` · ${totals.critical} 项紧急` : ""}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="px-4 pb-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="w-1 p-0" aria-label="优先级" />
                <th className="px-3 py-2 text-left font-medium">待办</th>
                <th className="px-3 py-2 text-left font-medium">正确数字</th>
                <th className="hidden px-3 py-2 text-left font-medium lg:table-cell">建议动作</th>
                <th className="px-3 py-2 text-left font-medium">时限</th>
                <th className="hidden px-3 py-2 text-left font-medium md:table-cell">归属</th>
                <th className="w-8 p-0" />
              </tr>
            </thead>
            <tbody>
              {rows?.map((row) => {
                const style = SEVERITY_STYLE[row.severity];
                const Icon = style.icon;
                if (row.cleared) {
                  return (
                    <tr key={row.key} className="border-b border-border/60" data-testid={`queue-row-${row.key}`}>
                      <td className={cn("p-0 w-1 bg-emerald-500/40")} />
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          {row.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">已清空</td>
                      <td className="hidden lg:table-cell" />
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">—</td>
                      <td className="hidden md:table-cell" />
                      <td />
                    </tr>
                  );
                }
                return (
                  <tr
                    key={row.key}
                    className="border-b border-border/60 align-top hover:bg-muted/30"
                    data-testid={`queue-row-${row.key}`}
                  >
                    <td className={cn("p-0 w-1", style.stripe)} />
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Icon className={cn("h-3.5 w-3.5 shrink-0", style.iconClass)} />
                        {row.label}
                        <span className="text-muted-foreground tabular-nums">· {row.count}</span>
                      </div>
                      {row.items && row.items.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 pl-5">
                          {row.items.map((item) => (
                            <li key={item.id} className="text-xs text-muted-foreground">
                              <Link href={item.href} className="hover:underline">
                                {item.label}
                              </Link>
                              <span className="ml-1 text-muted-foreground/70">{item.detail}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[22rem]">
                      {row.correctNumber}
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground lg:table-cell max-w-[18rem]">
                      {row.recommendedAction}
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
                      {slaText(row.slaHours)}
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
                      {OWNER_LABEL[row.owner]}
                    </td>
                    <td className="px-1 py-2.5">
                      <Link
                        href={row.href}
                        aria-label={`打开 ${row.label}`}
                        data-testid={`queue-row-${row.key}-link`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-muted"
                      >
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export default ActionQueue;
