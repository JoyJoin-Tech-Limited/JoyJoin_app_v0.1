import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { fmtDateTimeShort } from "@/lib/dateUtils";
import AdminQueryError from "@/components/admin/AdminQueryError";
import EmptyState from "@/components/admin/EmptyState";
import { formatDuoSeatedRate, getDuoRewardOutcome, getDuoSeatedOutcome, type DuoOutcome } from "@/components/admin/duo/duoInviteUtils";
import { personLabel } from "./personLabel";
import type { AdminEventPool } from "./types";

type DuoInviteStatus = "pending" | "bound" | "expired";

interface DuoInviteItem {
  id: string;
  useId: string | null;
  code: string;
  invitationType: string | null;
  inviterId: string;
  inviterDisplayName: string | null;
  inviterWechatNickname: string | null;
  inviteeId: string | null;
  inviteeDisplayName: string | null;
  inviteeWechatNickname: string | null;
  poolId: string | null;
  poolTitle: string | null;
  poolCity: string | null;
  poolDateTime: string | null;
  status: DuoInviteStatus;
  createdAt: string | null;
  expiresAt: string | null;
  boundAt: string | null;
  hasConflict: boolean;
  matchedTogether: boolean | null;
  rewardIssued: boolean | null;
}

interface DuoInviteSummary {
  total: number;
  pending: number;
  accepted: number;
  expired: number;
  conflict: number;
  seated: number;
  rewarded: number;
}

interface DuoInviteListResponse {
  items: DuoInviteItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: DuoInviteSummary;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "状态：全部" },
  { value: "pending", label: "状态：待接受" },
  { value: "bound", label: "状态：已接受" },
  { value: "expired", label: "状态：已过期" },
];

const CONFLICT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "冲突：全部" },
  { value: "true", label: "冲突：仅冲突" },
  { value: "false", label: "冲突：无冲突" },
];

function StatusBadge({ status }: { status: DuoInviteStatus }) {
  if (status === "bound") {
    return <Badge className="border-green-200 bg-green-100 text-green-800 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-300">已接受</Badge>;
  }
  if (status === "pending") {
    return <Badge variant="secondary">待接受</Badge>;
  }
  return <Badge variant="outline">已过期</Badge>;
}

function OutcomeDisplay({ outcome }: { outcome: DuoOutcome }) {
  if (outcome.tone === "success") {
    return <Badge className="border-green-200 bg-green-100 text-green-800 hover:bg-green-100 dark:border-green-800 dark:bg-green-950 dark:text-green-300">{outcome.label}</Badge>;
  }
  if (outcome.tone === "attention") {
    return <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">{outcome.label}</Badge>;
  }
  return <span className="text-sm text-muted-foreground">{outcome.label}</span>;
}

const PAGE_SIZE = 20;

export default function AdminDuoInvitesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [conflictFilter, setConflictFilter] = useState("all");
  const [poolFilter, setPoolFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data: pools = [] } = useQuery<AdminEventPool[]>({
    queryKey: ["/api/admin/event-pools"],
  });

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<DuoInviteListResponse>({
    queryKey: [
      "/api/admin/duo-invites",
      { status: statusFilter, conflict: conflictFilter, poolId: poolFilter, page },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (conflictFilter !== "all") params.set("conflict", conflictFilter);
      if (poolFilter !== "all") params.set("poolId", poolFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await apiRequest("GET", `/api/admin/duo-invites?${params.toString()}`);
      return res.json();
    },
  });

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setPage(1);
  };

  const handleConflictChange = (value: string) => {
    setConflictFilter(value);
    setPage(1);
  };

  const handlePoolChange = (value: string) => {
    setPoolFilter(value);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          双人成行
        </h1>
        <p className="text-muted-foreground mt-1">
          双人成行绑定后在排桌中作为整体入组，未成行将整组顺延并自动退款。
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          accepted = 至少一条使用记录；seated = 排桌后同桌记录；均不是双方当前绑定状态。
        </p>
      </div>

      {isLoading && !data ? (
        <div className="space-y-2" data-testid="duo-summary-loading" aria-busy="true" aria-label="双人成行统计加载中">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {["待接受", "已接受", "冲突", "同桌率"].map((label) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <Skeleton className="mt-2 h-8 w-16" />
                  {label === "同桌率" ? <Skeleton className="mt-1 h-4 w-full max-w-56" /> : null}
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            按当前活动池统计，不随状态或冲突筛选变化
          </p>
        </div>
      ) : data ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="duo-summary-cards">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">待接受</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">已接受</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.accepted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">冲突</p>
              <p className="mt-2 text-2xl font-semibold">{data.summary.conflict}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">同桌率</p>
              <p className="mt-2 text-2xl font-semibold">
                {formatDuoSeatedRate(data.summary.seated, data.summary.accepted)}
              </p>
              <p
                className="mt-1 truncate text-xs text-muted-foreground"
                title={`${data.summary.seated} 条同桌记录 / ${data.summary.accepted} 份已接受邀请`}
              >
                {data.summary.seated} 条同桌记录 / {data.summary.accepted} 份已接受邀请
              </p>
            </CardContent>
          </Card>
          </div>
          <p className="text-xs text-muted-foreground">
            按当前活动池统计，不随状态或冲突筛选变化
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-40" data-testid="select-status-filter" aria-label="按接受状态筛选">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={conflictFilter} onValueChange={handleConflictChange}>
          <SelectTrigger className="w-40" data-testid="select-conflict-filter" aria-label="按冲突状态筛选">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONFLICT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={poolFilter} onValueChange={handlePoolChange}>
          <SelectTrigger className="w-64" data-testid="select-pool-filter" aria-label="按活动池筛选">
            <SelectValue placeholder="全部活动池" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部活动池</SelectItem>
            {pools.map((pool) => (
              <SelectItem key={pool.id} value={pool.id}>
                {pool.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <AdminQueryError
          title="双人成行邀请加载失败"
          error={error}
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState title="暂无双人成行邀请" description="调整筛选条件或等待用户发起邀请" />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border">
            <Table className="min-w-[1180px] table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">邀请人</TableHead>
                  <TableHead className="w-[170px]">被邀请人</TableHead>
                  <TableHead className="w-[230px]">所属活动池</TableHead>
                  <TableHead className="w-[120px]">邀请码</TableHead>
                  <TableHead className="w-[130px]">状态</TableHead>
                  <TableHead className="w-[110px]">同桌结果</TableHead>
                  <TableHead className="w-[110px]">奖励结果</TableHead>
                  <TableHead className="w-[140px]">过期时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow
                    key={`${item.id}:${item.useId ?? "no-use"}`}
                    data-testid={`row-duo-invite-${item.id}-${item.useId ?? "no-use"}`}
                  >
                    <TableCell>
                      <p
                        className="truncate font-medium"
                        title={personLabel({
                          displayName: item.inviterDisplayName,
                          wechatNickname: item.inviterWechatNickname,
                          id: item.inviterId,
                        })}
                      >
                        {personLabel({
                          displayName: item.inviterDisplayName,
                          wechatNickname: item.inviterWechatNickname,
                          id: item.inviterId,
                        })}
                      </p>
                    </TableCell>
                    <TableCell>
                      {item.inviteeId ? (
                        <p
                          className="truncate font-medium"
                          title={personLabel({
                            displayName: item.inviteeDisplayName,
                            wechatNickname: item.inviteeWechatNickname,
                            id: item.inviteeId,
                          })}
                        >
                          {personLabel({
                            displayName: item.inviteeDisplayName,
                            wechatNickname: item.inviteeWechatNickname,
                            id: item.inviteeId,
                          })}
                        </p>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.poolTitle ? (
                        <div>
                          <p className="truncate font-medium" title={item.poolTitle}>{item.poolTitle}</p>
                          <p className="text-xs text-muted-foreground">{fmtDateTimeShort(item.poolDateTime)}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.code}</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={item.status} />
                        {item.hasConflict ? (
                          <Badge className="border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            冲突
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <OutcomeDisplay outcome={getDuoSeatedOutcome(item.matchedTogether)} />
                    </TableCell>
                    <TableCell>
                      <OutcomeDisplay outcome={getDuoRewardOutcome(item.rewardIssued, item.matchedTogether)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {fmtDateTimeShort(item.expiresAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              共 {data.total} 条 · 第 {data.page} / {Math.max(data.totalPages, 1)} 页
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                上一页
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.totalPages}
                data-testid="button-next-page"
              >
                下一页
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
