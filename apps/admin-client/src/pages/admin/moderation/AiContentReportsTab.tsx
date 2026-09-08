import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bot, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { fmtDateTime } from "@/lib/dateUtils";
import { useToast } from "@/hooks/ui/use-toast";
import EmptyState from "@/components/admin/EmptyState";
import AdminQueryError from "@/components/admin/AdminQueryError";

interface AiContentReport {
  id: string;
  reporterId: string;
  reportedUserId: string | null;
  category: string;
  description: string;
  relatedEventId: string | null;
  status: string;
  createdAt: string;
  reporterDisplayName: string | null;
  reporterWechatNickname: string | null;
}

interface AiContentReportListResponse {
  reports: AiContentReport[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待处理", variant: "default" },
  reviewing: { label: "处理中", variant: "secondary" },
  resolved: { label: "已处理", variant: "secondary" },
  dismissed: { label: "已驳回", variant: "outline" },
};

const CATEGORY_LABELS: Record<string, string> = {
  ai_content: "AI 生成内容",
};

const truncate = (text: string, max = 60) =>
  text.length > max ? `${text.slice(0, max)}…` : text;

export default function AiContentReportsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pendingAction, setPendingAction] = useState<{
    report: AiContentReport;
    action: "resolved" | "dismissed";
  } | null>(null);
  const [actionNote, setActionNote] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery<AiContentReportListResponse>({
    queryKey: ["/api/admin/reports/ai-content", statusFilter, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await apiRequest("GET", `/api/admin/reports/ai-content?${params.toString()}`);
      return res.json();
    },
    retry: 2,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      note,
    }: {
      id: string;
      action: "resolved" | "dismissed";
      note?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/admin/reports/ai-content/${id}`, {
        action,
        note: note?.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      toast({
        title: variables.action === "resolved" ? "已标记为已处理" : "已驳回该举报",
      });
      setPendingAction(null);
      setActionNote("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reports/ai-content"] });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "操作失败",
        description: mutationError.message.replace(/^\d{3}:\s*/, ""),
        variant: "destructive",
      });
    },
  });

  const reports = data?.reports ?? [];
  const pagination = data?.pagination;

  if (isError) {
    return (
      <AdminQueryError
        title="AI 内容举报加载失败"
        error={error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          用户针对 AI 生成内容提交的举报。处理结果会通知相关审核流程。
        </p>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36" data-testid="select-ai-status-filter">
            <SelectValue placeholder="状态筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="option-ai-status-all">全部</SelectItem>
            <SelectItem value="pending" data-testid="option-ai-status-pending">待处理</SelectItem>
            <SelectItem value="reviewing" data-testid="option-ai-status-reviewing">处理中</SelectItem>
            <SelectItem value="resolved" data-testid="option-ai-status-resolved">已处理</SelectItem>
            <SelectItem value="dismissed" data-testid="option-ai-status-dismissed">已驳回</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI 内容举报列表</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              title="暂无 AI 内容举报"
              icon={<Bot className="h-8 w-8 text-muted-foreground/50 mb-3" />}
            />
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>举报人</TableHead>
                      <TableHead>被举报对象</TableHead>
                      <TableHead>内容摘要</TableHead>
                      <TableHead>举报原因</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>举报时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id} data-testid={`row-ai-report-${report.id}`}>
                        <TableCell className="text-sm">
                          {report.reporterDisplayName || report.reporterWechatNickname || "未知用户"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {report.reportedUserId ? report.reportedUserId.slice(0, 8) + "…" : "AI 内容"}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs">
                          <span className="line-clamp-2">{truncate(report.description)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {CATEGORY_LABELS[report.category] || report.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_LABELS[report.status]?.variant || "default"} className="text-xs">
                            {STATUS_LABELS[report.status]?.label || report.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {fmtDateTime(report.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(report.status === "pending" || report.status === "reviewing") && (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPendingAction({ report, action: "resolved" })}
                                data-testid={`button-ai-resolve-${report.id}`}
                              >
                                标记已处理
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPendingAction({ report, action: "dismissed" })}
                                data-testid={`button-ai-dismiss-${report.id}`}
                              >
                                驳回
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground" data-testid="text-ai-pagination">
                    第 {pagination.page} / {pagination.totalPages} 页，共 {pagination.total} 条
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      data-testid="button-ai-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      上一页
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= pagination.totalPages}
                      data-testid="button-ai-next-page"
                    >
                      下一页
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
            setActionNote("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === "resolved" ? "确认标记为已处理？" : "确认驳回该举报？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === "resolved"
                ? "表示该 AI 内容举报已核查并处理完毕。"
                : "表示该举报经核查不成立，将被驳回。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="处理备注（可选，将记录到审核日志）"
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            className="min-h-20"
            data-testid="input-ai-review-note"
          />
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-ai-review-cancel">取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={reviewMutation.isPending}
              onClick={() => {
                if (!pendingAction) return;
                reviewMutation.mutate({
                  id: pendingAction.report.id,
                  action: pendingAction.action,
                  note: actionNote,
                });
              }}
              data-testid="button-ai-review-confirm"
            >
              {reviewMutation.isPending ? "提交中..." : "确认"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
