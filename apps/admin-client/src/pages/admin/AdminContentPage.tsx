import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/ui/use-toast";
import { Plus, Edit, Trash2, FileText, Send, Eye, Bell } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

type ContentType = "announcement" | "help_article" | "faq" | "community_guideline";

interface Content {
  id: string;
  type: ContentType;
  title: string;
  content: string;
  category?: string;
  status: "draft" | "published" | "archived";
  priority: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const CONTENT_TYPES = {
  announcement: { label: "平台公告", icon: "📢", color: "bg-blue-500" },
  help_article: { label: "帮助文章", icon: "📖", color: "bg-green-500" },
  faq: { label: "常见问题", icon: "❓", color: "bg-yellow-500" },
  community_guideline: { label: "社区规范", icon: "🛡️", color: "bg-purple-500" },
};

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState<ContentType>("announcement");
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [publishingContent, setPublishingContent] = useState<Content | null>(null);
  const [sendNotification, setSendNotification] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "",
    priority: 0,
    status: "draft" as "draft" | "published",
  });

  const { data: contents = [], isLoading } = useQuery<Content[]>({
    queryKey: ["/api/admin/contents", activeTab],
    queryFn: async () => {
      const res = await fetch(`/api/admin/contents?type=${activeTab}`);
      if (!res.ok) throw new Error("Failed to fetch contents");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/contents", { ...data, type: activeTab });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contents"] });
      toast({ title: "创建成功", description: "内容已创建" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "创建失败", description: "请稍后重试", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/contents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contents"] });
      toast({ title: "更新成功", description: "内容已更新" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ title: "更新失败", description: "请稍后重试", variant: "destructive" });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async ({ id, sendNotification }: { id: string; sendNotification: boolean }) => {
      return apiRequest("POST", `/api/admin/contents/${id}/publish`, { sendNotification });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contents"] });
      setIsPublishDialogOpen(false);
      setSendNotification(false);
      setPublishingContent(null);
      toast({ title: "发布成功", description: "内容已发布" });
    },
    onError: () => {
      toast({ title: "发布失败", description: "请稍后重试", variant: "destructive" });
    },
  });

  const handleOpenPublishDialog = (content: Content) => {
    setPublishingContent(content);
    setSendNotification(content.type === "announcement");
    setIsPublishDialogOpen(true);
  };

  const handleConfirmPublish = () => {
    if (publishingContent) {
      publishMutation.mutate({ id: publishingContent.id, sendNotification });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/contents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/contents"] });
      toast({ title: "删除成功", description: "内容已删除" });
    },
    onError: () => {
      toast({ title: "删除失败", description: "请稍后重试", variant: "destructive" });
    },
  });

  const handleOpenDialog = (content?: Content) => {
    if (content) {
      setEditingContent(content);
      setFormData({
        title: content.title,
        content: content.content,
        category: content.category || "",
        priority: content.priority,
        status: content.status as "draft" | "published",
      });
    } else {
      setEditingContent(null);
      setFormData({ title: "", content: "", category: "", priority: 0, status: "draft" });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingContent(null);
    setFormData({ title: "", content: "", category: "", priority: 0, status: "draft" });
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.content) {
      toast({ title: "请填写必填项", description: "标题和内容不能为空", variant: "destructive" });
      return;
    }

    if (editingContent) {
      updateMutation.mutate({ id: editingContent.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-content-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">内容管理</h1>
          <p className="text-muted-foreground mt-1">管理平台公告、帮助文档和社区规范</p>
        </div>
        <Button onClick={() => handleOpenDialog()} data-testid="button-create-content">
          <Plus className="h-4 w-4 mr-2" />
          创建内容
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ContentType)} data-testid="tabs-content-types">
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(CONTENT_TYPES).map(([key, { label, icon }]) => (
            <TabsTrigger key={key} value={key} data-testid={`tab-${key}`}>
              <span className="mr-2">{icon}</span>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.keys(CONTENT_TYPES).map((type) => (
          <TabsContent key={type} value={type} className="space-y-4">
            {isLoading ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">加载中...</p>
                </CardContent>
              </Card>
            ) : contents.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <p className="text-center text-muted-foreground">暂无内容</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {contents.map((content) => (
                  <Card key={content.id} data-testid={`content-card-${content.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle data-testid={`text-title-${content.id}`}>{content.title}</CardTitle>
                            <Badge
                              variant={content.status === "published" ? "default" : "secondary"}
                              data-testid={`badge-status-${content.id}`}
                            >
                              {content.status === "published" ? "已发布" : "草稿"}
                            </Badge>
                            {content.category && (
                              <Badge variant="outline" data-testid={`badge-category-${content.id}`}>
                                {content.category}
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="mt-2">
                            优先级: {content.priority} | 
                            {content.publishedAt 
                              ? ` 发布于 ${format(new Date(content.publishedAt), "PPP", { locale: zhCN })}`
                              : ` 创建于 ${format(new Date(content.createdAt), "PPP", { locale: zhCN })}`
                            }
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          {content.status === "draft" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleOpenPublishDialog(content)}
                              data-testid={`button-publish-${content.id}`}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              发布
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDialog(content)}
                            data-testid={`button-edit-${content.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm("确定要删除这个内容吗？")) {
                                deleteMutation.mutate(content.id);
                              }
                            }}
                            data-testid={`button-delete-${content.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-3" data-testid={`text-preview-${content.id}`}>
                        {content.content}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-content-form">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingContent ? "编辑内容" : "创建新内容"}
            </DialogTitle>
            <DialogDescription>
              类型: {CONTENT_TYPES[activeTab].label}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">标题 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="输入标题"
                data-testid="input-title"
              />
            </div>

            <div>
              <Label htmlFor="category">分类</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="例如：安全、支付、活动"
                data-testid="input-category"
              />
            </div>

            <div>
              <Label htmlFor="content">内容 *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="输入内容（支持换行）"
                rows={10}
                data-testid="textarea-content"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="priority">优先级</Label>
                <Input
                  id="priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  data-testid="input-priority"
                />
                <p className="text-xs text-muted-foreground mt-1">数字越大优先级越高</p>
              </div>

              <div>
                <Label htmlFor="status">状态</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as "draft" | "published" })}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">发布</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit"
            >
              {editingContent ? "更新" : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Confirmation Dialog */}
      <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
        <DialogContent data-testid="dialog-publish-confirmation">
          <DialogHeader>
            <DialogTitle>确认发布内容</DialogTitle>
            <DialogDescription>
              确定要发布这条{publishingContent && CONTENT_TYPES[publishingContent.type].label}吗？
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="space-y-4">
              <div className="rounded-md bg-muted p-4">
                <h4 className="font-semibold mb-2">{publishingContent?.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {publishingContent?.content}
                </p>
              </div>

              {publishingContent?.type === "announcement" && (
                <div className="flex items-start space-x-3 rounded-md border p-4">
                  <Checkbox
                    id="send-notification"
                    checked={sendNotification}
                    onCheckedChange={(checked) => setSendNotification(checked as boolean)}
                    data-testid="checkbox-send-notification"
                  />
                  <div className="space-y-1 leading-none">
                    <label
                      htmlFor="send-notification"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                    >
                      <Bell className="h-4 w-4" />
                      推送通知给所有用户
                    </label>
                    <p className="text-xs text-muted-foreground">
                      勾选后将向所有用户推送此公告通知
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPublishDialogOpen(false)}
              data-testid="button-cancel-publish"
            >
              取消
            </Button>
            <Button
              onClick={handleConfirmPublish}
              disabled={publishMutation.isPending}
              data-testid="button-confirm-publish"
            >
              {publishMutation.isPending ? "发布中..." : "确认发布"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
