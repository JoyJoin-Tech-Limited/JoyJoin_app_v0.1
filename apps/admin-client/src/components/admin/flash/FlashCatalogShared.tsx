import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import type { FlashApprovalStatus } from "@/lib/flashAdmin";

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 7, label: "周日" },
] as const;

export const SHENZHEN_DISTRICTS = [
  "南山区",
  "福田区",
  "罗湖区",
  "宝安区",
  "龙岗区",
  "盐田区",
  "龙华区",
  "坪山区",
  "光明区",
  "大鹏新区",
] as const;

export const TASK_CATEGORIES = [
  "探店",
  "城市观察",
  "轻社交勇气",
  "独处放松",
  "文化发现",
  "微小善意",
] as const;

export type FlashCollectionResponse<T> =
  | T[]
  | { items?: T[]; data?: T[]; npcs?: T[]; locations?: T[]; destinations?: T[]; templates?: T[] };

export function describeFlashAdminError(error: unknown): string {
  return error instanceof Error ? error.message : "操作没成功，请再试一次。";
}

export function flashApprovalLabel(status: FlashApprovalStatus): string {
  if (status === "approved") return "已审核";
  if (status === "rejected") return "已拒绝";
  return "待审核";
}

export function flashApprovalVariant(status: FlashApprovalStatus) {
  if (status === "approved") return "default" as const;
  if (status === "rejected") return "destructive" as const;
  return "secondary" as const;
}

export function FlashActiveBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "outline" : "secondary"}>{active ? "可用" : "已撤下"}</Badge>;
}

export function FlashWriteHint({ canWrite }: { canWrite: boolean }) {
  if (canWrite) return null;
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
      你当前是 viewer，只能查看；修改、审核与发布需要 operator 或 super_admin。
    </div>
  );
}

export function FlashFormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
