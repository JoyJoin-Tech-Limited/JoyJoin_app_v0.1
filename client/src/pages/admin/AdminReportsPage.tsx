import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertCircle, RefreshCw, Flag, UserX, MessageSquareWarning, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface ChatReport {
  id: string;
  messageId: string;
  eventId?: string;
  reportedBy: string;
  reportedUserId: string;
  reportType: string;
  description?: string;
  status: string;
  reviewedBy?: string;
  reviewNotes?: string;
  actionTaken?: string;
  createdAt: string;
  reviewedAt?: string;
  reporter?: { displayName?: string; firstName?: string };
  reportedUser?: { displayName?: string; firstName?: string };
  message?: { message: string };
}

const reportTypeLabels: Record<string, string> = {
  harassment: "骚扰或威胁",
  spam: "垃圾信息",
  inappropriate: "不当内容",
  hate_speech: "仇恨言论",
  other: "其他",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待处理", variant: "default" },
  reviewed: { label: "已处理", variant: "secondary" },
  dismissed: { label: "已驳回", variant: "outline" },
  action_taken: { label: "已处理", variant: "secondary" },
};

const actionLabels: Record<string, string> = {
  none: "无操作",
  warning: "警告用户",
  temporary_ban: "临时封禁",
  permanent_ban: "永久封禁",
  message_deleted: "删除消息",
};

export default function AdminReportsPage() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedReport, setSelectedReport] = useState<ChatReport | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionTaken, setActionTaken] = useState("none");

  const { data: reports = [], isLoading, isError, error, refetch } = useQuery<ChatReport[]>({
    queryKey: ["/api/admin/chat-reports", filterStatus === "all" ? undefined : { status: filterStatus }],
    retry: 2,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes, actionTaken }: {
      id: string;
      status: string;
      reviewNotes?: string;
      actionTaken?: string;
    }) => {
      return await apiRequest("PATCH", `/api/admin/chat-reports/${id}`, {
        status,
        reviewNotes,
        actionTaken,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat-reports"] });
      toast({
        title: "处理成功",
        description: "举报已处理",
      });
      setSelectedReport(null);
      setReviewNotes("");
      setActionTaken("none");
    },
    onError: (error: any) => {
      toast({
        title: "处理失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReview = (status: string) => {
    if (!selectedReport) return;
    
    reviewMutation.mutate({
      id: selectedReport.id,
      status,
      reviewNotes: reviewNotes || undefined,
      actionTaken: actionTaken !== "none" ? actionTaken : undefined,
    });
  };

  const filteredReports = reports.filter(report => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pending") return report.status === "pending";
    if (filterStatus === "reviewed") return report.status === "reviewed" || report.status === "action_taken";
    if (filterStatus === "dismissed") return report.status === "dismissed";
    return true;
  });

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <div>
                <h3 className="text-lg font-semibold">加载失败</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {error instanceof Error && error.message.includes("401") 
                    ? "您没有访问权限"
                    : "无法加载举报数据，请稍后重试"}
                </p>
              </div>
              <Button 
                onClick={() => refetch()} 
                variant="default"
                data-testid="button-retry-reports"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">举报管理</h1>
          <p className="text-muted-foreground mt-1">查看和处理用户举报</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh-reports"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      <Tabs value={filterStatus} onValueChange={setFilterStatus}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-reports-all">
            全部 ({reports.length})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-reports-pending">
            待处理 ({reports.filter(r => r.status === "pending").length})
          </TabsTrigger>
          <TabsTrigger value="reviewed" data-testid="tab-reports-reviewed">
            已处理 ({reports.filter(r => r.status === "reviewed" || r.status === "action_taken").length})
          </TabsTrigger>
          <TabsTrigger value="dismissed" data-testid="tab-reports-dismissed">
            已驳回 ({reports.filter(r => r.status === "dismissed").length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>举报列表</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Flag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无举报</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">举报时间</th>
                    <th className="text-left p-3 font-medium">举报人</th>
                    <th className="text-left p-3 font-medium">被举报人</th>
                    <th className="text-left p-3 font-medium">消息内容</th>
                    <th className="text-left p-3 font-medium">举报类型</th>
                    <th className="text-left p-3 font-medium">状态</th>
                    <th className="text-left p-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => (
                    <tr
                      key={report.id}
                      className="border-b hover-elevate transition-colors cursor-pointer"
                      onClick={() => setSelectedReport(report)}
                      data-testid={`row-report-${report.id}`}
                    >
                      <td className="p-3 text-sm">
                        {format(new Date(report.createdAt), "yyyy-MM-dd HH:mm")}
                      </td>
                      <td className="p-3 text-sm">
                        {report.reporter?.displayName || report.reporter?.firstName || "未知用户"}
                      </td>
                      <td className="p-3 text-sm">
                        {report.reportedUser?.displayName || report.reportedUser?.firstName || "未知用户"}
                      </td>
                      <td className="p-3 text-sm max-w-xs truncate">
                        {report.message?.message || "消息已删除"}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {reportTypeLabels[report.reportType] || report.reportType}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={statusLabels[report.status]?.variant || "default"} className="text-xs">
                          {statusLabels[report.status]?.label || report.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReport(report);
                          }}
                          data-testid={`button-view-report-${report.id}`}
                        >
                          查看详情
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Details Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>举报详情</DialogTitle>
            <DialogDescription>
              查看举报详情并采取相应措施
            </DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-4">
              {/* Report info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">举报时间</Label>
                  <p className="text-sm mt-1">
                    {format(new Date(selectedReport.createdAt), "yyyy-MM-dd HH:mm:ss")}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">举报类型</Label>
                  <p className="text-sm mt-1">
                    {reportTypeLabels[selectedReport.reportType] || selectedReport.reportType}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">举报人</Label>
                  <p className="text-sm mt-1">
                    {selectedReport.reporter?.displayName || selectedReport.reporter?.firstName || "未知用户"}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">被举报人</Label>
                  <p className="text-sm mt-1">
                    {selectedReport.reportedUser?.displayName || selectedReport.reportedUser?.firstName || "未知用户"}
                  </p>
                </div>
              </div>

              {/* Message content */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">被举报消息</Label>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm">{selectedReport.message?.message || "消息已删除"}</p>
                </div>
              </div>

              {/* Report description */}
              {selectedReport.description && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">举报说明</Label>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm">{selectedReport.description}</p>
                  </div>
                </div>
              )}

              {/* Review section (only if pending) */}
              {selectedReport.status === "pending" && (
                <>
                  <div className="border-t pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>采取措施</Label>
                      <RadioGroup value={actionTaken} onValueChange={setActionTaken}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="none" id="action-none" data-testid="radio-action-none" />
                          <Label htmlFor="action-none" className="cursor-pointer">无需操作</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="warning" id="action-warning" data-testid="radio-action-warning" />
                          <Label htmlFor="action-warning" className="cursor-pointer">警告用户</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="message_deleted" id="action-delete" data-testid="radio-action-delete" />
                          <Label htmlFor="action-delete" className="cursor-pointer">删除消息</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="temporary_ban" id="action-temp-ban" data-testid="radio-action-temp-ban" />
                          <Label htmlFor="action-temp-ban" className="cursor-pointer">临时封禁</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="permanent_ban" id="action-perm-ban" data-testid="radio-action-perm-ban" />
                          <Label htmlFor="action-perm-ban" className="cursor-pointer">永久封禁</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="review-notes">管理员备注</Label>
                      <Textarea
                        id="review-notes"
                        placeholder="记录处理详情..."
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        data-testid="textarea-review-notes"
                        rows={3}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => handleReview("dismissed")}
                      disabled={reviewMutation.isPending}
                      data-testid="button-dismiss-report"
                    >
                      驳回举报
                    </Button>
                    <Button
                      onClick={() => handleReview(actionTaken === "none" ? "reviewed" : "action_taken")}
                      disabled={reviewMutation.isPending}
                      data-testid="button-process-report"
                    >
                      {reviewMutation.isPending ? "处理中..." : "确认处理"}
                    </Button>
                  </DialogFooter>
                </>
              )}

              {/* Already reviewed */}
              {selectedReport.status !== "pending" && (
                <div className="border-t pt-4 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">处理状态</Label>
                      <p className="text-sm mt-1">
                        {statusLabels[selectedReport.status]?.label || selectedReport.status}
                      </p>
                    </div>
                    {selectedReport.actionTaken && (
                      <div>
                        <Label className="text-xs text-muted-foreground">采取措施</Label>
                        <p className="text-sm mt-1">
                          {actionLabels[selectedReport.actionTaken] || selectedReport.actionTaken}
                        </p>
                      </div>
                    )}
                    {selectedReport.reviewedAt && (
                      <div>
                        <Label className="text-xs text-muted-foreground">处理时间</Label>
                        <p className="text-sm mt-1">
                          {format(new Date(selectedReport.reviewedAt), "yyyy-MM-dd HH:mm:ss")}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {selectedReport.reviewNotes && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">管理员备注</Label>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-sm">{selectedReport.reviewNotes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
