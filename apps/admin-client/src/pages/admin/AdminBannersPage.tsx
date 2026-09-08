import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/auth/useAuth";
import { fmtDateTimeLocal, fmtDateTimeShort } from "@/lib/dateUtils";
import { useToast } from "@/hooks/ui/use-toast";
import AdminQueryError from "@/components/admin/AdminQueryError";
import EmptyState from "@/components/admin/EmptyState";

interface Banner {
  id: string;
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
  linkType: string | null;
  placement: string | null;
  city: string | null;
  sortOrder: number | null;
  isActive: boolean | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface BannerFormState {
  imageUrl: string;
  title: string;
  subtitle: string;
  linkUrl: string;
  linkType: string;
  placement: string;
  city: string;
  sortOrder: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveUntil: string;
}

const EMPTY_FORM: BannerFormState = {
  imageUrl: "",
  title: "",
  subtitle: "",
  linkUrl: "",
  linkType: "internal",
  placement: "discover",
  city: "",
  sortOrder: "0",
  isActive: true,
  effectiveFrom: "",
  effectiveUntil: "",
};

const PLACEMENT_LABELS: Record<string, string> = {
  discover: "发现页",
  landing: "落地页",
  both: "两处都显示",
};

const LINK_TYPE_LABELS: Record<string, string> = {
  internal: "站内",
  external: "外链",
  none: "无链接",
};

function toIsoOrNull(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function stripStatusPrefix(message: string): string {
  return message.replace(/^\d{3}:\s*/, "");
}

export default function AdminBannersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canMutate = user?.adminRole !== "viewer";
  const [showEditor, setShowEditor] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [deletingBanner, setDeletingBanner] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);

  const {
    data: banners = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Banner[]>({
    queryKey: ["/api/admin/banners"],
  });

  const invalidateBanners = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      const res = id
        ? await apiRequest("PATCH", `/api/admin/banners/${id}`, payload)
        : await apiRequest("POST", "/api/admin/banners", payload);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidateBanners();
      setShowEditor(false);
      setEditingBanner(null);
      setForm(EMPTY_FORM);
      toast({
        title: variables.id ? "横幅已更新" : "横幅已创建",
        description: variables.id ? "横幅信息已保存" : "新横幅已上线（按生效时间展示）",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "保存失败",
        description: stripStatusPrefix(err.message) || "无法保存横幅，请重试",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/banners/${id}`, { isActive });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      invalidateBanners();
      toast({
        title: variables.isActive ? "横幅已启用" : "横幅已停用",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "状态更新失败",
        description: stripStatusPrefix(err.message) || "无法更新横幅状态，请重试",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/banners/${id}`);
      return res.json();
    },
    onSuccess: () => {
      invalidateBanners();
      setDeletingBanner(null);
      toast({ title: "横幅已删除" });
    },
    onError: (err: Error) => {
      toast({
        title: "删除失败",
        description: stripStatusPrefix(err.message) || "无法删除横幅，请重试",
        variant: "destructive",
      });
    },
  });

  const openCreate = () => {
    setEditingBanner(null);
    setForm(EMPTY_FORM);
    setShowEditor(true);
  };

  const openEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setForm({
      imageUrl: banner.imageUrl ?? "",
      title: banner.title ?? "",
      subtitle: banner.subtitle ?? "",
      linkUrl: banner.linkUrl ?? "",
      linkType: banner.linkType ?? "internal",
      placement: banner.placement ?? "discover",
      city: banner.city ?? "",
      sortOrder: String(banner.sortOrder ?? 0),
      isActive: banner.isActive ?? true,
      effectiveFrom: fmtDateTimeLocal(banner.effectiveFrom),
      effectiveUntil: fmtDateTimeLocal(banner.effectiveUntil),
    });
    setShowEditor(true);
  };

  const handleSubmit = () => {
    if (!form.imageUrl.trim()) {
      toast({ title: "请填写图片 URL", variant: "destructive" });
      return;
    }
    if (!form.title.trim()) {
      toast({ title: "请填写标题", variant: "destructive" });
      return;
    }
    const sortOrder = parseInt(form.sortOrder, 10);
    if (Number.isNaN(sortOrder) || sortOrder < 0) {
      toast({ title: "排序必须是不小于 0 的整数", variant: "destructive" });
      return;
    }

    saveMutation.mutate({
      id: editingBanner?.id,
      payload: {
        imageUrl: form.imageUrl.trim(),
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        linkUrl: form.linkUrl.trim() || null,
        linkType: form.linkType,
        placement: form.placement,
        city: form.city.trim() || null,
        sortOrder,
        isActive: form.isActive,
        effectiveFrom: toIsoOrNull(form.effectiveFrom),
        effectiveUntil: toIsoOrNull(form.effectiveUntil),
      },
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">横幅管理</h1>
          <p className="text-muted-foreground mt-1">横幅展示在小程序发现页顶部轮播。</p>
        </div>
        {canMutate && (
          <Button onClick={openCreate} data-testid="button-create-banner">
            <Plus className="h-4 w-4 mr-2" />
            新建横幅
          </Button>
        )}
      </div>

      {isError ? (
        <AdminQueryError title="横幅加载失败" error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : banners.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState title="暂无横幅" description="点击右上角「新建横幅」创建第一条轮播" />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">缩略图</TableHead>
                <TableHead>标题</TableHead>
                <TableHead>位置</TableHead>
                <TableHead>城市</TableHead>
                <TableHead className="w-16">排序</TableHead>
                <TableHead>生效区间</TableHead>
                <TableHead className="w-20">状态</TableHead>
                <TableHead className="w-32 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {banners.map((banner) => (
                <TableRow key={banner.id} data-testid={`row-banner-${banner.id}`}>
                  <TableCell>
                    {banner.imageUrl ? (
                      <img
                        src={banner.imageUrl}
                        alt={banner.title ?? "banner"}
                        className="h-12 w-20 rounded object-cover border"
                      />
                    ) : (
                      <div className="h-12 w-20 rounded border flex items-center justify-center bg-muted">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{banner.title || "—"}</p>
                      {banner.subtitle && (
                        <p className="text-xs text-muted-foreground truncate max-w-48">{banner.subtitle}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {PLACEMENT_LABELS[banner.placement ?? ""] ?? banner.placement ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>{banner.city || "全部城市"}</TableCell>
                  <TableCell>{banner.sortOrder ?? 0}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {fmtDateTimeShort(banner.effectiveFrom)}
                    <br />至 {banner.effectiveUntil ? fmtDateTimeShort(banner.effectiveUntil) : "永久"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={banner.isActive ?? false}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: banner.id, isActive: checked })
                      }
                      disabled={!canMutate || toggleMutation.isPending}
                      data-testid={`switch-active-${banner.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {canMutate && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(banner)}
                          data-testid={`button-edit-${banner.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingBanner(banner)}
                          data-testid={`button-delete-${banner.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBanner ? "编辑横幅" : "新建横幅"}</DialogTitle>
            <DialogDescription>
              {editingBanner ? "修改横幅信息" : "创建一条发现页顶部轮播横幅"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="imageUrl">图片 URL *</Label>
              <Input
                id="imageUrl"
                placeholder="https://joyjoinapp.com/static/banner.webp"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                data-testid="input-image-url"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">标题 *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subtitle">副标题</Label>
                <Input
                  id="subtitle"
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  data-testid="input-subtitle"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="linkUrl">跳转链接</Label>
                <Input
                  id="linkUrl"
                  placeholder="/pages/event-detail?id=..."
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  data-testid="input-link-url"
                />
              </div>
              <div className="space-y-2">
                <Label>链接类型</Label>
                <Select value={form.linkType} onValueChange={(v) => setForm({ ...form, linkType: v })}>
                  <SelectTrigger data-testid="select-link-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LINK_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>展示位置</Label>
                <Select value={form.placement} onValueChange={(v) => setForm({ ...form, placement: v })}>
                  <SelectTrigger data-testid="select-placement">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLACEMENT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">城市（留空为全部）</Label>
                <Input
                  id="city"
                  placeholder="深圳"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  data-testid="input-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">排序（越小越靠前）</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  data-testid="input-sort-order"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveFrom">生效开始</Label>
                <Input
                  id="effectiveFrom"
                  type="datetime-local"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  data-testid="input-effective-from"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="effectiveUntil">生效结束（留空为永久）</Label>
                <Input
                  id="effectiveUntil"
                  type="datetime-local"
                  value={form.effectiveUntil}
                  onChange={(e) => setForm({ ...form, effectiveUntil: e.target.value })}
                  data-testid="input-effective-until"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                data-testid="switch-form-active"
              />
              <Label htmlFor="isActive">立即启用</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditor(false)}
              data-testid="button-cancel-editor"
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
              data-testid="button-submit-banner"
            >
              {saveMutation.isPending ? "保存中..." : editingBanner ? "保存修改" : "创建横幅"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingBanner} onOpenChange={(open) => !open && setDeletingBanner(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除横幅</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除横幅「{deletingBanner?.title || deletingBanner?.id}」吗？删除后将立即从发现页轮播中移除，该操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBanner && deleteMutation.mutate(deletingBanner.id)}
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
