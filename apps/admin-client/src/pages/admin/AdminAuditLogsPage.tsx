import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { fmtDateTime } from "@/lib/dateUtils";
import { Shield, RefreshCw } from "lucide-react";

interface AuditLog {
  id: string;
  auditId: string;
  timestamp: string;
  adminId: string;
  adminRole: string | null;
  action: string;
  targetEntityType: string;
  targetEntityId: string | null;
  before: unknown;
  after: unknown;
  context: unknown;
}

interface AuditLogsResponse {
  rows: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

const ACTION_OPTIONS = [
  { value: "all", label: "全部操作" },
  { value: "ADMIN_LOGIN", label: "管理员登录" },
  { value: "ADMIN_ACCOUNT_CREATED", label: "创建管理员账号" },
  { value: "ADMIN_ACCOUNT_UPDATED", label: "更新管理员账号" },
  { value: "ADMIN_PASSWORD_RESET", label: "重置密码" },
  { value: "USER_BANNED", label: "封禁用户" },
  { value: "USER_UNBANNED", label: "解封用户" },
  { value: "ADMIN_POINTS_ADJUSTED", label: "调整积分" },
  { value: "ATTENDANCE_OVERRIDE", label: "考勤覆盖" },
  { value: "PAYMENT_REFUND_INITIATED", label: "发起退款" },
  { value: "VENUE_CREATED", label: "创建场地" },
  { value: "VENUE_UPDATED", label: "更新场地" },
  { value: "VENUE_DELETED", label: "删除场地" },
  { value: "EVENT_STATUS_CHANGED", label: "活动状态变更" },
  { value: "EVENT_POOL_STATUS_CHANGED", label: "活动池状态变更" },
  { value: "FLASH_CATALOG_SEEDED", label: "初始化闪现内容库" },
  { value: "FLASH_NPC_CREATED", label: "创建闪现 NPC" },
  { value: "FLASH_NPC_UPDATED", label: "更新闪现 NPC" },
  { value: "FLASH_ENCOUNTER_LOCATION_CREATED", label: "创建闪现地点" },
  { value: "FLASH_ENCOUNTER_LOCATION_UPDATED", label: "更新闪现地点" },
  { value: "FLASH_TASK_DESTINATION_CREATED", label: "创建任务目的地" },
  { value: "FLASH_TASK_DESTINATION_UPDATED", label: "更新任务目的地" },
  { value: "FLASH_TASK_TEMPLATE_CREATED", label: "创建闪现任务" },
  { value: "FLASH_TASK_TEMPLATE_UPDATED", label: "更新闪现任务" },
  { value: "FLASH_SCHEDULE_DRAFT_GENERATED", label: "生成闪现排班草案" },
  { value: "FLASH_SCHEDULE_DRAFT_UPDATED", label: "更新闪现排班草案" },
  { value: "FLASH_SCHEDULE_PUBLISHED", label: "发布闪现排班" },
  { value: "FLASH_SCHEDULE_REGENERATED", label: "重新生成已发布排班" },
  { value: "MATCHING_WEIGHTS_ACTIVATED", label: "激活匹配权重" },
  { value: "MATCHING_WEIGHTS_DISABLED", label: "禁用匹配权重" },
  { value: "MATCHING_WEIGHTS_ROLLED_BACK", label: "回滚匹配权重" },
  { value: "OTHER", label: "其他" },
];

const PAGE_SIZE = 20;

function getActionLabel(action: string): string {
  return ACTION_OPTIONS.find((o) => o.value === action)?.label || action;
}

function getActionVariant(action: string): "default" | "destructive" | "secondary" | "outline" {
  if (action.includes("BANNED") || action.includes("DELETED") || action.includes("DISABLED")) {
    return "destructive";
  }
  if (action.includes("CREATED") || action.includes("ACTIVATED")) {
    return "default";
  }
  if (action.includes("LOGIN")) {
    return "secondary";
  }
  return "outline";
}

export default function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [adminIdFilter, setAdminIdFilter] = useState("");

  const offset = (page - 1) * PAGE_SIZE;

  const { data, isLoading, error, refetch } = useQuery<AuditLogsResponse>({
    queryKey: ["/api/admin/audit-logs", { limit: PAGE_SIZE, offset, action: actionFilter !== "all" ? actionFilter : undefined, adminId: adminIdFilter || undefined }],
    queryFn: async () => {
      try {
        const params = new URLSearchParams();
        params.append("limit", String(PAGE_SIZE));
        params.append("offset", String(offset));
        if (actionFilter !== "all") params.append("action", actionFilter);
        if (adminIdFilter.trim()) params.append("adminId", adminIdFilter.trim());
        const res = await apiRequest("GET", `/api/admin/audit-logs?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Audit logs request failed: ${res.status}`);
        }
        return await res.json();
      } catch (err) {
        throw err instanceof Error ? err : new Error("Failed to fetch audit logs");
      }
    },
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const renderPaginationItems = () => {
    const items: JSX.Element[] = [];
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
        items.push(<PaginationItem key="ellipsis-start"><PaginationEllipsis /></PaginationItem>);
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
        items.push(<PaginationItem key="ellipsis-end"><PaginationEllipsis /></PaginationItem>);
      }
      items.push(
        <PaginationItem key="last">
          <PaginationLink onClick={() => handlePageChange(totalPages)}>{totalPages}</PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">审计日志</h2>
          <p className="text-muted-foreground">追踪管理员的关键操作记录</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          刷新
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">操作类型</span>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">管理员 ID</span>
            <Input
              placeholder="输入管理员 ID"
              value={adminIdFilter}
              onChange={(e) => { setAdminIdFilter(e.target.value); setPage(1); }}
              className="w-[200px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">总记录数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">当前页</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{page} / {totalPages || 1}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">每页显示</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{PAGE_SIZE}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">时间</TableHead>
                  <TableHead>操作</TableHead>
                  <TableHead>目标类型</TableHead>
                  <TableHead>目标 ID</TableHead>
                  <TableHead>管理员</TableHead>
                  <TableHead className="w-[200px]">上下文</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-destructive">
                      加载失败，请重试
                    </TableCell>
                  </TableRow>
                ) : (data?.rows?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      暂无审计记录
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.rows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">
                        {(() => {
                          try {
                            return fmtDateTime(log.timestamp);
                          } catch {
                            return log.timestamp;
                          }
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getActionVariant(log.action)} className="text-xs">
                          {getActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.targetEntityType}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.targetEntityId ? String(log.targetEntityId).slice(0, 12) + "…" : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3 text-muted-foreground" />
                          {log.adminRole || "管理员"}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          {String(log.adminId).slice(0, 8)}…
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.context ? (
                          <pre className="text-xs bg-muted p-1.5 rounded max-w-[200px] overflow-hidden text-ellipsis">
                            {(() => {
                              try {
                                const str = JSON.stringify(log.context, null, 2);
                                return str.length > 120 ? str.slice(0, 120) + "…" : str;
                              } catch {
                                return "[不可序列化数据]";
                              }
                            })()}
                          </pre>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Pagination */}
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
  );
}
