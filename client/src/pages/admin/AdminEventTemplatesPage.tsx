import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, Plus, Edit, Trash2, Clock, TrendingUp, Users } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EventTemplate {
  id: string;
  name: string;
  eventType: string;
  dayOfWeek: number;
  timeOfDay: string;
  theme: string | null;
  genderRestriction: string | null;
  minAge: number | null;
  maxAge: number | null;
  minParticipants: number;
  maxParticipants: number;
  customPrice: number | null;
  isActive: boolean;
  createdAt: string;
}

const EVENT_TYPES = [
  { value: "饭局", label: "饭局" },
  { value: "酒局", label: "酒局" },
];

const DAY_OF_WEEK_MAP: Record<number, string> = {
  0: '周日',
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
};

const GENDER_RESTRICTIONS = [
  { value: "none", label: "无限制" },
  { value: "Woman", label: "仅限女性" },
  { value: "Man", label: "仅限男性" },
];

export default function AdminEventTemplatesPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [filterType, setFilterType] = useState<"all" | "饭局" | "酒局">("all");
  
  const [formData, setFormData] = useState({
    name: "",
    eventType: "饭局",
    dayOfWeek: "5",
    timeOfDay: "19:00",
    theme: "",
    genderRestriction: "none",
    minAge: "",
    maxAge: "",
    minParticipants: "5",
    maxParticipants: "10",
    customPrice: "",
  });

  const { toast } = useToast();

  const { data: templates = [], isLoading } = useQuery<EventTemplate[]>({
    queryKey: ["/api/admin/event-templates"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/admin/event-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-templates"] });
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: "模板创建成功",
        description: "活动模板已成功添加到系统",
      });
    },
    onError: () => {
      toast({
        title: "创建失败",
        description: "无法创建模板，请重试",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      fetch(`/api/admin/event-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-templates"] });
      setShowEditDialog(false);
      setSelectedTemplate(null);
      toast({
        title: "更新成功",
        description: "模板信息已更新",
      });
    },
    onError: () => {
      toast({
        title: "更新失败",
        description: "无法更新模板，请重试",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/event-templates/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-templates"] });
      setShowDeleteDialog(false);
      setSelectedTemplate(null);
      toast({
        title: "删除成功",
        description: "模板已从系统中删除",
      });
    },
    onError: () => {
      toast({
        title: "删除失败",
        description: "无法删除模板，请重试",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      eventType: "饭局",
      dayOfWeek: "5",
      timeOfDay: "19:00",
      theme: "",
      genderRestriction: "none",
      minAge: "",
      maxAge: "",
      minParticipants: "5",
      maxParticipants: "10",
      customPrice: "",
    });
  };

  const handleCreate = () => {
    if (!formData.name || !formData.eventType || !formData.dayOfWeek || !formData.timeOfDay) {
      toast({
        title: "信息不完整",
        description: "请填写所有必填字段",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      name: formData.name,
      eventType: formData.eventType,
      dayOfWeek: parseInt(formData.dayOfWeek),
      timeOfDay: formData.timeOfDay,
      theme: formData.theme || undefined,
      genderRestriction: formData.genderRestriction === "none" ? undefined : formData.genderRestriction,
      minAge: formData.minAge ? parseInt(formData.minAge) : undefined,
      maxAge: formData.maxAge ? parseInt(formData.maxAge) : undefined,
      minParticipants: parseInt(formData.minParticipants),
      maxParticipants: parseInt(formData.maxParticipants),
      customPrice: formData.customPrice ? parseInt(formData.customPrice) : undefined,
    });
  };

  const handleEdit = (template: EventTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      eventType: template.eventType,
      dayOfWeek: template.dayOfWeek.toString(),
      timeOfDay: template.timeOfDay,
      theme: template.theme || "",
      genderRestriction: template.genderRestriction || "none",
      minAge: template.minAge?.toString() || "",
      maxAge: template.maxAge?.toString() || "",
      minParticipants: template.minParticipants.toString(),
      maxParticipants: template.maxParticipants.toString(),
      customPrice: template.customPrice?.toString() || "",
    });
    setShowEditDialog(true);
  };

  const handleUpdate = () => {
    if (!selectedTemplate) return;

    updateMutation.mutate({
      id: selectedTemplate.id,
      data: {
        name: formData.name,
        eventType: formData.eventType,
        dayOfWeek: parseInt(formData.dayOfWeek),
        timeOfDay: formData.timeOfDay,
        theme: formData.theme || null,
        genderRestriction: formData.genderRestriction === "none" ? null : formData.genderRestriction,
        minAge: formData.minAge ? parseInt(formData.minAge) : null,
        maxAge: formData.maxAge ? parseInt(formData.maxAge) : null,
        minParticipants: parseInt(formData.minParticipants),
        maxParticipants: parseInt(formData.maxParticipants),
        customPrice: formData.customPrice ? parseInt(formData.customPrice) : null,
      },
    });
  };

  const handleDelete = (template: EventTemplate) => {
    setSelectedTemplate(template);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (selectedTemplate) {
      deleteMutation.mutate(selectedTemplate.id);
    }
  };

  const toggleActive = (template: EventTemplate) => {
    updateMutation.mutate({
      id: template.id,
      data: { isActive: !template.isActive },
    });
  };

  const filteredTemplates = filterType === "all" 
    ? templates 
    : templates.filter(t => t.eventType === filterType);

  const activeTemplates = templates.filter(t => t.isActive).length;
  const weeklyEvents = templates.filter(t => t.isActive).length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">活动模板管理</h1>
          <p className="text-muted-foreground mt-1">管理周期性活动时段和主题</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} data-testid="button-create-template">
          <Plus className="h-4 w-4 mr-2" />
          创建模板
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总模板数</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-total-templates">{templates.length}</div>
            <p className="text-xs text-muted-foreground">全部活动模板</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃模板</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-active-templates">{activeTemplates}</div>
            <p className="text-xs text-muted-foreground">当前启用模板</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本周活动数</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="metric-weekly-events">{weeklyEvents}</div>
            <p className="text-xs text-muted-foreground">预计本周举办</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)}>
        <TabsList>
          <TabsTrigger value="all" data-testid="filter-all">全部</TabsTrigger>
          <TabsTrigger value="饭局" data-testid="filter-dinner">饭局</TabsTrigger>
          <TabsTrigger value="酒局" data-testid="filter-drinks">酒局</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {filterType === "all" ? "暂无模板记录" : `暂无${filterType}模板`}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} data-testid={`card-template-${template.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                    {template.name}
                    <Badge variant="outline">{template.eventType}</Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3" />
                    {DAY_OF_WEEK_MAP[template.dayOfWeek]} {template.timeOfDay}
                  </p>
                </div>
                {template.isActive ? (
                  <Badge className="bg-green-500">活跃</Badge>
                ) : (
                  <Badge variant="secondary">已停用</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  {template.theme && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">主题</span>
                      <span className="font-medium">{template.theme}</span>
                    </div>
                  )}
                  {template.genderRestriction && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">性别限制</span>
                      <span className="font-medium">
                        {template.genderRestriction === "Woman" ? "仅限女性" : "仅限男性"}
                      </span>
                    </div>
                  )}
                  {(template.minAge || template.maxAge) && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">年龄范围</span>
                      <span className="font-medium">
                        {template.minAge || "不限"} - {template.maxAge || "不限"} 岁
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">参与人数</span>
                    <span className="font-medium">
                      {template.minParticipants}-{template.maxParticipants} 人
                    </span>
                  </div>
                  {template.customPrice && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">价格</span>
                      <span className="font-medium">¥{template.customPrice}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <div className="flex items-center gap-2 flex-1">
                    <Switch
                      checked={template.isActive}
                      onCheckedChange={() => toggleActive(template)}
                      data-testid={`switch-active-${template.id}`}
                    />
                    <span className="text-sm text-muted-foreground">
                      {template.isActive ? "已启用" : "已停用"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(template)}
                    data-testid={`button-edit-${template.id}`}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    编辑
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(template)}
                    data-testid={`button-delete-${template.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>创建活动模板</DialogTitle>
            <DialogDescription>创建新的周期性活动模板</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">模板名称 *</Label>
                <Input
                  id="name"
                  placeholder="例：周五女生局"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventType">活动类型 *</Label>
                <Select value={formData.eventType} onValueChange={(v) => setFormData({ ...formData, eventType: v })}>
                  <SelectTrigger data-testid="select-event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dayOfWeek">星期 *</Label>
                <Select value={formData.dayOfWeek} onValueChange={(v) => setFormData({ ...formData, dayOfWeek: v })}>
                  <SelectTrigger data-testid="select-day-of-week">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DAY_OF_WEEK_MAP).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeOfDay">时间 *</Label>
                <Input
                  id="timeOfDay"
                  type="time"
                  value={formData.timeOfDay}
                  onChange={(e) => setFormData({ ...formData, timeOfDay: e.target.value })}
                  data-testid="input-time-of-day"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">主题</Label>
              <Input
                id="theme"
                placeholder="例：Girls Night, 商务社交"
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                data-testid="input-theme"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="genderRestriction">性别限制</Label>
              <Select value={formData.genderRestriction} onValueChange={(v) => setFormData({ ...formData, genderRestriction: v })}>
                <SelectTrigger data-testid="select-gender-restriction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_RESTRICTIONS.map(restriction => (
                    <SelectItem key={restriction.value} value={restriction.value}>{restriction.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minAge">最小年龄</Label>
                <Input
                  id="minAge"
                  type="number"
                  min="18"
                  max="100"
                  placeholder="无限制"
                  value={formData.minAge}
                  onChange={(e) => setFormData({ ...formData, minAge: e.target.value })}
                  data-testid="input-min-age"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxAge">最大年龄</Label>
                <Input
                  id="maxAge"
                  type="number"
                  min="18"
                  max="100"
                  placeholder="无限制"
                  value={formData.maxAge}
                  onChange={(e) => setFormData({ ...formData, maxAge: e.target.value })}
                  data-testid="input-max-age"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minParticipants">最少参与人数 *</Label>
                <Input
                  id="minParticipants"
                  type="number"
                  min="2"
                  value={formData.minParticipants}
                  onChange={(e) => setFormData({ ...formData, minParticipants: e.target.value })}
                  data-testid="input-min-participants"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxParticipants">最多参与人数 *</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  min="2"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                  data-testid="input-max-participants"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customPrice">自定义价格 (¥)</Label>
              <Input
                id="customPrice"
                type="number"
                min="0"
                placeholder="默认：会员免费/非会员¥68"
                value={formData.customPrice}
                onChange={(e) => setFormData({ ...formData, customPrice: e.target.value })}
                data-testid="input-custom-price"
              />
              <p className="text-xs text-muted-foreground">留空则使用默认定价</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              data-testid="button-cancel-create"
            >
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending ? "创建中..." : "创建模板"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>编辑活动模板</DialogTitle>
            <DialogDescription>修改活动模板信息</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">模板名称 *</Label>
                <Input
                  id="edit-name"
                  placeholder="例：周五女生局"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="input-edit-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-eventType">活动类型 *</Label>
                <Select value={formData.eventType} onValueChange={(v) => setFormData({ ...formData, eventType: v })}>
                  <SelectTrigger data-testid="select-edit-event-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-dayOfWeek">星期 *</Label>
                <Select value={formData.dayOfWeek} onValueChange={(v) => setFormData({ ...formData, dayOfWeek: v })}>
                  <SelectTrigger data-testid="select-edit-day-of-week">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DAY_OF_WEEK_MAP).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-timeOfDay">时间 *</Label>
                <Input
                  id="edit-timeOfDay"
                  type="time"
                  value={formData.timeOfDay}
                  onChange={(e) => setFormData({ ...formData, timeOfDay: e.target.value })}
                  data-testid="input-edit-time-of-day"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-theme">主题</Label>
              <Input
                id="edit-theme"
                placeholder="例：Girls Night, 商务社交"
                value={formData.theme}
                onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
                data-testid="input-edit-theme"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-genderRestriction">性别限制</Label>
              <Select value={formData.genderRestriction} onValueChange={(v) => setFormData({ ...formData, genderRestriction: v })}>
                <SelectTrigger data-testid="select-edit-gender-restriction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_RESTRICTIONS.map(restriction => (
                    <SelectItem key={restriction.value} value={restriction.value}>{restriction.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-minAge">最小年龄</Label>
                <Input
                  id="edit-minAge"
                  type="number"
                  min="18"
                  max="100"
                  placeholder="无限制"
                  value={formData.minAge}
                  onChange={(e) => setFormData({ ...formData, minAge: e.target.value })}
                  data-testid="input-edit-min-age"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-maxAge">最大年龄</Label>
                <Input
                  id="edit-maxAge"
                  type="number"
                  min="18"
                  max="100"
                  placeholder="无限制"
                  value={formData.maxAge}
                  onChange={(e) => setFormData({ ...formData, maxAge: e.target.value })}
                  data-testid="input-edit-max-age"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-minParticipants">最少参与人数 *</Label>
                <Input
                  id="edit-minParticipants"
                  type="number"
                  min="2"
                  value={formData.minParticipants}
                  onChange={(e) => setFormData({ ...formData, minParticipants: e.target.value })}
                  data-testid="input-edit-min-participants"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-maxParticipants">最多参与人数 *</Label>
                <Input
                  id="edit-maxParticipants"
                  type="number"
                  min="2"
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })}
                  data-testid="input-edit-max-participants"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-customPrice">自定义价格 (¥)</Label>
              <Input
                id="edit-customPrice"
                type="number"
                min="0"
                placeholder="默认：会员免费/非会员¥68"
                value={formData.customPrice}
                onChange={(e) => setFormData({ ...formData, customPrice: e.target.value })}
                data-testid="input-edit-custom-price"
              />
              <p className="text-xs text-muted-foreground">留空则使用默认定价</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              data-testid="button-cancel-edit"
            >
              取消
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateMutation.isPending ? "更新中..." : "保存更改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除模板 "{selectedTemplate?.name}" 吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
