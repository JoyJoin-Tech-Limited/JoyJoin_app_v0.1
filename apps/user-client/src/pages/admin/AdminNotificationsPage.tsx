import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bell, Send, Users, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

type User = {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  archetype: string | null;
};

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
  const [recipientFilter, setRecipientFilter] = useState<"all" | "selected">("all");

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?limit=500");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      return data?.users || [];
    },
  });

  const { data: notificationsData, isLoading: notificationsLoading } = useQuery({
    queryKey: ["/api/admin/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) throw new Error("Failed to fetch notifications");
      const data = await res.json();
      return data?.notifications || [];
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (data: { userIds: string[]; category: string; type: string; title: string; message: string }) => {
      return apiRequest("POST", "/api/admin/notifications/broadcast", data);
    },
    onSuccess: (data: any) => {
      toast({
        title: "通知发送成功",
        description: `成功发送给 ${data.sent} 位用户`,
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

  const handleSend = () => {
    if (!title.trim()) {
      toast({
        title: "请输入标题",
        variant: "destructive",
      });
      return;
    }

    let userIds: string[] = [];
    if (recipientFilter === "all") {
      userIds = (usersData || []).map((u: User) => u.id);
    } else {
      userIds = selectedUserIds;
    }

    if (userIds.length === 0) {
      toast({
        title: "请选择接收用户",
        variant: "destructive",
      });
      return;
    }

    sendNotificationMutation.mutate({ userIds, category, type, title, message });
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
                      <SelectItem value="chat">聊天</SelectItem>
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
                <Label>接收对象</Label>
                <div className="flex gap-4">
                  <Button
                    variant={recipientFilter === "all" ? "default" : "outline"}
                    onClick={() => setRecipientFilter("all")}
                    data-testid="button-select-all-users"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    所有用户 ({users.length})
                  </Button>
                  <Button
                    variant={recipientFilter === "selected" ? "default" : "outline"}
                    onClick={() => setRecipientFilter("selected")}
                    data-testid="button-select-specific-users"
                  >
                    指定用户 ({selectedUserIds.length})
                  </Button>
                </div>

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
                  disabled={sendNotificationMutation.isPending}
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
    </div>
  );
}
