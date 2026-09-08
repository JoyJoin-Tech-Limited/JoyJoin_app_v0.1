import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/ui/use-toast";
import { Bell, Send, Users, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
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
import AdminQueryError from "@/components/admin/AdminQueryError";
import { fmtDateTimeShort } from "@/lib/dateUtils";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  archetype: string | null;
};

type EventPoolOption = {
  id: string;
  title: string;
  dateTime: string | null;
  city: string | null;
};

type AdminEventOption = {
  id: string;
  title: string;
  dateTime: string | null;
};

type RecipientFilter = "all" | "selected" | "pool" | "event";

type NotificationHistory = {
  id: string;
  title: string;
  message: string;
  category: string;
  type: string;
  recipientCount: number;
  readCount: number;
  createdAt: string;
};

export default function AdminNotificationsPage() {
  const { toast } = useToast();
  const [category, setCategory] = useState("discover");
  const [type, setType] = useState("admin_announcement");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [recipientFilter, setRecipientFilter] = useState<RecipientFilter>("all");
  const [selectedPoolId, setSelectedPoolId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?limit=500");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      return data?.users || [];
    },
  });

  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    isError: notificationsError,
    error: notificationsQueryError,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: ["/api/admin/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      return data?.notifications || [];
    },
  });

  const { data: poolsData = [] } = useQuery<EventPoolOption[]>({
    queryKey: ["/api/admin/event-pools", "notification-broadcast"],
    enabled: recipientFilter === "pool",
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/event-pools");
      const data = await res.json();
      return Array.isArray(data) ? data : data?.pools ?? [];
    },
  });

  const { data: poolRegistrations = [], isLoading: poolRegistrationsLoading } = useQuery<{ userId: string }[]>({
    queryKey: ["/api/admin/event-pools", selectedPoolId, "registrations", "notification-broadcast"],
    enabled: recipientFilter === "pool" && !!selectedPoolId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/event-pools/${selectedPoolId}/registrations`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: eventsData = [] } = useQuery<AdminEventOption[]>({
    queryKey: ["/api/admin/events", "notification-broadcast"],
    enabled: recipientFilter === "event",
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/events");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: eventAttendance = [], isLoading: eventAttendanceLoading } = useQuery<{ userId: string }[]>({
    queryKey: ["/api/admin/events", selectedEventId, "attendance-summary", "notification-broadcast"],
    enabled: recipientFilter === "event" && !!selectedEventId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/events/${selectedEventId}/attendance-summary`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (data: { userIds: string[]; category: string; type: string; title: string; message: string }) => {
      const res = await apiRequest("POST", "/api/admin/notifications/broadcast", data);
      return (await res.json()) as { success: boolean; sent?: number };
    },
    onSuccess: (data) => {
      toast({
        title: "通知发送成功",
        description: `成功发送给 ${data.sent ?? 0} 位用户`,
      });
      setTitle("");
      setMessage("");
      setSelectedUserIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/notifications"] });
    },
    onError: () => {
      toast({
        title: "发送失败",
        description: "无法发送通知，请重试",
        variant: "destructive",
      });
    },
  });

  const computeRecipientIds = (): string[] => {
    if (recipientFilter === "all") {
      return (usersData || []).map((u: User) => u.id);
    }
    if (recipientFilter === "pool") {
      return [...new Set(poolRegistrations.map((r) => r.userId).filter(Boolean))];
    }
    if (recipientFilter === "event") {
      return [...new Set(eventAttendance.map((r) => r.userId).filter(Boolean))];
    }
    return selectedUserIds;
  };

  const segmentLoading =
    (recipientFilter === "pool" && poolRegistrationsLoading) ||
    (recipientFilter === "event" && eventAttendanceLoading);

  const handleSend = () => {
    if (!title.trim()) {
      toast({
        title: "请输入标题",
        variant: "destructive",
      });
      return;
    }

    if (recipientFilter === "pool" && !selectedPoolId) {
      toast({ title: "请选择活动池", variant: "destructive" });
      return;
    }
    if (recipientFilter === "event" && !selectedEventId) {
      toast({ title: "请选择活动", variant: "destructive" });
      return;
    }

    const userIds = computeRecipientIds();

    if (userIds.length === 0) {
      toast({
        title: "请选择接收用户",
        variant: "destructive",
      });
      return;
    }

    setShowPreviewDialog(true);
  };

  const confirmSend = () => {
    const userIds = computeRecipientIds();
    sendNotificationMutation.mutate({ userIds, category, type, title, message });
    setShowPreviewDialog(false);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllUsers = () => {
    if (selectedUserIds.length === (usersData || []).length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds((usersData || []).map((u: User) => u.id));
    }
  };

  if (usersLoading || notificationsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (notificationsError) {
    return (
      <div className="container mx-auto p-6">
        <AdminQueryError
          title="通知数据加载失败"
          error={notificationsQueryError}
          onRetry={() => refetchNotifications()}
        />
      </div>
    );
  }

  const users = usersData || [];
  const notifications = notificationsData || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">通知推送管理</h1>
      </div>

      <Tabs defaultValue="send" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="send" data-testid="tab-send-notification">发送通知</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-notification-history">发送历史</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>创建并发送通知</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>通知分类</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="discover">发现</SelectItem>
                      <SelectItem value="activities">活动</SelectItem>
                      <SelectItem value="chat">连接</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>通知类型</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger data-testid="select-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin_announcement">管理员公告</SelectItem>
                      <SelectItem value="new_activity">新活动</SelectItem>
                      <SelectItem value="match_success">匹配成功</SelectItem>
                      <SelectItem value="activity_reminder">活动提醒</SelectItem>
                      <SelectItem value="new_message">新消息</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>标题 *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="输入通知标题"
                  data-testid="input-title"
                />
              </div>

              <div className="space-y-2">
                <Label>内容</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="输入通知内容（可选）"
                  rows={4}
                  data-testid="textarea-message"
                />
              </div>

              <div className="space-y-4">
                <Label>发送对象</Label>
                <div className="flex gap-4 flex-wrap">
                  <Button
                    variant={recipientFilter === "all" ? "default" : "outline"}
                    onClick={() => setRecipientFilter("all")}
                    data-testid="button-select-all-users"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    全部用户 ({users.length})
                  </Button>
                  <Button
                    variant={recipientFilter === "selected" ? "default" : "outline"}
                    onClick={() => setRecipientFilter("selected")}
                    data-testid="button-select-specific-users"
                  >
                    指定用户 ({selectedUserIds.length})
                  </Button>
                  <Button
                    variant={recipientFilter === "pool" ? "default" : "outline"}
                    onClick={() => setRecipientFilter("pool")}
                    data-testid="button-select-pool"
                  >
                    按活动池
                  </Button>
                  <Button
                    variant={recipientFilter === "event" ? "default" : "outline"}
                    onClick={() => setRecipientFilter("event")}
                    data-testid="button-select-event"
                  >
                    按活动
                  </Button>
                </div>

                {recipientFilter === "pool" && (
                  <div className="space-y-2">
                    <Label>选择活动池</Label>
                    <Select value={selectedPoolId} onValueChange={setSelectedPoolId}>
                      <SelectTrigger data-testid="select-pool">
                        <SelectValue placeholder="选择活动池" />
                      </SelectTrigger>
                      <SelectContent>
                        {poolsData.map((pool) => (
                          <SelectItem key={pool.id} value={pool.id}>
                            {pool.title}
                            {pool.dateTime ? ` · ${fmtDateTimeShort(pool.dateTime)}` : ""}
                          </SelectItem>
                        ))}
                        {poolsData.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">暂无活动池</div>
                        )}
                      </SelectContent>
                    </Select>
                    {selectedPoolId && (
                      <p className="text-sm text-muted-foreground" data-testid="text-pool-recipient-count">
                        {poolRegistrationsLoading
                          ? "正在统计报名用户..."
                          : `该活动池报名用户 ${computeRecipientIds().length} 人`}
                      </p>
                    )}
                  </div>
                )}

                {recipientFilter === "event" && (
                  <div className="space-y-2">
                    <Label>选择活动</Label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger data-testid="select-event">
                        <SelectValue placeholder="选择活动" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventsData.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.title}
                            {event.dateTime ? ` · ${fmtDateTimeShort(event.dateTime)}` : ""}
                          </SelectItem>
                        ))}
                        {eventsData.length === 0 && (
                          <div className="px-3 py-2 text-sm text-muted-foreground">暂无活动</div>
                        )}
                      </SelectContent>
                    </Select>
                    {selectedEventId && (
                      <p className="text-sm text-muted-foreground" data-testid="text-event-recipient-count">
                        {eventAttendanceLoading
                          ? "正在统计出席用户..."
                          : `该活动出席名单 ${computeRecipientIds().length} 人`}
                      </p>
                    )}
                  </div>
                )}

                {recipientFilter === "selected" && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">选择用户</CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleAllUsers}
                          data-testid="button-toggle-all"
                        >
                          {selectedUserIds.length === users.length ? "取消全选" : "全选"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {users.map((user: User) => (
                          <div
                            key={user.id}
                            className="flex items-center space-x-3 p-3 rounded-lg hover-elevate"
                            data-testid={`user-item-${user.id}`}
                          >
                            <Checkbox
                              checked={selectedUserIds.includes(user.id)}
                              onCheckedChange={() => toggleUserSelection(user.id)}
                              data-testid={`checkbox-user-${user.id}`}
                            />
                            <div className="flex-1">
                              <p className="font-medium">
                                {user.firstName} {user.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">{user.phoneNumber}</p>
                            </div>
                            {user.archetype && (
                              <Badge variant="secondary">{user.archetype}</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  onClick={handleSend}
                  disabled={sendNotificationMutation.isPending || segmentLoading}
                  data-testid="button-send-notification"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendNotificationMutation.isPending ? "发送中..." : "发送通知"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>通知发送历史</CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>暂无发送记录</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {notifications.map((notif: NotificationHistory) => (
                    <Card key={notif.id} data-testid={`notification-${notif.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg" data-testid="text-notification-title">
                                {notif.title}
                              </h3>
                              <Badge variant="outline">{notif.category}</Badge>
                              <Badge variant="secondary">{notif.type}</Badge>
                            </div>
                            {notif.message && (
                              <p className="text-muted-foreground mb-3" data-testid="text-notification-message">
                                {notif.message}
                              </p>
                            )}
                            <div className="flex items-center gap-6 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span data-testid="text-recipient-count">
                                  发送给 {notif.recipientCount} 人
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                <span data-testid="text-read-count">
                                  {notif.readCount} 人已读
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span data-testid="text-created-at">
                                  {new Date(notif.createdAt).toLocaleString("zh-CN")}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Send Preview Confirmation Dialog */}
      <AlertDialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              确认发送通知
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <div className="rounded-md border p-3 space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">标题</span>
                  <p className="font-semibold">{title}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">内容</span>
                  <p className="text-sm whitespace-pre-wrap">{message}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">接收人数</span>
                  <p className="font-semibold" data-testid="text-preview-recipient-count">
                    {computeRecipientIds().length} 人
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                此操作将立即发送通知给上述用户，请确认内容无误。
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSend}
              disabled={sendNotificationMutation.isPending}
              data-testid="button-confirm-send-notification"
            >
              {sendNotificationMutation.isPending ? "发送中..." : "确认发送"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
