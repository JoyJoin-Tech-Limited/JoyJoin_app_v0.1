import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Activity, Users, Clock, Radio } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface SummaryResponse {
  days: number;
  since: string;
  generatedAt: string;
  totals: { helpful: number; neutral: number; awkward: number; rows: number };
  byPhase: Array<{ phase: string; helpful: number; neutral: number; awkward: number }>;
  byPromptVersion: Array<{
    promptVersion: string;
    helpful: number;
    neutral: number;
    awkward: number;
  }>;
}

interface IcebreakerSession {
  id: string;
  currentPhase: string;
  phaseStartedAt: string | null;
  phaseDurationMinutes: number | null;
  expectedAttendees: number;
  checkedInCount: number;
  hostUserId: string | null;
  hostName: string | null;
  eventTitle: string;
  startedAt: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  waiting: "等待开始",
  checkin: "签到中",
  number_assign: "号码分配",
  icebreaker: "破冰进行中",
  ended: "已结束",
};

export default function AdminIcebreakerAiFeedbackPage() {
  const [activeTab, setActiveTab] = useState("feedback");
  const [days, setDays] = useState("30");

  const { data, isLoading, error } = useQuery<SummaryResponse>({
    queryKey: ["/api/admin/icebreaker-ai-feedback/summary", days],
    queryFn: async () => {
      const res = await fetch(`/api/admin/icebreaker-ai-feedback/summary?days=${days}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      return res.json();
    },
    enabled: activeTab === "feedback",
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery<{ sessions: IcebreakerSession[] }>({
    queryKey: ["/api/admin/icebreaker-sessions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/icebreaker-sessions", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: activeTab === "monitor",
    refetchInterval: activeTab === "monitor" ? 15000 : false,
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            破冰会话
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI 反馈质量分析与实时会话监控
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="feedback" data-testid="tab-feedback">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            AI 反馈
          </TabsTrigger>
          <TabsTrigger value="monitor" data-testid="tab-monitor">
            <Radio className="h-3.5 w-3.5 mr-1.5" />
            会话监控
          </TabsTrigger>
        </TabsList>

        {/* AI Feedback Tab */}
        <TabsContent value="feedback" className="space-y-6">
          <div className="flex justify-end">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="时间范围" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">最近 7 天</SelectItem>
                <SelectItem value="30">最近 30 天</SelectItem>
                <SelectItem value="90">最近 90 天</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle>加载失败</CardTitle>
                <CardDescription>{String(error)}</CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : data ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>汇总</CardTitle>
                  <CardDescription>
                    自 {new Date(data.since).toLocaleString()} — 共 {data.totals.rows} 条
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">有帮助</p>
                    <p className="text-2xl font-bold text-emerald-600">{data.totals.helpful}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">一般</p>
                    <p className="text-2xl font-bold">{data.totals.neutral}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-muted-foreground">略尴尬</p>
                    <p className="text-2xl font-bold text-rose-600">{data.totals.awkward}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>按阶段</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.byPhase.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无数据</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {data.byPhase.map((row) => (
                        <li key={row.phase} className="flex justify-between border-b pb-2">
                          <span className="font-mono">{row.phase}</span>
                          <span>
                            ↑{row.helpful} · ~{row.neutral} · ↓{row.awkward}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>按 prompt 版本</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.byPromptVersion.length === 0 ? (
                    <p className="text-sm text-muted-foreground">暂无数据</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {data.byPromptVersion.map((row) => (
                        <li key={row.promptVersion} className="flex justify-between border-b pb-2">
                          <span className="font-mono text-xs break-all">{row.promptVersion}</span>
                          <span className="shrink-0">
                            ↑{row.helpful} · ~{row.neutral} · ↓{row.awkward}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* Session Monitor Tab */}
        <TabsContent value="monitor" className="space-y-6">
          {sessionsLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !sessionsData?.sessions || sessionsData.sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Activity className="mx-auto h-8 w-8 mb-3 text-muted-foreground" />
                <p>当前没有进行中的破冰会话</p>
                <p className="text-xs mt-1">活动结束后会话会自动结束并移出此列表</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>活动</TableHead>
                    <TableHead>当前阶段</TableHead>
                    <TableHead>阶段时长</TableHead>
                    <TableHead>签到</TableHead>
                    <TableHead>主持人</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionsData.sessions.map((session) => (
                    <TableRow key={session.id} data-testid={`session-row-${session.id}`}>
                      <TableCell>
                        <div className="font-medium">{session.eventTitle}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {session.id.slice(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            session.currentPhase === "icebreaker"
                              ? "default"
                              : session.currentPhase === "waiting"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {PHASE_LABELS[session.currentPhase] || session.currentPhase}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {session.phaseDurationMinutes !== null
                            ? `${session.phaseDurationMinutes} 分钟`
                            : "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          {session.checkedInCount} / {session.expectedAttendees}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{session.hostName || "未指定"}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
