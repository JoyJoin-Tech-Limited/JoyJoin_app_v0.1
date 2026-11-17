import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildAdminInterestView, INTEREST_HEAT_LEGEND } from "./adminInterestDisplay";
import type { UserInterests } from "./types";

interface AdminUserInterestCardProps {
  interests: UserInterests | null | undefined;
}

/**
 * Read-only interest panel for the user-detail drawer.
 *
 * Operators read this to understand matching inputs, so every selection is
 * listed with its own heat tier — the stored `topPriorities` array only holds
 * level-3 items and silently hides the rest.
 */
export function AdminUserInterestCard({ interests }: AdminUserInterestCardProps) {
  const view = useMemo(() => buildAdminInterestView(interests), [interests]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-3">
          <span>兴趣数据</span>
          <span className="text-xs font-normal text-muted-foreground">
            {view.totalSelections} 项兴趣 · 覆盖 {view.categoryCount} 类 · 总热度 {view.totalHeat}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {view.totalSelections === 0 ? (
          <p className="text-sm text-muted-foreground">尚未填写兴趣</p>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-muted-foreground">{INTEREST_HEAT_LEGEND}</p>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">兴趣明细</p>
              <div className="divide-y divide-border/60">
                {view.rows.map((row) => (
                  <div
                    key={row.topicId}
                    className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
                    data-testid={`interest-row-${row.topicId}`}
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-xs text-muted-foreground"> · {row.categoryLabel}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {row.levelLabel} <span className="font-medium text-foreground">{row.heat}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {view.categories.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">分类热度</p>
                <div className="space-y-2">
                  {view.categories.map((category) => (
                    <div key={category.categoryId} data-testid={`interest-category-${category.categoryId}`}>
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="font-medium">
                          {category.label}
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            {category.selectionCount} 项
                          </span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">{category.heat}</span>
                      </div>
                      <div className="mt-1 h-1 w-full rounded-full bg-muted">
                        <div
                          className="h-1 rounded-full bg-primary/60"
                          style={{ width: `${category.strengthPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
