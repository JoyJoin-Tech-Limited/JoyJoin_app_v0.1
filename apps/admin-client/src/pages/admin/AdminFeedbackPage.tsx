import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, MessageSquare, TrendingUp, Eye, CheckCircle, XCircle, Users } from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface FeedbackStats {
  totalFeedbacks: number;
  avgAtmosphereScore: number;
  lowRatedCount: number;
  deepFeedbackRate: number;
  topImprovementAreas: Array<{ area: string; count: number }>;
  connectionStatusBreakdown: Record<string, number>;
}

interface FeedbackDetail {
  id: string;
  eventId: string;
  userId: string;
  atmosphereScore: number | null;
  atmosphereNote: string | null;
  connectionRadar: {
    topicResonance: number;
    personalityMatch: number;
    backgroundDiversity: number;
    overallFit: number;
  } | null;
  hasNewConnections: boolean | null;
  connectionStatus: string | null;
  attendeeTraits: Record<string, {
    displayName: string;
    tags: string[];
    needsImprovement: boolean;
    improvementNote: string;
  }> | null;
  improvementAreas: string[] | null;
  improvementOther: string | null;
  hasDeepFeedback: boolean | null;
  conversationBalance: number | null;
  conversationComfort: number | null;
  conversationNotes: string | null;
  matchPointValidation: Record<string, {
    discussed: string;
    notes: string;
  }> | null;
  additionalMatchPoints: string | null;
  futurePreferences: string[] | null;
  futurePreferencesOther: string | null;
  createdAt: Date;
  user: {
    displayName: string | null;
    phoneNumber: string | null;
  };
  event: {
    title: string;
    dateTime: Date;
    status: string | null;
  };
}

interface EventListItem {
  id: string;
  title: string;
  dateTime: Date;
  status: string | null;
}

interface FeedbackListItem {
  id: string;
  eventId: string;
  userId: string;
  atmosphereScore: number | null;
  atmosphereNote: string | null;
  connectionStatus: string | null;
  hasNewConnections: boolean | null;
  hasDeepFeedback: boolean | null;
  createdAt: Date;
  user: {
    displayName: string | null;
    phoneNumber: string | null;
  };
  event: {
    title: string;
    dateTime: Date;
    status: string | null;
  };
}

export default function AdminFeedbackPage() {
  const [filters, setFilters] = useState({
    eventId: "",
    minRating: "",
    maxRating: "",
    startDate: "",
    endDate: "",
    hasDeepFeedback: undefined as boolean | undefined,
  });

  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);

  // Fetch feedback stats
  const { data: stats } = useQuery<FeedbackStats>({
    queryKey: ["/api/admin/feedback/stats"],
  });

  // Fetch all feedbacks with filters
  const { data: feedbacks = [], isLoading } = useQuery<FeedbackListItem[]>({
    queryKey: [
      "/api/admin/feedback",
      filters.eventId,
      filters.minRating,
      filters.maxRating,
      filters.startDate,
      filters.endDate,
      filters.hasDeepFeedback,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.eventId) params.append("eventId", filters.eventId);
      if (filters.minRating) params.append("minRating", filters.minRating);
      if (filters.maxRating) params.append("maxRating", filters.maxRating);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.hasDeepFeedback !== undefined) params.append("hasDeepFeedback", String(filters.hasDeepFeedback));

      const response = await fetch(`/api/admin/feedback?${params}`);
      if (!response.ok) throw new Error("Failed to fetch feedbacks");
      return response.json();
    },
  });

  // Fetch events for filter dropdown
  const { data: events = [] } = useQuery<EventListItem[]>({
    queryKey: ["/api/admin/events"],
  });

  // Fetch selected feedback details
  const { data: selectedFeedback } = useQuery<FeedbackDetail>({
    queryKey: ["/api/admin/feedback", selectedFeedbackId],
    enabled: !!selectedFeedbackId,
  });

  const getAtmosphereColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score <= 2) return "text-red-500";
    if (score === 3) return "text-yellow-500";
    return "text-green-500";
  };

  const getAtmosphereLabel = (score: number | null) => {
    if (!score) return "未评分";
    const labels = ["", "尴尬", "平淡", "舒适", "热烈", "完美"];
    return labels[score] || "未知";
  };

  const getConnectionStatusColor = (status: string | null) => {
    switch (status) {
      case "已交换联系方式":
        return "bg-green-500";
      case "有但还没联系":
        return "bg-blue-500";
      case "没有但很愉快":
        return "bg-yellow-500";
      case "没有不太合适":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-feedback-management">反馈管理</h1>
        <p className="text-muted-foreground">查看和分析用户活动反馈</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-total-feedbacks">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总反馈数</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalFeedbacks || 0}</div>
            <p className="text-xs text-muted-foreground">
              平均氛围评分: <span className="font-medium">{stats?.avgAtmosphereScore || 0}</span>/5
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-low-rated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">低分预警</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats?.lowRatedCount || 0}</div>
            <p className="text-xs text-muted-foreground">氛围评分 &lt; 3 分的反馈</p>
          </CardContent>
        </Card>

        <Card data-testid="card-deep-feedback-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">深度反馈完成率</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.deepFeedbackRate || 0}%</div>
            <p className="text-xs text-muted-foreground">用户深度反馈参与度</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="filter-event">活动</Label>
              <Select
                value={filters.eventId}
                onValueChange={(value) => setFilters({ ...filters, eventId: value })}
              >
                <SelectTrigger id="filter-event" data-testid="select-filter-event">
                  <SelectValue placeholder="全部活动" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部活动</SelectItem>
                  {events.map((event: any) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-min-rating">最低评分</Label>
              <Select
                value={filters.minRating}
                onValueChange={(value) => setFilters({ ...filters, minRating: value })}
              >
                <SelectTrigger id="filter-min-rating" data-testid="select-min-rating">
                  <SelectValue placeholder="不限" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不限</SelectItem>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <SelectItem key={rating} value={String(rating)}>
                      {rating} 分
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-max-rating">最高评分</Label>
              <Select
                value={filters.maxRating}
                onValueChange={(value) => setFilters({ ...filters, maxRating: value })}
              >
                <SelectTrigger id="filter-max-rating" data-testid="select-max-rating">
                  <SelectValue placeholder="不限" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">不限</SelectItem>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <SelectItem key={rating} value={String(rating)}>
                      {rating} 分
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-start-date">开始日期</Label>
              <Input
                id="filter-start-date"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                data-testid="input-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-end-date">结束日期</Label>
              <Input
                id="filter-end-date"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                data-testid="input-end-date"
              />
            </div>

            <div className="flex items-center space-x-2 pt-8">
              <Switch
                id="filter-deep-feedback"
                checked={filters.hasDeepFeedback || false}
                onCheckedChange={(checked) =>
                  setFilters({ ...filters, hasDeepFeedback: checked ? true : undefined })
                }
                data-testid="switch-deep-feedback"
              />
              <Label htmlFor="filter-deep-feedback">仅显示深度反馈</Label>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setFilters({
                  eventId: "",
                  minRating: "",
                  maxRating: "",
                  startDate: "",
                  endDate: "",
                  hasDeepFeedback: undefined,
                })
              }
              data-testid="button-clear-filters"
            >
              清除筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Top Improvement Areas */}
      {stats?.topImprovementAreas && stats.topImprovementAreas.length > 0 && (
        <Card data-testid="card-top-improvements">
          <CardHeader>
            <CardTitle>最常见的改进建议 (Top 5)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topImprovementAreas.map((item: any, index: number) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.area}</span>
                    <span className="text-sm text-muted-foreground">{item.count} 次</span>
                  </div>
                  <Progress
                    value={(item.count / stats.totalFeedbacks) * 100}
                    className="h-2"
                    data-testid={`progress-improvement-${index}`}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback Table */}
      <Card data-testid="card-feedback-table">
        <CardHeader>
          <CardTitle>反馈列表</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">加载中...</div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">暂无反馈数据</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>活动名称</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead>氛围评分</TableHead>
                    <TableHead>连接状态</TableHead>
                    <TableHead>提交时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbacks.map((feedback: any) => (
                    <TableRow
                      key={feedback.id}
                      className={cn(
                        "cursor-pointer hover-elevate",
                        feedback.atmosphereScore && feedback.atmosphereScore < 3 && "bg-red-50 dark:bg-red-950/20"
                      )}
                      onClick={() => setSelectedFeedbackId(feedback.id)}
                      data-testid={`row-feedback-${feedback.id}`}
                    >
                      <TableCell className="font-medium">{feedback.event.title}</TableCell>
                      <TableCell>
                        {feedback.user.displayName || "未设置"}
                        <div className="text-xs text-muted-foreground">{feedback.user.phoneNumber}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn("text-2xl font-bold", getAtmosphereColor(feedback.atmosphereScore))}
                            data-testid={`text-atmosphere-score-${feedback.id}`}
                          >
                            {feedback.atmosphereScore || "-"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {getAtmosphereLabel(feedback.atmosphereScore)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {feedback.connectionStatus ? (
                          <Badge
                            className={cn("text-white", getConnectionStatusColor(feedback.connectionStatus))}
                            data-testid={`badge-connection-status-${feedback.id}`}
                          >
                            {feedback.connectionStatus}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {feedback.createdAt ? format(new Date(feedback.createdAt), "yyyy-MM-dd HH:mm") : "-"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFeedbackId(feedback.id);
                          }}
                          data-testid={`button-view-feedback-${feedback.id}`}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          查看详情
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback Detail Dialog */}
      <Dialog open={!!selectedFeedbackId} onOpenChange={() => setSelectedFeedbackId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-feedback-detail">
          <DialogHeader>
            <DialogTitle>反馈详情</DialogTitle>
          </DialogHeader>

          {selectedFeedback && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-muted-foreground">活动名称</Label>
                  <p className="font-medium">{selectedFeedback.event.title}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">活动日期</Label>
                  <p className="font-medium">
                    {format(new Date(selectedFeedback.event.dateTime), "yyyy-MM-dd HH:mm")}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">用户姓名</Label>
                  <p className="font-medium">{selectedFeedback.user.displayName || "未设置"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">提交时间</Label>
                  <p className="font-medium">
                    {selectedFeedback.createdAt
                      ? format(new Date(selectedFeedback.createdAt), "yyyy-MM-dd HH:mm")
                      : "-"}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Atmosphere Score */}
              <div className="space-y-3" data-testid="section-atmosphere-score">
                <h3 className="text-lg font-semibold">氛围评分</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">尴尬</span>
                    <span className="text-sm">完美</span>
                  </div>
                  <div className="relative">
                    <Progress value={(selectedFeedback.atmosphereScore || 0) * 20} className="h-4" />
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                      {selectedFeedback.atmosphereScore || 0} / 5 -{" "}
                      {getAtmosphereLabel(selectedFeedback.atmosphereScore)}
                    </div>
                  </div>
                  {selectedFeedback.atmosphereNote && (
                    <p className="text-sm text-muted-foreground italic">"{selectedFeedback.atmosphereNote}"</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Connection Radar */}
              {selectedFeedback.connectionRadar && (
                <>
                  <div className="space-y-3" data-testid="section-connection-radar">
                    <h3 className="text-lg font-semibold">连接雷达图</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart
                          data={[
                            {
                              dimension: "话题共鸣",
                              value: selectedFeedback.connectionRadar.topicResonance || 0,
                            },
                            {
                              dimension: "性格匹配",
                              value: selectedFeedback.connectionRadar.personalityMatch || 0,
                            },
                            {
                              dimension: "背景多样性",
                              value: selectedFeedback.connectionRadar.backgroundDiversity || 0,
                            },
                            {
                              dimension: "整体契合",
                              value: selectedFeedback.connectionRadar.overallFit || 0,
                            },
                          ]}
                        >
                          <PolarGrid />
                          <PolarAngleAxis dataKey="dimension" />
                          <PolarRadiusAxis domain={[0, 5]} />
                          <Radar name="评分" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Connection Status */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">连接状态</h3>
                <div className="flex items-center gap-4">
                  {selectedFeedback.connectionStatus && (
                    <Badge
                      className={cn("text-white", getConnectionStatusColor(selectedFeedback.connectionStatus))}
                    >
                      {selectedFeedback.connectionStatus}
                    </Badge>
                  )}
                  {selectedFeedback.hasNewConnections !== null && (
                    <div className="flex items-center gap-2">
                      {selectedFeedback.hasNewConnections ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-sm">
                        {selectedFeedback.hasNewConnections ? "有新连接" : "无新连接"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Attendee Traits */}
              {selectedFeedback.attendeeTraits && Object.keys(selectedFeedback.attendeeTraits).length > 0 && (
                <>
                  <div className="space-y-3" data-testid="section-attendee-traits">
                    <h3 className="text-lg font-semibold">参与者印象标签</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {Object.entries(selectedFeedback.attendeeTraits).map(([userId, data]: [string, any]) => (
                        <Card key={userId}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              {data.displayName}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {data.tags && data.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {data.tags.map((tag: string, idx: number) => (
                                  <Badge key={idx} variant="secondary">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {data.needsImprovement && data.improvementNote && (
                              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-md">
                                <p className="text-xs text-muted-foreground">改进建议：</p>
                                <p className="text-sm">{data.improvementNote}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* Improvement Suggestions */}
              {(selectedFeedback.improvementAreas || selectedFeedback.improvementOther) && (
                <>
                  <div className="space-y-3" data-testid="section-improvements">
                    <h3 className="text-lg font-semibold">改进建议</h3>
                    {selectedFeedback.improvementAreas && selectedFeedback.improvementAreas.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedFeedback.improvementAreas.map((area: string, idx: number) => (
                          <Badge key={idx} variant="outline">
                            {area}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {selectedFeedback.improvementOther && (
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-sm font-medium mb-1">自定义建议：</p>
                        <p className="text-sm">{selectedFeedback.improvementOther}</p>
                      </div>
                    )}
                  </div>
                  <Separator />
                </>
              )}

              {/* Deep Feedback Section */}
              {selectedFeedback.hasDeepFeedback && (
                <div className="space-y-4 p-4 bg-primary/5 rounded-lg" data-testid="section-deep-feedback">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    深度反馈
                  </h3>

                  {/* Conversation Balance */}
                  {selectedFeedback.conversationBalance !== null && selectedFeedback.conversationBalance !== undefined && (
                    <div className="space-y-2">
                      <Label>对话平衡度</Label>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>全是他们说</span>
                        <span>平衡</span>
                        <span>全是我说</span>
                      </div>
                      <Progress value={selectedFeedback.conversationBalance} className="h-3" />
                      <p className="text-sm text-center">{selectedFeedback.conversationBalance}%</p>
                    </div>
                  )}

                  {/* Conversation Comfort */}
                  {selectedFeedback.conversationComfort !== null && selectedFeedback.conversationComfort !== undefined && (
                    <div className="space-y-2">
                      <Label>对话舒适度</Label>
                      <Progress value={selectedFeedback.conversationComfort} className="h-3" />
                      <p className="text-sm text-center">{selectedFeedback.conversationComfort}%</p>
                    </div>
                  )}

                  {/* Conversation Notes */}
                  {selectedFeedback.conversationNotes && (
                    <div className="space-y-2">
                      <Label>对话备注</Label>
                      <p className="text-sm p-2 bg-background rounded-md">{selectedFeedback.conversationNotes}</p>
                    </div>
                  )}

                  {/* Match Point Validation */}
                  {selectedFeedback.matchPointValidation && (
                    <div className="space-y-2">
                      <Label>匹配点验证</Label>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>匹配点</TableHead>
                              <TableHead>讨论深度</TableHead>
                              <TableHead>备注</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Object.entries(selectedFeedback.matchPointValidation).map(([point, data]: [string, any]) => (
                              <TableRow key={point}>
                                <TableCell className="font-medium">{point}</TableCell>
                                <TableCell>
                                  <Badge variant={data.discussed === "deeply" ? "default" : data.discussed === "briefly" ? "secondary" : "outline"}>
                                    {data.discussed === "deeply" ? "深入讨论" : data.discussed === "briefly" ? "简短提及" : "未讨论"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{data.notes || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Additional Match Points */}
                  {selectedFeedback.additionalMatchPoints && (
                    <div className="space-y-2">
                      <Label>额外匹配点</Label>
                      <p className="text-sm p-2 bg-background rounded-md">{selectedFeedback.additionalMatchPoints}</p>
                    </div>
                  )}

                  {/* Future Preferences */}
                  {selectedFeedback.futurePreferences && selectedFeedback.futurePreferences.length > 0 && (
                    <div className="space-y-2">
                      <Label>未来偏好</Label>
                      <div className="flex flex-wrap gap-2">
                        {selectedFeedback.futurePreferences.map((pref: string, idx: number) => (
                          <Badge key={idx} variant="secondary">
                            {pref}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedFeedback.futurePreferencesOther && (
                    <div className="space-y-2">
                      <Label>自定义偏好</Label>
                      <p className="text-sm p-2 bg-background rounded-md">{selectedFeedback.futurePreferencesOther}</p>
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
