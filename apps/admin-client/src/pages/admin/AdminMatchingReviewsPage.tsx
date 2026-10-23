import { useEffect, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/ui/use-toast";
import { useAuth } from "@/hooks/auth/useAuth";
import { ToastAction } from "@/components/ui/toast";
import { invalidateNavBadges } from "@/lib/navBadges";
import { apiRequest } from "@/lib/queryClient";
import AdminQueryError from "@/components/admin/AdminQueryError";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, X, Users, Eye, Info } from "lucide-react";
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

/** Per-pool outcome of `POST /api/admin/matching-reviews/approve-batch`. */
type BatchApproveResultCode =
  | "approved"
  | "already_approved"
  | "not_pending"
  | "not_found"
  | "error";

interface BatchApproveOutcome {
  poolId: string;
  result: BatchApproveResultCode;
  approvedGroups?: number;
  message?: string;
}

type BatchApproveFailure = BatchApproveOutcome & {
  result: "not_pending" | "not_found" | "error";
};

interface BatchApproveResponse {
  success: boolean;
  approvedCount: number;
  alreadyApprovedCount: number;
  failedCount: number;
  outcomes?: BatchApproveOutcome[];
}

const BATCH_FAILURE_LABEL: Record<BatchApproveFailure["result"], string> = {
  not_pending: "已不在待审核状态",
  not_found: "场次不存在",
  error: "处理出错",
};

function isBatchFailure(outcome: BatchApproveOutcome): outcome is BatchApproveFailure {
  return (
    outcome.result === "not_pending" ||
    outcome.result === "not_found" ||
    outcome.result === "error"
  );
}

/** Rows shown in the confirm dialog before falling back to 「等 N 个」. */
const BATCH_VISIBLE_LIMIT = 8;

const statusBadge: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待审核", variant: "secondary" },
  approved: { label: "已通过", variant: "default" },
  rejected: { label: "已驳回", variant: "destructive" },
  none: { label: "无需审核", variant: "outline" },
};

export default function AdminMatchingReviewsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [viewPoolId, setViewPoolId] = useState<string | null>(null);
  const [rejectPoolId, setRejectPoolId] = useState<string | null>(null);
  const [approvePoolId, setApprovePoolId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [announcement, setAnnouncement] = useState("");
  // Batch approval: selection lives in an array (not a Set) so React state
  // updates stay predictable. Capped at 20 server-side and mirrored here.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false);

  const BATCH_LIMIT = 20;

  const { data, isLoading, error, refetch } = useQuery<ReviewPoolListResponse | null>({
    queryKey: [`/api/admin/matching-reviews/pools?status=${status}&limit=50&offset=0`],
  });

  const { data: groupData, isLoading: groupLoading } = useQuery<ReviewPoolGroupsResponse | null>({
    queryKey: [`/api/admin/matching-reviews/pools/${viewPoolId}/groups`],
    enabled: Boolean(viewPoolId),
  });

  const pools = data?.pools ?? [];
  // The batch response only carries pool ids; titles come from the loaded list so
  // a failure can be reported by name instead of by count.
  const poolTitleById = new Map(pools.map((pool) => [pool.id, pool.title]));

  // Selection holds ids, so a refetch can strand ids whose pool left the list
  // (approved elsewhere, deleted, or filtered out by the status tab). Validate on
  // every list or selection change: submitting a ghost id comes back as
  // `not_found` and hands the operator a failure they cannot act on.
  useEffect(() => {
    if (!data?.pools) return;
    const present = new Set(data.pools.map((pool) => pool.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => present.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [data, selectedIds]);

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
      invalidateNavBadges(queryClient);
      setApprovePoolId(null);
      setViewPoolId(null);
    },
    onError: (err: Error) => {
      toast({ title: "通过失败", description: err.message, variant: "destructive" });
      setAnnouncement(`通过失败：${err.message}`);
    },
  });

  const batchApproveMutation = useMutation({
    mutationFn: async (poolIds: string[]): Promise<BatchApproveResponse> => {
      const response = await apiRequest("POST", "/api/admin/matching-reviews/approve-batch", {
        poolIds,
      });
      return (await response.json()) as BatchApproveResponse;
    },
    onSuccess: (result) => {
      const outcomes = result.outcomes ?? [];
      const failures = outcomes.filter(isBatchFailure);
      const failedPoolIds = failures.map((outcome) => outcome.poolId);
      // `outcomes` is always present on the current server; fall back to the
      // aggregate count so a partial payload still reports a failure.
      const failedCount = failures.length > 0 ? failures.length : (result.failedCount ?? 0);

      const successParts: string[] = [];
      if (result.approvedCount > 0) successParts.push(`已通过 ${result.approvedCount} 个场次`);
      if (result.alreadyApprovedCount > 0) {
        successParts.push(`${result.alreadyApprovedCount} 个此前已通过`);
      }
      const successClause = successParts.join("，") || "没有场次通过";

      if (failedCount === 0) {
        toast({ title: "批量通过完成", description: successClause });
        setAnnouncement(`批量通过：${successClause}`);
        // Nothing left to retry — drop the selection.
        setSelectedIds([]);
      } else {
        const titleOf = (poolId: string) =>
          poolTitleById.get(poolId) ?? `场次 ${poolId.slice(0, 8)}`;
        const failureClause =
          failures.length > 0
            ? `${failedCount} 个未通过：${failures
                .slice(0, 3)
                .map((outcome) => `${titleOf(outcome.poolId)}（${BATCH_FAILURE_LABEL[outcome.result]}）`)
                .join("、")}${failures.length > 3 ? ` 等 ${failedCount} 个` : ""}`
            : `${failedCount} 个未通过，请刷新列表后重试`;
        const description = `${successClause}；${failureClause}`;

        toast({
          title:
            result.approvedCount === 0 && result.alreadyApprovedCount === 0
              ? "批量通过未成功"
              : "批量通过部分完成",
          description,
          variant: "destructive",
          // Long enough to read the pool names and to reach the retry shortcut.
          duration: failedPoolIds.length > 0 ? 12_000 : 8_000,
          action:
            failedPoolIds.length > 0 ? (
              <ToastAction
                altText="查看失败场次"
                onClick={() => setSelectedIds(failedPoolIds)}
                data-testid="matching-reviews-batch-view-failed"
              >
                查看失败场次
              </ToastAction>
            ) : undefined,
        });
        setAnnouncement(`批量通过：${description}`);
        // Do NOT clear: the operator may retry without re-selecting, and the
        // ghost-selection guard trims anything the refreshed list dropped.
      }

      setBatchConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/matching-reviews/pools"] });
      invalidateNavBadges(queryClient);
    },
    onError: (err: Error) => {
      toast({ title: "批量通过失败", description: err.message, variant: "destructive" });
      setAnnouncement(`批量通过失败：${err.message}`);
    },
  });

  // Adds are only reachable from a rendered row (so the id is in the list);
  // removals are always allowed. Ids that disappear because the list refreshed
  // are dropped by the prune effect above.
  const toggleSelected = (poolId: string) => {
    setSelectedIds((prev) =>
      prev.includes(poolId)
        ? prev.filter((id) => id !== poolId)
        : prev.length >= BATCH_LIMIT
          ? prev
          : [...prev, poolId],
    );
  };

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
      invalidateNavBadges(queryClient);
      setRejectPoolId(null);
      setRejectReason("");
    },
    onError: (err: Error) => {
      toast({ title: "驳回失败", description: err.message, variant: "destructive" });
      setAnnouncement(`驳回失败：${err.message}`);
    },
  });

  const selectedPool = pools.find((p) => p.id === viewPoolId);

  const handleApprove = (poolId: string) => {
    setApprovePoolId(poolId);
  };

  const confirmApprove = () => {
    if (!approvePoolId) return;
    approveMutation.mutate(approvePoolId);
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
      {user?.matchingOperatorReviewEnabled === false && (
        <div
          className="flex items-start gap-2 rounded-lg border border-muted-foreground/20 bg-muted/40 px-4 py-3 text-sm"
          data-testid="matching-reviews-auto-approve-notice"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium">自动复核当前关闭，排桌结果已直接生效</p>
            <p className="text-muted-foreground">
              此页仍可用于人工抽查与事后调整：已通过的分组不会再进入待审核列表，
              如需返工请在该场次详情内重新发起排桌。若要让每次排桌都先停在待审核，
              可在「功能开关」中开启「匹配结果人工复核」。
            </p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">排桌审批</h1>
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

      {selectedIds.length > 0 && (
        <div
          className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
          data-testid="matching-reviews-batch-bar"
        >
          <div className="text-sm">
            已选 <span className="font-semibold">{selectedIds.length}</span> 个场次
            {selectedIds.length >= BATCH_LIMIT && (
              <span className="text-muted-foreground ml-2">（单次最多 {BATCH_LIMIT} 个）</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              data-testid="matching-reviews-batch-clear"
            >
              取消选择
            </Button>
            <Button
              size="sm"
              onClick={() => setBatchConfirmOpen(true)}
              disabled={batchApproveMutation.isPending}
              data-testid="matching-reviews-batch-approve"
            >
              {batchApproveMutation.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1 h-4 w-4" />
              )}
              批量通过
            </Button>
          </div>
        </div>
      )}

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
            <AdminQueryError
              title="匹配审核列表加载失败"
              error={error}
              onRetry={() => refetch()}
            />
          ) : pools.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center" data-testid="matching-reviews-empty">
              暂无{status === "all" ? "" : statusBadge[status]?.label ?? status}的活动池
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">选择</span>
                  </TableHead>
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
                      <TableCell>
                        {pool.operatorReviewStatus === "pending" ? (
                          <Checkbox
                            checked={selectedIds.includes(pool.id)}
                            onCheckedChange={() => toggleSelected(pool.id)}
                            aria-label={`选择 ${pool.title}`}
                            data-testid={`matching-review-select-${pool.id}`}
                          />
                        ) : null}
                      </TableCell>
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

      {/* Batch approval confirmation. The aggregate counts are not enough to
          judge a mass reveal, so the dialog names every pool that is about to
          be published (8 rows, then 「等 N 个」). */}
      <AlertDialog open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
        <AlertDialogContent data-testid="matching-reviews-batch-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>批量通过 {selectedIds.length} 个场次？</AlertDialogTitle>
            <AlertDialogDescription>
              通过后这些场次的用户会同时看到匹配状态，并触发通知、场地分配与邀请奖励。
              该操作会为每个场次单独记录审计日志。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div
            className="max-h-64 space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-2 text-sm"
            // Focusable so the list can be scrolled from the keyboard.
            tabIndex={0}
            role="group"
            aria-label="待通过场次列表"
            data-testid="matching-reviews-batch-list"
          >
            {selectedIds.slice(0, BATCH_VISIBLE_LIMIT).map((poolId) => {
              const pool = pools.find((candidate) => candidate.id === poolId);
              return (
                <div
                  key={poolId}
                  className="flex items-baseline justify-between gap-3"
                  data-testid={`matching-reviews-batch-row-${poolId}`}
                >
                  <span className="min-w-0 flex-1 truncate" title={pool?.title ?? poolId}>
                    {pool?.title ?? `场次 ${poolId.slice(0, 8)}`}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {pool ? `${pool.groupCount} 个小组` : "小组数未知"}
                  </span>
                </div>
              );
            })}
            {selectedIds.length > BATCH_VISIBLE_LIMIT && (
              <div
                className="pt-1 text-xs text-muted-foreground"
                data-testid="matching-reviews-batch-overflow"
              >
                等 {selectedIds.length} 个
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="matching-reviews-batch-cancel">取消</AlertDialogCancel>
            <AlertDialogAction
              // The server rejects more than 20 ids; slice as a second guard so
              // a future selection path can never send an oversized batch.
              onClick={() => batchApproveMutation.mutate(selectedIds.slice(0, BATCH_LIMIT))}
              disabled={batchApproveMutation.isPending}
              data-testid="matching-reviews-batch-confirm"
            >
              确认通过
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(approvePoolId)}
        onOpenChange={(open) => !open && setApprovePoolId(null)}
      >
        <AlertDialogContent data-testid="matching-review-approve-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>通过匹配结果</AlertDialogTitle>
            <AlertDialogDescription>
              确认通过该匹配结果？用户将收到排桌通知。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="matching-review-approve-cancel">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmApprove}
              disabled={approveMutation.isPending}
              data-testid="matching-review-approve-confirm"
            >
              {approveMutation.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              确认通过
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
