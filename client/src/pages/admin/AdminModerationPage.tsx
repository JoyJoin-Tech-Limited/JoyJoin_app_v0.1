import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Shield, 
  UserX, 
  AlertOctagon,
  FileText,
  Ban,
  Eye
} from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ModerationStats {
  totalReports: number;
  pendingReports: number;
  resolvedReports: number;
  bannedUsers: number;
}

interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  report_type: "harassment" | "inappropriate_content" | "spam" | "other";
  description: string;
  evidence: string | null;
  status: "pending" | "resolved" | "dismissed";
  admin_notes: string | null;
  created_at: string;
  reporter_first_name: string | null;
  reporter_last_name: string | null;
  reporter_email: string | null;
  reported_first_name: string | null;
  reported_last_name: string | null;
  reported_email: string | null;
}

interface ModerationLog {
  id: string;
  admin_id: string;
  action: "ban" | "warn" | "unban";
  target_user_id: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  admin_first_name: string | null;
  admin_last_name: string | null;
  target_first_name: string | null;
  target_last_name: string | null;
  target_email: string | null;
}

const REPORT_TYPE_MAP: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
  harassment: { label: "骚扰", variant: "destructive" },
  inappropriate_content: { label: "不当内容", variant: "secondary" },
  spam: { label: "垃圾信息", variant: "outline" },
  other: { label: "其他", variant: "default" },
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: any }> = {
  pending: { label: "待处理", variant: "secondary", icon: AlertTriangle },
  resolved: { label: "已解决", variant: "default", icon: CheckCircle2 },
  dismissed: { label: "已驳回", variant: "destructive", icon: XCircle },
};

const ACTION_MAP: Record<string, { label: string; variant: "default" | "destructive" | "secondary"; icon: any }> = {
  ban: { label: "封禁", variant: "destructive", icon: Ban },
  warn: { label: "警告", variant: "secondary", icon: AlertOctagon },
  unban: { label: "解封", variant: "default", icon: CheckCircle2 },
};

export default function AdminModerationPage() {
  const [mainTab, setMainTab] = useState<"reports" | "logs">("reports");
  const [reportFilter, setReportFilter] = useState<"all" | "pending">("all");
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [editStatus, setEditStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<ModerationStats>({
    queryKey: ["/api/admin/moderation/stats"],
  });

  const { data: reports = [], isLoading: reportsLoading } = useQuery<Report[]>({
    queryKey: ["/api/admin/moderation/reports", reportFilter === "all" ? undefined : reportFilter],
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<ModerationLog[]>({
    queryKey: ["/api/admin/moderation/logs"],
  });

  const updateReportMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; admin_notes?: string } }) =>
      fetch(`/api/admin/moderation/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/reports"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/stats"] });
      toast({
        title: "更新成功",
        description: "举报记录已更新",
      });
    },
    onError: () => {
      toast({
        title: "更新失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const createLogMutation = useMutation({
    mutationFn: (data: { action: string; target_user_id: string; reason?: string; notes?: string }) =>
      fetch("/api/admin/moderation/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/logs"] });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/admin/users/${userId}/ban`, {
        method: "PATCH",
        credentials: "include",
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/moderation/stats"] });
      toast({
        title: "封禁成功",
        description: "用户已被封禁",
      });
    },
    onError: () => {
      toast({
        title: "封禁失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    },
  });

  const handleOpenReport = (report: Report) => {
    setSelectedReport(report);
    setEditStatus(report.status);
    setAdminNotes(report.admin_notes || "");
  };

  const handleCloseDialog = () => {
    setSelectedReport(null);
    setEditStatus("");
    setAdminNotes("");
  };

  const handleSaveChanges = async () => {
    if (!selectedReport) return;

    await updateReportMutation.mutateAsync({
      id: selectedReport.id,
      data: {
        status: editStatus,
        admin_notes: adminNotes,
      },
    });

    handleCloseDialog();
  };

  const handleBanUser = async () => {
    if (!selectedReport) return;

    await banUserMutation.mutateAsync(selectedReport.reported_user_id);
    await createLogMutation.mutateAsync({
      action: "ban",
      target_user_id: selectedReport.reported_user_id,
      reason: `举报: ${REPORT_TYPE_MAP[selectedReport.report_type]?.label}`,
      notes: selectedReport.description,
    });

    handleCloseDialog();
  };

  const handleWarnUser = async () => {
    if (!selectedReport) return;

    await createLogMutation.mutateAsync({
      action: "warn",
      target_user_id: selectedReport.reported_user_id,
      reason: `举报: ${REPORT_TYPE_MAP[selectedReport.report_type]?.label}`,
      notes: selectedReport.description,
    });

    toast({
      title: "警告已记录",
      description: "已对用户发出警告",
    });
  };

  const handleDismiss = async () => {
    if (!selectedReport) return;

    await updateReportMutation.mutateAsync({
      id: selectedReport.id,
      data: {
        status: "dismissed",
        admin_notes: adminNotes,
      },
    });

    handleCloseDialog();
  };

  const formatDateTime = (dateTimeStr: string) => {
    try {
      const date = new Date(dateTimeStr);
      return format(date, "yyyy年MM月dd日 HH:mm", { locale: zhCN });
    } catch (e) {
      return dateTimeStr;
    }
  };

  const getUserName = (firstName: string | null, lastName: string | null) => {
    const first = firstName || "";
    const last = lastName || "";
    const fullName = `${first} ${last}`.trim();
    return fullName || "未知用户";
  };

  if (statsLoading) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} data-testid={`skeleton-metric-${i}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">加载中...</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-metric-total-reports">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总举报数</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-reports">
              {stats?.totalReports || 0}
            </div>
            <p className="text-xs text-muted-foreground">所有举报记录</p>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-pending-reports">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">待处理</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600" data-testid="text-pending-reports">
              {stats?.pendingReports || 0}
            </div>
            <p className="text-xs text-muted-foreground">需要审核处理</p>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-resolved-reports">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已解决</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-resolved-reports">
              {stats?.resolvedReports || 0}
            </div>
            <p className="text-xs text-muted-foreground">已处理完成</p>
          </CardContent>
        </Card>

        <Card data-testid="card-metric-banned-users">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">封禁用户数</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-banned-users">
              {stats?.bannedUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">被封禁的用户</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Card data-testid="card-moderation-content">
        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
          <CardHeader>
            <TabsList data-testid="tabs-main">
              <TabsTrigger value="reports" data-testid="tab-reports">
                举报记录
              </TabsTrigger>
              <TabsTrigger value="logs" data-testid="tab-logs">
                操作日志
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            {/* Reports Tab */}
            <TabsContent value="reports" className="space-y-4">
              <Tabs value={reportFilter} onValueChange={(v) => setReportFilter(v as any)}>
                <TabsList data-testid="tabs-report-filter">
                  <TabsTrigger value="all" data-testid="filter-all">
                    全部
                  </TabsTrigger>
                  <TabsTrigger value="pending" data-testid="filter-pending">
                    待处理
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {reportsLoading ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-loading-reports">
                  加载中...
                </div>
              ) : reports.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-no-reports">
                  暂无举报记录
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => {
                    const StatusIcon = STATUS_MAP[report.status]?.icon || AlertTriangle;
                    return (
                      <Card 
                        key={report.id} 
                        className="hover-elevate cursor-pointer"
                        onClick={() => handleOpenReport(report)}
                        data-testid={`card-report-${report.id}`}
                      >
                        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <CardTitle className="text-sm font-mono" data-testid={`text-report-id-${report.id}`}>
                                {report.id.slice(0, 8)}...
                              </CardTitle>
                              <Badge 
                                variant={REPORT_TYPE_MAP[report.report_type]?.variant || "default"}
                                data-testid={`badge-report-type-${report.id}`}
                              >
                                {REPORT_TYPE_MAP[report.report_type]?.label || report.report_type}
                              </Badge>
                            </div>
                          </div>
                          <Badge 
                            variant={STATUS_MAP[report.status]?.variant || "secondary"}
                            data-testid={`badge-status-${report.id}`}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {STATUS_MAP[report.status]?.label || report.status}
                          </Badge>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground mb-1">举报人</p>
                              <p className="font-medium" data-testid={`text-reporter-name-${report.id}`}>
                                {getUserName(report.reporter_first_name, report.reporter_last_name)}
                              </p>
                              {report.reporter_email && (
                                <p className="text-xs text-muted-foreground" data-testid={`text-reporter-email-${report.id}`}>
                                  {report.reporter_email}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">被举报人</p>
                              <p className="font-medium" data-testid={`text-reported-name-${report.id}`}>
                                {getUserName(report.reported_first_name, report.reported_last_name)}
                              </p>
                              {report.reported_email && (
                                <p className="text-xs text-muted-foreground" data-testid={`text-reported-email-${report.id}`}>
                                  {report.reported_email}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <p className="text-muted-foreground text-sm mb-1">举报描述</p>
                            <p className="text-sm" data-testid={`text-description-${report.id}`}>
                              {report.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="text-xs text-muted-foreground" data-testid={`text-created-at-${report.id}`}>
                              {formatDateTime(report.created_at)}
                            </span>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenReport(report);
                              }}
                              data-testid={`button-review-${report.id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              审核
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Moderation Logs Tab */}
            <TabsContent value="logs" className="space-y-4">
              {logsLoading ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-loading-logs">
                  加载中...
                </div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground" data-testid="text-no-logs">
                  暂无操作日志
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-action">操作类型</TableHead>
                        <TableHead data-testid="header-admin">管理员</TableHead>
                        <TableHead data-testid="header-target-user">目标用户</TableHead>
                        <TableHead data-testid="header-reason">原因</TableHead>
                        <TableHead data-testid="header-notes">备注</TableHead>
                        <TableHead data-testid="header-timestamp">时间</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const ActionIcon = ACTION_MAP[log.action]?.icon || FileText;
                        return (
                          <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                            <TableCell>
                              <Badge 
                                variant={ACTION_MAP[log.action]?.variant || "default"}
                                data-testid={`badge-action-${log.id}`}
                              >
                                <ActionIcon className="h-3 w-3 mr-1" />
                                {ACTION_MAP[log.action]?.label || log.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium" data-testid={`text-admin-name-${log.id}`}>
                                {getUserName(log.admin_first_name, log.admin_last_name)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium" data-testid={`text-target-name-${log.id}`}>
                                  {getUserName(log.target_first_name, log.target_last_name)}
                                </div>
                                {log.target_email && (
                                  <div className="text-xs text-muted-foreground" data-testid={`text-target-email-${log.id}`}>
                                    {log.target_email}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm" data-testid={`text-reason-${log.id}`}>
                                {log.reason || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground" data-testid={`text-notes-${log.id}`}>
                                {log.notes || "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm" data-testid={`text-timestamp-${log.id}`}>
                              {formatDateTime(log.created_at)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Review Report Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-review-report">
          <DialogHeader>
            <DialogTitle>审核举报</DialogTitle>
            <DialogDescription>查看举报详情并采取相应措施</DialogDescription>
          </DialogHeader>

          {selectedReport && (
            <div className="space-y-6">
              {/* Report Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">举报信息</h3>
                  <Badge 
                    variant={REPORT_TYPE_MAP[selectedReport.report_type]?.variant || "default"}
                    data-testid="dialog-report-type"
                  >
                    {REPORT_TYPE_MAP[selectedReport.report_type]?.label || selectedReport.report_type}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">举报人</p>
                    <p className="font-medium" data-testid="dialog-reporter-name">
                      {getUserName(selectedReport.reporter_first_name, selectedReport.reporter_last_name)}
                    </p>
                    {selectedReport.reporter_email && (
                      <p className="text-xs text-muted-foreground" data-testid="dialog-reporter-email">
                        {selectedReport.reporter_email}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">被举报人</p>
                    <p className="font-medium" data-testid="dialog-reported-name">
                      {getUserName(selectedReport.reported_first_name, selectedReport.reported_last_name)}
                    </p>
                    {selectedReport.reported_email && (
                      <p className="text-xs text-muted-foreground" data-testid="dialog-reported-email">
                        {selectedReport.reported_email}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-muted-foreground text-sm mb-1">举报描述</p>
                  <p className="text-sm" data-testid="dialog-description">
                    {selectedReport.description}
                  </p>
                </div>

                {selectedReport.evidence && (
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">证据</p>
                    <p className="text-sm" data-testid="dialog-evidence">
                      {selectedReport.evidence}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-muted-foreground text-sm mb-1">创建时间</p>
                  <p className="text-sm" data-testid="dialog-created-at">
                    {formatDateTime(selectedReport.created_at)}
                  </p>
                </div>
              </div>

              {/* Admin Actions */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">管理操作</h3>

                <div className="space-y-2">
                  <label className="text-sm font-medium">状态</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending" data-testid="option-pending">待处理</SelectItem>
                      <SelectItem value="resolved" data-testid="option-resolved">已解决</SelectItem>
                      <SelectItem value="dismissed" data-testid="option-dismissed">已驳回</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">管理员备注</label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="添加处理备注..."
                    rows={4}
                    data-testid="textarea-admin-notes"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">快速操作</label>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBanUser}
                      disabled={banUserMutation.isPending}
                      data-testid="button-ban-user"
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      封禁用户
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleWarnUser}
                      disabled={createLogMutation.isPending}
                      data-testid="button-warn-user"
                    >
                      <AlertOctagon className="h-4 w-4 mr-2" />
                      警告用户
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDismiss}
                      disabled={updateReportMutation.isPending}
                      data-testid="button-dismiss"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      驳回举报
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={handleCloseDialog}
              data-testid="button-close-dialog"
            >
              取消
            </Button>
            <Button 
              onClick={handleSaveChanges}
              disabled={updateReportMutation.isPending}
              data-testid="button-save-changes"
            >
              保存修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
