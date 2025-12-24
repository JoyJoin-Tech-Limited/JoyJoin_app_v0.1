import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Clock, Users, TrendingUp, AlertCircle, CheckCircle, HourglassIcon } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

// 温度等级emoji辅助函数
function getTemperatureEmoji(score: number): string {
  if (score >= 85) return "🔥"; // 炽热
  if (score >= 70) return "🌡️"; // 温暖
  if (score >= 55) return "🌤️"; // 适宜
  return "❄️"; // 冷淡
}

interface MatchingLog {
  id: string;
  poolId: string;
  poolTitle: string;
  scanType: "realtime" | "scheduled" | "manual";
  pendingUsersCount: number;
  currentThreshold: number;
  timeUntilEvent: number;
  groupsFormed: number;
  usersMatched: number;
  avgGroupScore: number | null;
  decision: "matched" | "waiting" | "insufficient";
  reason: string;
  triggeredBy: string;
  createdAt: string;
}

const SCAN_TYPE_MAP: Record<string, { label: string; variant: any }> = {
  realtime: { label: "实时触发", variant: "default" },
  scheduled: { label: "定时扫描", variant: "secondary" },
  manual: { label: "手动触发", variant: "outline" },
};

const DECISION_MAP: Record<string, { label: string; variant: any; icon: any }> = {
  matched: { label: "已匹配", variant: "default", icon: CheckCircle },
  waiting: { label: "继续等待", variant: "secondary", icon: HourglassIcon },
  insufficient: { label: "人数不足", variant: "destructive", icon: AlertCircle },
};

export default function AdminMatchingLogsPage() {
  const [scanTypeFilter, setScanTypeFilter] = useState<string>("all");
  const [decisionFilter, setDecisionFilter] = useState<string>("all");

  const { data: logs, isLoading } = useQuery<MatchingLog[]>({
    queryKey: ["/api/admin/matching-logs", { scanType: scanTypeFilter !== "all" ? scanTypeFilter : undefined, decision: decisionFilter !== "all" ? decisionFilter : undefined }],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">匹配扫描日志</h1>
        <p className="text-muted-foreground">
          查看每次扫描的决策过程和匹配结果
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="w-[200px]">
          <Select value={scanTypeFilter} onValueChange={setScanTypeFilter}>
            <SelectTrigger data-testid="select-scan-type">
              <SelectValue placeholder="扫描类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有类型</SelectItem>
              <SelectItem value="realtime">实时触发</SelectItem>
              <SelectItem value="scheduled">定时扫描</SelectItem>
              <SelectItem value="manual">手动触发</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-[200px]">
          <Select value={decisionFilter} onValueChange={setDecisionFilter}>
            <SelectTrigger data-testid="select-decision">
              <SelectValue placeholder="决策结果" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有结果</SelectItem>
              <SelectItem value="matched">已匹配</SelectItem>
              <SelectItem value="waiting">继续等待</SelectItem>
              <SelectItem value="insufficient">人数不足</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-4">
        {logs && logs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              暂无扫描日志
            </CardContent>
          </Card>
        ) : (
          logs?.map((log) => {
            const DecisionIcon = DECISION_MAP[log.decision]?.icon || AlertCircle;
            
            return (
              <Card key={log.id} data-testid={`log-card-${log.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{log.poolTitle}</CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {format(new Date(log.createdAt), "PPP HH:mm:ss", { locale: zhCN })}
                        </span>
                        <Badge variant={SCAN_TYPE_MAP[log.scanType]?.variant || "secondary"}>
                          {SCAN_TYPE_MAP[log.scanType]?.label || log.scanType}
                        </Badge>
                      </div>
                    </div>
                    <Badge
                      variant={DECISION_MAP[log.decision]?.variant || "secondary"}
                      className="flex items-center gap-1"
                    >
                      <DecisionIcon className="h-3 w-3" />
                      {DECISION_MAP[log.decision]?.label || log.decision}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Metrics */}
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="text-muted-foreground">待匹配用户</div>
                      <div className="text-2xl font-bold flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {log.pendingUsersCount}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">当前阈值</div>
                      <div className="text-2xl font-bold flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        {log.currentThreshold}分
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-muted-foreground">距离活动</div>
                      <div className="text-2xl font-bold flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {log.timeUntilEvent}h
                      </div>
                    </div>
                    {log.decision === "matched" && (
                      <div className="space-y-1">
                        <div className="text-muted-foreground">平均分数</div>
                        <div className="text-2xl font-bold text-green-600">
                          {getTemperatureEmoji(log.avgGroupScore || 0)} {log.avgGroupScore}分
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Match Results (if matched) */}
                  {log.decision === "matched" && (
                    <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-green-900 dark:text-green-100">
                          成功匹配
                        </span>
                        <span className="text-green-700 dark:text-green-300">
                          {log.groupsFormed} 组，共 {log.usersMatched} 人
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="text-sm font-medium mb-1">决策原因</div>
                    <div className="text-sm text-muted-foreground">{log.reason}</div>
                  </div>

                  {/* Metadata */}
                  <div className="text-xs text-muted-foreground">
                    触发方式：{log.triggeredBy}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
