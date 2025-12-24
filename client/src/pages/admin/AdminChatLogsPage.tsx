import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, RefreshCw, FileText, AlertTriangle, Info, XCircle } from "lucide-react";
import { format } from "date-fns";

interface ChatLog {
  id: string;
  eventType: string;
  eventId?: string;
  threadId?: string;
  userId?: string;
  severity: string;
  message: string;
  metadata?: any;
  createdAt: string;
}

interface ChatLogStats {
  total: number;
  info: number;
  warning: number;
  error: number;
}

const severityConfig: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" }> = {
  info: { label: "信息", icon: Info, variant: "default" },
  warning: { label: "警告", icon: AlertTriangle, variant: "secondary" },
  error: { label: "错误", icon: XCircle, variant: "destructive" },
};

export default function AdminChatLogsPage() {
  const [eventIdFilter, setEventIdFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<ChatLog | null>(null);

  const buildQueryParams = () => {
    const params: any = {};
    if (eventIdFilter) params.eventId = eventIdFilter;
    if (userIdFilter) params.userId = userIdFilter;
    if (severityFilter && severityFilter !== "all") params.severity = severityFilter;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return params;
  };

  const { data: stats } = useQuery<ChatLogStats>({
    queryKey: ["/api/admin/chat-logs/stats"],
  });

  const { data: logs = [], isLoading, isError, error, refetch } = useQuery<ChatLog[]>({
    queryKey: ["/api/admin/chat-logs", buildQueryParams()],
    retry: 2,
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
                    : "无法加载日志数据，请稍后重试"}
                </p>
              </div>
              <Button 
                onClick={() => refetch()} 
                variant="default"
                data-testid="button-retry-logs"
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
          <h1 className="text-3xl font-bold">聊天日志</h1>
          <p className="text-muted-foreground mt-1">查看聊天系统日志和错误记录</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          data-testid="button-refresh-logs"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">总数</p>
                  <p className="text-2xl font-bold" data-testid="stat-total">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Info className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">信息</p>
                  <p className="text-2xl font-bold" data-testid="stat-info">{stats.info}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">警告</p>
                  <p className="text-2xl font-bold" data-testid="stat-warning">{stats.warning}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">错误</p>
                  <p className="text-2xl font-bold" data-testid="stat-error">{stats.error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter-event-id">活动ID</Label>
              <Input
                id="filter-event-id"
                placeholder="输入活动ID..."
                value={eventIdFilter}
                onChange={(e) => setEventIdFilter(e.target.value)}
                data-testid="input-filter-event-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-user-id">用户ID</Label>
              <Input
                id="filter-user-id"
                placeholder="输入用户ID..."
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                data-testid="input-filter-user-id"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-severity">严重程度</Label>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger data-testid="select-filter-severity">
                  <SelectValue placeholder="选择严重程度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="info">信息</SelectItem>
                  <SelectItem value="warning">警告</SelectItem>
                  <SelectItem value="error">错误</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-start-date">开始日期</Label>
              <Input
                id="filter-start-date"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-filter-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-end-date">结束日期</Label>
              <Input
                id="filter-end-date"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-filter-end-date"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEventIdFilter("");
                  setUserIdFilter("");
                  setSeverityFilter("all");
                  setStartDate("");
                  setEndDate("");
                }}
                data-testid="button-clear-filters"
                className="w-full"
              >
                清除筛选
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>日志列表 ({logs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无日志</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">时间</th>
                    <th className="text-left p-3 font-medium">事件类型</th>
                    <th className="text-left p-3 font-medium">严重程度</th>
                    <th className="text-left p-3 font-medium">消息</th>
                    <th className="text-left p-3 font-medium">活动ID</th>
                    <th className="text-left p-3 font-medium">用户ID</th>
                    <th className="text-left p-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const config = severityConfig[log.severity] || severityConfig.info;
                    const Icon = config.icon;

                    return (
                      <tr
                        key={log.id}
                        className="border-b hover-elevate transition-colors"
                        data-testid={`row-log-${log.id}`}
                      >
                        <td className="p-3 text-sm">
                          {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                        </td>
                        <td className="p-3 text-sm">
                          <code className="text-xs bg-muted px-2 py-1 rounded">{log.eventType}</code>
                        </td>
                        <td className="p-3">
                          <Badge variant={config.variant} className="text-xs">
                            <Icon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm max-w-md truncate">{log.message}</td>
                        <td className="p-3 text-sm">
                          {log.eventId ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded">{log.eventId.substring(0, 8)}...</code>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 text-sm">
                          {log.userId ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded">{log.userId.substring(0, 8)}...</code>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedLog(log)}
                            data-testid={`button-view-log-${log.id}`}
                          >
                            查看详情
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>日志详情</DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">时间</Label>
                  <p className="text-sm mt-1">
                    {format(new Date(selectedLog.createdAt), "yyyy-MM-dd HH:mm:ss")}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">严重程度</Label>
                  <div className="mt-1">
                    {(() => {
                      const config = severityConfig[selectedLog.severity] || severityConfig.info;
                      const Icon = config.icon;
                      return (
                        <Badge variant={config.variant} className="text-xs">
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">事件类型</Label>
                  <p className="text-sm mt-1">
                    <code className="text-xs bg-muted px-2 py-1 rounded">{selectedLog.eventType}</code>
                  </p>
                </div>
                {selectedLog.eventId && (
                  <div>
                    <Label className="text-xs text-muted-foreground">活动ID</Label>
                    <p className="text-sm mt-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{selectedLog.eventId}</code>
                    </p>
                  </div>
                )}
                {selectedLog.userId && (
                  <div>
                    <Label className="text-xs text-muted-foreground">用户ID</Label>
                    <p className="text-sm mt-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{selectedLog.userId}</code>
                    </p>
                  </div>
                )}
                {selectedLog.threadId && (
                  <div>
                    <Label className="text-xs text-muted-foreground">线程ID</Label>
                    <p className="text-sm mt-1">
                      <code className="text-xs bg-muted px-2 py-1 rounded">{selectedLog.threadId}</code>
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">消息</Label>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm">{selectedLog.message}</p>
                </div>
              </div>

              {selectedLog.metadata && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">元数据</Label>
                  <div className="bg-muted/50 rounded-lg p-4 overflow-auto max-h-64">
                    <pre className="text-xs">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
