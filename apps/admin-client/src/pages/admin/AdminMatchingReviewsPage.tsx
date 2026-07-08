import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/ui/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, X, Users, Eye } from "lucide-react";
import { safeFormat } from "@/lib/dateUtils";

type ReviewStatus = "pending" | "approved" | "rejected" | "all";

interface ReviewPoolSummary {
  id: string;
  title: string;
  eventType: string;
  city: string | null;
  district: string | null;
  dateTime: string;
  status: string;
  operatorReviewStatus: string;
  operatorReviewReason: string | null;
  operatorReviewedBy: string | null;
  operatorReviewedAt: string | null;
  reviewedByName: string | null;
  totalRegistrations: number | null;
  matchedAt: string | null;
  groupCount: number;
}

interface ReviewPoolListResponse {
  pools: ReviewPoolSummary[];
  pagination: { limit: number; offset: number };
}

interface ReviewMember {
  userId: string;
  displayName: string | null;
  archetype: string | null;
  gender: string | null;
}

interface ReviewGroup {
  id: string;
  groupNumber: number;
  memberCount: number | null;
  overallScore: number | null;
  status: string;
  operatorReviewStatus: string;
  members: ReviewMember[];
}

interface ReviewPoolGroupsResponse {
  poolId: string;
  poolTitle: string;
  operatorReviewStatus: string;
  groups: ReviewGroup[];
}

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审核", variant: "secondary" },
  approved: { label: "已通过", variant: "default" },
  rejected: { label: "已驳回", variant: "destructive" },
  none: { label: "无需审核", variant: "outline" },
};

export default function AdminMatchingReviewsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [viewPoolId, setViewPoolId] = useState<string | null>(null);
  const [rejectPoolId, setRejectPoolId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const { data, isLoading, error } = useQuery<ReviewPoolListResponse | null>({
    queryKey: [`/api/admin/matching-reviews/pools?status=${status}&limit=50&offset=0`],
  });

  const { data: groupData, isLoading: groupLoading } = useQuery<ReviewPoolGroupsResponse | null>({
    queryKey: [`/api/admin/matching-reviews/pools/${viewPoolId}/groups`],
    enabled: Boolean(viewPoolId),
  });

  const approveMutation = useMutation({
    mutationFn: async (poolId: string) => {
      return await apiRequest("POST", `/api/admin/matching-reviews/pools/${poolId}/approve`).then(
        (response) => response.json()
      );
    },
    onSuccess: () => {
      toast({ title: "已通过", description: "匹配结果已审核通过，用户将收到匹配通知" });
      setAnnouncement("已通过：匹配结果已审核通过，用户将收到匹配通知");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matching-reviews/pools"] });
      setViewPoolId(null);
    },
    onError: (err: Error) => {
      toast({ title: "通过失败", description: err.message, variant: "destructive" });
      setAnnouncement(`通过失败：${err.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ poolId, reason }: { poolId: string; reason: string }) => {
      return await apiRequest("POST", `/api/admin/matching-reviews/pools/${poolId}/reject`, { reason }).then(
        (response) => response.json()
      );
    },
    onSuccess: () => {
      toast({ title: "已驳回", description: "匹配结果已驳回，报名状态已重置为匹配中" });
      setAnnouncement("已驳回：匹配结果已驳回，报名状态已重置为匹配中");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matching-reviews/pools"] });
      setRejectPoolId(null);
      setRejectReason("");
    },
    onError: (err: Error) => {
      toast({ title: "驳回失败", description: err.message, variant: "destructive" });
      setAnnouncement(`驳回失败：${err.message}`);
    },
  });

  const pools = data?.pools ?? [];
  const selectedPool = pools.find((p) => p.id === viewPoolId);

  const handleApprove = (poolId: string) => {
    approveMutation.mutate(poolId);
  };

  const handleReject = () => {
    if (!rejectPoolId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      toast({ title: "请输入驳回原因", variant: "destructive" });
      return;
    }
    rejectMutation.mutate({ poolId: rejectPoolId, reason });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">匹配审核</h1>
          <p className="text-muted-foreground">
            审核待确认的匹配结果，通过后用户将看到匹配状态。
          </p>
        </div>
        <Tabs value={status} onValueChange={(v) => setStatus(v as ReviewStatus)}>
          <TabsList>
            <TabsTrigger value="pending">待审核</TabsTrigger>
            <TabsTrigger value="approved">已通过</TabsTrigger>
            <TabsTrigger value="rejected">已驳回</TabsTrigger>
            <TabsTrigger value="all">全部</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      <Card data-testid="matching-reviews-card">
        <CardHeader>
          <CardTitle>活动池列表</CardTitle>
          <CardDescription>共 {pools.length} 个活动池</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2" data-testid="matching-reviews-skeleton">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <div className="text-destructive" data-testid="matching-reviews-error">加载失败: {error.message}</div>
          ) : pools.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center" data-testid="matching-reviews-empty">
              暂无{status === "all" ? "" : statusBadge[status]?.label ?? status}的活动池
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>活动池</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>城市</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>审核信息</TableHead>
                  <TableHead>小组</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pools.map((pool) => {
                  const badge = statusBadge[pool.operatorReviewStatus] ?? {
                    label: pool.operatorReviewStatus,
                    variant: "outline",
                  };
                  return (
                    <TableRow key={pool.id} data-testid={`matching-review-row-${pool.id}`}>
                      <TableCell className="font-medium">{pool.title}</TableCell>
                      <TableCell>{pool.eventType}</TableCell>
                      <TableCell>
                        {pool.city ?? "-"}
                        {pool.district ? ` · ${pool.district}` : ""}
                      </TableCell>
                      <TableCell>{safeFormat(pool.dateTime, "yyyy-MM-dd HH:mm")}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {pool.operatorReviewStatus === "pending" ? (
                          "—"
                        ) : (
                          <div className="space-y-1">
                            <div className="text-sm">
                              {pool.reviewedByName || pool.operatorReviewedBy || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {safeFormat(pool.operatorReviewedAt, "yyyy-MM-dd HH:mm")}
                            </div>
                            {pool.operatorReviewReason && (
                              <div
                                className="max-w-[200px] truncate text-xs text-destructive"
                                title={pool.operatorReviewReason}
                              >
                                {pool.operatorReviewReason}
                              </div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{pool.groupCount}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewPoolId(pool.id)}
                            data-testid={`matching-review-view-${pool.id}`}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            查看
                          </Button>
                          {pool.operatorReviewStatus === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(pool.id)}
                                disabled={approveMutation.isPending}
                                data-testid={`matching-review-approve-${pool.id}`}
                              >
                                {approveMutation.isPending ? (
                                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="mr-1 h-4 w-4" />
                                )}
                                通过
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setRejectPoolId(pool.id)}
                                disabled={rejectMutation.isPending}
                                data-testid={`matching-review-reject-${pool.id}`}
                              >
                                <X className="mr-1 h-4 w-4" />
                                驳回
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Groups Dialog */}
      <Dialog
        open={Boolean(viewPoolId)}
        onOpenChange={(open) => !open && setViewPoolId(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{groupData?.poolTitle ?? "活动池详情"}</DialogTitle>
            <DialogDescription>
              {groupData?.operatorReviewStatus === "pending"
                ? "匹配结果待审核，通过后将通知用户"
                : groupData?.operatorReviewStatus === "approved"
                ? "匹配结果已通过"
                : "匹配结果已驳回"}
              {groupData?.operatorReviewStatus === "rejected" && selectedPool?.operatorReviewReason && (
                <div className="mt-2 text-destructive">
                  驳回原因：{selectedPool.operatorReviewReason}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          {groupLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {(groupData?.groups ?? []).map((group) => (
                <div key={group.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="font-semibold">第 {group.groupNumber} 组</div>
                    <div className="text-sm text-muted-foreground">
                      {group.memberCount} 人 · 匹配分 {group.overallScore ?? "-"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.members.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm"
                      >
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span>{member.displayName ?? "未知用户"}</span>
                        {member.archetype && (
                          <span className="text-muted-foreground">· {member.archetype}</span>
                        )}
                        {member.gender && (
                          <span className="text-muted-foreground">· {member.gender}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            {groupData?.operatorReviewStatus === "pending" && (
              <div className="flex w-full justify-end gap-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    setViewPoolId(null);
                    setRejectPoolId(viewPoolId);
                  }}
                >
                  驳回
                </Button>
                <Button
                  onClick={() => viewPoolId && handleApprove(viewPoolId)}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending && (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  )}
                  通过
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={Boolean(rejectPoolId)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectPoolId(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回匹配结果</DialogTitle>
            <DialogDescription>
              请输入驳回原因。驳回后该活动池将恢复为匹配中状态，可重新匹配。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="例如：男女比例不均、小组人数不合适…"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectPoolId(null);
                setRejectReason("");
              }}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
