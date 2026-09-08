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
import type { AdminEventPool } from "./types";

type DuoInviteStatus = "pending" | "bound" | "expired";

interface DuoInviteItem {
  id: string;
  code: string;
  invitationType: string | null;
  inviterId: string;
  inviterDisplayName: string | null;
  inviteeId: string | null;
  inviteeDisplayName: string | null;
  poolId: string | null;
  poolTitle: string | null;
  poolCity: string | null;
  poolDateTime: string | null;
  status: DuoInviteStatus;
  createdAt: string | null;
  expiresAt: string | null;
  boundAt: string | null;
}

interface DuoInviteListResponse {
  items: DuoInviteItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待绑定" },
  { value: "bound", label: "已绑定" },
  { value: "expired", label: "已过期" },
];

function StatusBadge({ status }: { status: DuoInviteStatus }) {
  if (status === "bound") {
    return <Badge className="bg-green-500 hover:bg-green-500">已绑定</Badge>;
  }
  if (status === "pending") {
    return <Badge variant="secondary">待绑定</Badge>;
  }
  return <Badge variant="outline">已过期</Badge>;
}

const PAGE_SIZE = 20;

export default function AdminDuoInvitesPage() {
  const [statusFilter, setStatusFilter] = useState("all");
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
    queryKey: ["/api/admin/duo-invites", { status: statusFilter, poolId: poolFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
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

  const handlePoolChange = (value: string) => {
    setPoolFilter(value);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          双人成行
        </h1>
        <p className="text-muted-foreground mt-1">
          双人成行绑定后在排桌中作为整体入组，未成行将整组顺延并自动退款。
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
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

        <Select value={poolFilter} onValueChange={handlePoolChange}>
          <SelectTrigger className="w-64" data-testid="select-pool-filter">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>邀请人</TableHead>
                  <TableHead>被邀请人</TableHead>
                  <TableHead>所属活动池</TableHead>
                  <TableHead>邀请码</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>过期时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id} data-testid={`row-duo-invite-${item.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.inviterDisplayName || "未设置昵称"}</p>
                        <p className="text-xs text-muted-foreground">{item.inviterId.slice(0, 12)}…</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.inviteeId ? (
                        <div>
                          <p className="font-medium">{item.inviteeDisplayName || "未设置昵称"}</p>
                          <p className="text-xs text-muted-foreground">{item.inviteeId.slice(0, 12)}…</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.poolTitle ? (
                        <div>
                          <p className="font-medium">{item.poolTitle}</p>
                          <p className="text-xs text-muted-foreground">{fmtDateTimeShort(item.poolDateTime)}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.code}</code>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
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
