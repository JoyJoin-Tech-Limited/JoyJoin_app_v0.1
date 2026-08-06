import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Eye, Flag, RefreshCw, XCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/ui/use-toast";
import { fmtDateTimeShort } from "@/lib/dateUtils";
import EmptyState from "@/components/admin/EmptyState";
import type {
  AdminContentFilterLogRow,
  AdminContentFilterLogReviewResponse,
  ContentFilterLogReviewBody,
  ContentFilterReviewStatus,
} from "@joyjoin/shared/api/adminContentFilter";

/* ──────────────────── types (shared DTO contract) ──────────────────── */

type ContentFilterLog = AdminContentFilterLogRow;

interface ContentFilterLogsResponse {
  rows: ContentFilterLog[];
  total: number;
  page: number;
  pageSize: number;
}

/* ─────────────────────────── constants / maps ─────────────────────────── */

const PAGE_SIZE = 20;
const NOTE_MAX_LENGTH = 500;
const MAX_KEYWORD_CHIPS = 3;

const REVIEW_STATUS_MAP: Record<
  ContentFilterReviewStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "待处理", variant: "secondary" },
  reviewed: { label: "已处理", variant: "default" },
  dismissed: { label: "已驳回", variant: "outline" },
  actioned: { label: "已处置", variant: "destructive" },
};

const VIOLATION_TYPE_OPTIONS = [
  { value: "political", label: "政治敏感" },
  { value: "pornographic", label: "色情低俗" },
  { value: "violent", label: "暴力血腥" },
  { value: "illegal", label: "违法信息" },
  { value: "harassment", label: "骚扰辱骂" },
  { value: "spam", label: "垃圾广告" },
];

const VIOLATION_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  VIOLATION_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

function severityBadge(severity: string) {
  if (severity === "severe") {
    return { label: "严重", variant: "destructive" as const, className: "" };
  }
  return {
    label: "警告",
    variant: "outline" as const,
    className:
      "bg-amber-100 text-amber-800 border-amber-300/70 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30",
  };
}

function resolveSourceMeta(source: string | null): { label: string; variant: "default" | "secondary" | "outline" } {
  if (source === "tier0") {
    return { label: "基础规则", variant: "secondary" };
  }
  if (source === "tier1" || source?.startsWith("tier1:")) {
    return { label: "AI 模型", variant: "outline" };
  }
  // Legacy rows may carry null / unknown source values — render a visible 未知
  // badge instead of an empty one.
  return { label: "未知", variant: "outline" };
}

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max)}…` : str;
}

/* ─────────────────────────── page ─────────────────────────── */

export default function AdminContentFilterLogsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [userIdFilter, setUserIdFilter] = useState("");
  const [fieldFilter, setFieldFilter] = useState("");
  const [violationTypeFilter, setViolationTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("all");
  const [missFlagFilter, setMissFlagFilter] = useState("all");
  const [fromFilter, setFromFilter] = useState("");
  const [toFilter, setToFilter] = useState("");
  const [selectedLog, setSelectedLog] = useState<ContentFilterLog | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const { data, isLoading, error, refetch } = useQuery<ContentFilterLogsResponse>({
    queryKey: [
      "/api/admin/content-filter/logs",
      {
        page,
        pageSize: PAGE_SIZE,
        userId: userIdFilter.trim() || undefined,
        field: fieldFilter.trim() || undefined,
        violationType: violationTypeFilter !== "all" ? violationTypeFilter : undefined,
        severity: severityFilter !== "all" ? severityFilter : undefined,
        reviewStatus: reviewStatusFilter !== "all" ? reviewStatusFilter : undefined,
        missFlag: missFlagFilter === "all" ? undefined : missFlagFilter === "yes",
        from: fromFilter || undefined,
        to: toFilter || undefined,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("page", String(page));
      params.append("pageSize", String(PAGE_SIZE));
      if (userIdFilter.trim()) params.append("userId", userIdFilter.trim());
      if (fieldFilter.trim()) params.append("field", fieldFilter.trim());
      if (violationTypeFilter !== "all") params.append("violationType", violationTypeFilter);
      if (severityFilter !== "all") params.append("severity", severityFilter);
      if (reviewStatusFilter !== "all") params.append("reviewStatus", reviewStatusFilter);
      if (missFlagFilter === "yes") params.append("missFlag", "true");
      if (missFlagFilter === "no") params.append("missFlag", "false");
      if (fromFilter) params.append("from", fromFilter);
      if (toFilter) params.append("to", toFilter);
      const res = await apiRequest("GET", `/api/admin/content-filter/logs?${params.toString()}`);
      return await res.json();
    },
  });

  const updateLogMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ContentFilterLogReviewBody }) =>
      apiRequest("PATCH", `/api/admin/content-filter/logs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content-filter/logs"] });
      toast({ title: "更新成功", description: "审核记录已更新" });
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "请稍后重试";
      toast({ title: "更新失败", description: message, variant: "destructive" });
    },
  });

  const rows = data?.rows ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE))) : 1;
  const errorMessage = error instanceof Error ? error.message : "";

  // If the dataset shrank (filters, other admins acting on rows) and the current
  // page is now out of range, clamp back to the last valid page instead of
  // showing a misleading "暂无内容审核记录" empty state.
  useEffect(() => {
    if (data && page > totalPages) {
      setPage(totalPages);
    }
  }, [data, page, totalPages]);

  const resetToFirstPage = () => setPage(1);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const handleOpenDetail = (log: ContentFilterLog) => {
    setSelectedLog(log);
    setNoteDraft(log.reviewNote || "");
  };

  const handleCloseDetail = () => {
    setSelectedLog(null);
    setNoteDraft("");
  };

  const handleSetReviewStatus = (log: ContentFilterLog, status: ContentFilterReviewStatus) => {
    updateLogMutation.mutate({ id: log.id, data: { reviewStatus: status } });
  };

  const handleToggleMissFlag = (log: ContentFilterLog) => {
    updateLogMutation.mutate({ id: log.id, data: { missFlag: !log.missFlag } });
  };

  const handleSaveNote = async () => {
    if (!selectedLog) return;
    const note = noteDraft.trim();
    if (note === "") {
      // The server Zod refine rejects an all-empty PATCH (at least one field
      // required) and never clears notes — it only replaces them when non-empty.
      // Surface that contract up front instead of a 400 → destructive toast.
      toast({
        title: "备注已清空，未保存",
        description: "服务端不支持清空备注，如需修改请直接输入新内容",
      });
      return;
    }
    try {
      await updateLogMutation.mutateAsync({ id: selectedLog.id, data: { note } });
      setSelectedLog((prev) => (prev ? { ...prev, reviewNote: note } : prev));
    } catch {
      // error toast handled by mutation onError
    }
  };

  const handleDialogSetReviewStatus = async (status: ContentFilterReviewStatus) => {
    if (!selectedLog) return;
    try {
      const res = await updateLogMutation.mutateAsync({ id: selectedLog.id, data: { reviewStatus: status } });
      // The PATCH returns { changed, row } with the fresh row incl. reviewer
      // identity — merge it so the dialog's 审核人 doesn't stay stale until reopen.
      let freshRow: AdminContentFilterLogRow | null = null;
      try {
        const body = (await res.json()) as AdminContentFilterLogReviewResponse;
        freshRow = body?.row ?? null;
      } catch {
        // response body is best-effort; the local snapshot below still applies
      }
      setSelectedLog((prev) =>
        prev
          ? {
              ...prev,
              reviewStatus: status,
              reviewedByDisplayName: freshRow?.reviewedByDisplayName ?? prev.reviewedByDisplayName,
              reviewedAt: freshRow?.reviewedAt ?? prev.reviewedAt,
            }
          : prev
      );
    } catch {
      // error toast handled by mutation onError
    }
  };

  const handleDialogToggleMissFlag = async () => {
    if (!selectedLog) return;
    try {
      await updateLogMutation.mutateAsync({ id: selectedLog.id, data: { missFlag: !selectedLog.missFlag } });
      setSelectedLog((prev) => (prev ? { ...prev, missFlag: !prev.missFlag } : prev));
    } catch {
      // error toast handled by mutation onError
    }
  };

  // Derived badge metadata for the open detail dialog — reuses the same helpers
  // as the table rows so the two surfaces can't drift apart.
  const dialogSeverityMeta = selectedLog ? severityBadge(selectedLog.severity) : null;
  const dialogSourceMeta = selectedLog ? resolveSourceMeta(selectedLog.source) : null;

  const renderPaginationItems = () => {
    const items: React.ReactNode[] = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      items.push(
        <PaginationItem key="first">
          <PaginationLink onClick={() => handlePageChange(1)}>1</PaginationLink>
        </PaginationItem>
      );
      if (startPage > 2) {
        items.push(
          <PaginationItem key="ellipsis-start">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink isActive={i === page} onClick={() => handlePageChange(i)}>
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(
          <PaginationItem key="ellipsis-end">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }
      items.push(
        <PaginationItem key="last">
          <PaginationLink onClick={() => handlePageChange(totalPages)}>{totalPages}</PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  const renderKeywordChips = (log: ContentFilterLog) => {
    const keywords = log.matchedKeywords || [];
    if (keywords.length === 0) return <span className="text-muted-foreground">—</span>;

    const visible = keywords.slice(0, MAX_KEYWORD_CHIPS);
    const overflowCount = keywords.length - visible.length;

    const chips = (
      <div className="flex max-w-[220px] flex-wrap items-center gap-1">
        {visible.map((kw) => (
          <Badge
            key={kw}
            variant="outline"
            className="px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
          >
            {truncate(kw, 12)}
          </Badge>
        ))}
        {overflowCount > 0 && (
          <span className="text-[10px] text-muted-foreground">+{overflowCount}</span>
        )}
      </div>
    );

    if (keywords.length > MAX_KEYWORD_CHIPS) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default">{chips}</span>
          </TooltipTrigger>
          <TooltipContent>{keywords.join("、")}</TooltipContent>
        </Tooltip>
      );
    }
    return chips;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">内容审核日志</h2>
          <p className="text-muted-foreground">
            查看内容过滤拦截记录，审核命中样本并标记误伤，帮助优化过滤规则
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-logs">
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">用户 ID</span>
            <Input
              placeholder="输入用户 ID"
              value={userIdFilter}
              onChange={(e) => { setUserIdFilter(e.target.value); resetToFirstPage(); }}
              className="w-[160px]"
              data-testid="input-user-id"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">违规类型</span>
            <Select value={violationTypeFilter} onValueChange={(v) => { setViolationTypeFilter(v); resetToFirstPage(); }}>
              <SelectTrigger className="w-[150px]" data-testid="select-violation-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {VIOLATION_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">严重程度</span>
            <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); resetToFirstPage(); }}>
              <SelectTrigger className="w-[130px]" data-testid="select-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="warning">警告</SelectItem>
                <SelectItem value="severe">严重</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">审核状态</span>
            <Select value={reviewStatusFilter} onValueChange={(v) => { setReviewStatusFilter(v); resetToFirstPage(); }}>
              <SelectTrigger className="w-[130px]" data-testid="select-review-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                {Object.entries(REVIEW_STATUS_MAP).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>{meta.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">误伤标记</span>
            <Select value={missFlagFilter} onValueChange={(v) => { setMissFlagFilter(v); resetToFirstPage(); }}>
              <SelectTrigger className="w-[130px]" data-testid="select-miss-flag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="yes">是</SelectItem>
                <SelectItem value="no">否</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">字段</span>
            <Input
              placeholder="字段名"
              value={fieldFilter}
              onChange={(e) => { setFieldFilter(e.target.value); resetToFirstPage(); }}
              className="w-[130px]"
              data-testid="input-field"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">开始日期</span>
            <Input
              type="date"
              value={fromFilter}
              onChange={(e) => { setFromFilter(e.target.value); resetToFirstPage(); }}
              className="w-[150px]"
              data-testid="input-from"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">结束日期</span>
            <Input
              type="date"
              value={toFilter}
              onChange={(e) => { setToFilter(e.target.value); resetToFirstPage(); }}
              className="w-[150px]"
              data-testid="input-to"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card data-testid="card-logs-table">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">时间</TableHead>
                  <TableHead className="w-[150px]">用户</TableHead>
                  <TableHead className="w-[100px]">字段</TableHead>
                  <TableHead className="w-[110px]">违规类型</TableHead>
                  <TableHead className="w-[90px]">严重程度</TableHead>
                  <TableHead className="w-[220px]">命中关键词</TableHead>
                  <TableHead className="w-[90px]">来源</TableHead>
                  <TableHead className="min-w-[200px]">输入内容</TableHead>
                  <TableHead className="w-[100px]">审核状态</TableHead>
                  <TableHead className="w-[80px]">误伤</TableHead>
                  <TableHead className="w-[260px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`} data-testid={`skeleton-row-${i}`}>
                      {Array.from({ length: 11 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : error ? (
                  errorMessage.includes("403") ? (
                    <TableRow>
                      <TableCell colSpan={11} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            无权限查看内容审核日志，请联系管理员开通运营权限
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={11} className="py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-sm text-destructive">加载失败，请重试</span>
                          <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-retry-logs">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            重试
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11}>
                      <EmptyState
                        title="暂无内容审核记录"
                        description="调整筛选条件后重试"
                        data-testid="empty-logs"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((log) => {
                    const statusMeta = REVIEW_STATUS_MAP[log.reviewStatus] || REVIEW_STATUS_MAP.pending;
                    const sevMeta = severityBadge(log.severity);
                    const sourceMeta = resolveSourceMeta(log.source);
                    const canMarkReviewed = log.reviewStatus !== "reviewed" && log.reviewStatus !== "actioned";
                    const canDismiss = log.reviewStatus !== "dismissed" && log.reviewStatus !== "actioned";
                    return (
                      <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {fmtDateTimeShort(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{log.displayName || "未知用户"}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {truncate(log.userId || "—", 12)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono">{log.field || "—"}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {VIOLATION_TYPE_LABELS[log.violationType] || log.violationType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sevMeta.variant} className={sevMeta.className || undefined}>
                            {sevMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{renderKeywordChips(log)}</TableCell>
                        <TableCell>
                          <Badge variant={sourceMeta.variant} className="text-xs">
                            {sourceMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span
                            className="block max-w-[240px] truncate text-sm text-muted-foreground"
                            title={log.inputPreview || undefined}
                            data-testid={`text-preview-${log.id}`}
                          >
                            {log.inputPreview || "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusMeta.variant} className="text-xs" data-testid={`badge-status-${log.id}`}>
                            {statusMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={log.missFlag ? "outline" : "secondary"}
                            className={log.missFlag
                              ? "bg-amber-100 text-amber-800 border-amber-300/70 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30"
                              : undefined}
                            data-testid={`badge-miss-${log.id}`}
                          >
                            {log.missFlag ? "误伤" : "正常"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {canMarkReviewed && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleSetReviewStatus(log, "reviewed")}
                                disabled={updateLogMutation.isPending}
                                data-testid={`button-mark-reviewed-${log.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                已处理
                              </Button>
                            )}
                            {canDismiss && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetReviewStatus(log, "dismissed")}
                                disabled={updateLogMutation.isPending}
                                data-testid={`button-dismiss-${log.id}`}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                驳回
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleToggleMissFlag(log)}
                              disabled={updateLogMutation.isPending}
                              data-testid={`button-miss-toggle-${log.id}`}
                              title={log.missFlag ? "取消误伤标记" : "标记为误伤样本"}
                            >
                              <Flag className={`h-3 w-3 mr-1 ${log.missFlag ? "text-amber-600" : ""}`} />
                              {log.missFlag ? "取消误伤" : "标记误伤"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDetail(log)}
                              data-testid={`button-view-${log.id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              详情
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          共 {data?.total ?? 0} 条记录
        </p>
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => handlePageChange(page - 1)}
                  className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {renderPaginationItems()}
              <PaginationItem>
                <PaginationNext
                  onClick={() => handlePageChange(page + 1)}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && handleCloseDetail()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-log-detail">
          <DialogHeader>
            <DialogTitle>审核详情</DialogTitle>
            <DialogDescription>查看内容过滤拦截记录详情，可更新审核状态与误伤标记</DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">用户</p>
                  <p className="font-medium">{selectedLog.displayName || "未知用户"}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selectedLog.userId || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">时间</p>
                  <p className="font-medium">{fmtDateTimeShort(selectedLog.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">字段</p>
                  <p className="font-mono">{selectedLog.field || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">违规类型</p>
                  <p>{VIOLATION_TYPE_LABELS[selectedLog.violationType] || selectedLog.violationType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">严重程度</p>
                  {dialogSeverityMeta && (
                    <Badge variant={dialogSeverityMeta.variant} className={dialogSeverityMeta.className || undefined}>
                      {dialogSeverityMeta.label}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">来源</p>
                  {dialogSourceMeta && (
                    <Badge variant={dialogSourceMeta.variant}>{dialogSourceMeta.label}</Badge>
                  )}
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-sm mb-2">命中关键词</p>
                {selectedLog.matchedKeywords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLog.matchedKeywords.map((kw) => (
                      <Badge key={kw} variant="outline" className="font-normal text-muted-foreground">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-muted-foreground text-sm mb-2">输入内容</p>
                <div className="rounded-md bg-muted p-3 text-sm break-all whitespace-pre-wrap" data-testid="dialog-input-preview">
                  {selectedLog.inputPreview || "—"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
                <div>
                  <p className="text-muted-foreground mb-1">审核状态</p>
                  <Badge variant={REVIEW_STATUS_MAP[selectedLog.reviewStatus]?.variant || "secondary"}>
                    {REVIEW_STATUS_MAP[selectedLog.reviewStatus]?.label || selectedLog.reviewStatus}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">误伤标记</p>
                  <Badge
                    variant={selectedLog.missFlag ? "outline" : "secondary"}
                    className={selectedLog.missFlag
                      ? "bg-amber-100 text-amber-800 border-amber-300/70 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30"
                      : undefined}
                  >
                    {selectedLog.missFlag ? "误伤" : "正常"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">审核人</p>
                  <p>{selectedLog.reviewedByDisplayName || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">审核备注</p>
                  <p className="text-muted-foreground">{selectedLog.reviewNote || "—"}</p>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">处理备注</label>
                  <span className="text-xs text-muted-foreground">{noteDraft.length}/{NOTE_MAX_LENGTH}</span>
                </div>
                <Textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
                  placeholder="添加处理备注（可选，最长 500 字）"
                  rows={4}
                  maxLength={NOTE_MAX_LENGTH}
                  data-testid="textarea-review-note"
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveNote}
                    disabled={updateLogMutation.isPending || noteDraft.trim() === (selectedLog.reviewNote || "")}
                    data-testid="button-save-note"
                  >
                    保存备注
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDialogSetReviewStatus("reviewed")}
                    disabled={updateLogMutation.isPending || selectedLog.reviewStatus === "reviewed"}
                    data-testid="dialog-button-mark-reviewed"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    标记已处理
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDialogSetReviewStatus("dismissed")}
                    disabled={updateLogMutation.isPending || selectedLog.reviewStatus === "dismissed"}
                    data-testid="dialog-button-dismiss"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    驳回
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDialogToggleMissFlag()}
                    disabled={updateLogMutation.isPending}
                    data-testid="dialog-button-miss-toggle"
                  >
                    <Flag className={`h-3 w-3 mr-1 ${selectedLog.missFlag ? "text-amber-600" : ""}`} />
                    {selectedLog.missFlag ? "取消误伤标记" : "标记误伤"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDetail} data-testid="button-close-dialog">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
