import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/ui/use-toast";
import { Loader2, Save, RefreshCw, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface FeatureFlagItem {
  key: string;
  value: boolean;
  source: "db" | "env" | "fallback";
  updatedAt: string | null;
  updatedBy: string | null;
}

const DANGEROUS_FLAGS = ["onboardingForceSkip", "socialIcebreakerClientForceEnd", "flashShenzhenLocationGateEnabled", "flashTaskRetryTestEnabled"];

export default function AdminFeatureFlagsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean>>({});
  const [pendingToggle, setPendingToggle] = useState<string | null>(null);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery<{ flags: FeatureFlagItem[] }>({
    queryKey: ["/api/admin/feature-flags"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      await apiRequest("PUT", `/api/admin/feature-flags/${encodeURIComponent(key)}`, {
        value: String(value),
      });
      return { key, value };
    },
    onSuccess: ({ key }) => {
      toast({ title: "配置已更新", description: `${flagLabels[key] ?? key} 已保存并生效` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    onError: (err: Error, { key }) => {
      toast({
        title: `${flagLabels[key] ?? key} 更新失败`,
        description: err.message,
        variant: "destructive",
      });
      // Revert local override on error
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    onSettled: (_data, _err, { key }) => {
      setSavingKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
  });

  const flags = data?.flags ?? [];

  const displayValue = (flag: FeatureFlagItem) =>
    localOverrides[flag.key] !== undefined ? localOverrides[flag.key] : flag.value;

  const hasChanges = Object.keys(localOverrides).length > 0;

  const handleToggle = (key: string) => {
    const flag = flags.find((f) => f.key === key);
    if (!flag) return;

    const nextValue = !displayValue(flag);

    // The Flash location restriction is dangerous when disabling; other dangerous flags confirm on enable.
    const needsConfirmation = key === "flashShenzhenLocationGateEnabled"
      ? nextValue === false
      : DANGEROUS_FLAGS.includes(key) && nextValue === true;
    if (needsConfirmation) {
      setPendingToggle(key);
      return;
    }

    setLocalOverrides((prev) => ({ ...prev, [key]: nextValue }));
  };

  const confirmDangerousToggle = () => {
    if (!pendingToggle) return;
    const flag = flags.find((f) => f.key === pendingToggle);
    if (flag) {
      setLocalOverrides((prev) => ({ ...prev, [pendingToggle]: !displayValue(flag) }));
    }
    setPendingToggle(null);
  };

  const handleSave = async () => {
    const entries = Object.entries(localOverrides);
    if (entries.length === 0) return;

    setSavingKeys(new Set(entries.map(([k]) => k)));

    // Sequential saves to avoid race conditions on the same row
    for (const [key, value] of entries) {
      await updateMutation.mutateAsync({ key, value });
    }
  };

  const flagLabels: Record<string, string> = {
    flashTaskRetryTestEnabled: "街头盲盒：允许同任务反复测试",
    restartOnboarding: "允许用户重启 onboarding",
    smartProfession: "智能职业理解 (SMART_PROFESSION_V1)",
    onboardingForceSkip: "Onboarding 强制跳过（测试专用）",
    matchingLiveReveal: "匹配结果实时揭晓",
    socialIcebreakerClientForceEnd: "破冰会话客户端强制结束",
    flashShenzhenLocationGateEnabled: "闪现深圳定位限制",
  };

  const flagDescriptions: Record<string, string> = {
    flashTaskRetryTestEnabled: "仅非生产环境生效。开启后，测试用户可在任务进行页或反馈页直接从头复测同一任务，不必先走到最终交付。",
    restartOnboarding: "开启后，已完成 onboarding 的用户可在设置中重置进度",
    smartProfession: "开启后，用户使用自由文本输入职业时会触发 AI 分类",
    onboardingForceSkip: "⚠️ 危险：开启后所有用户都会在 onboarding 页面看到「跳过」按钮",
    matchingLiveReveal: "开启后，用户在匹配状态页可实时看到桌友揭晓动画",
    socialIcebreakerClientForceEnd: "⚠️ 危险：开启后主持人可在客户端强制结束破冰会话",
    flashShenzhenLocationGateEnabled: "开启时仅允许深圳 GPS；关闭后非生产环境可在深圳外测试。生产环境始终锁定。",
  };

  const pendingFlag = pendingToggle ? flags.find((f) => f.key === pendingToggle) : null;
  const pendingDisablesLocationGate = pendingToggle === "flashShenzhenLocationGateEnabled";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">功能开关</h1>
          <p className="text-muted-foreground">运行时功能标志与 kill switch 管理</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading || updateMutation.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            刷新
          </Button>
          {hasChanges && (
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              保存更改
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : flags.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <AlertCircle className="h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm">暂无功能开关配置</p>
          <p className="text-xs mt-1">请检查服务端配置是否正确加载</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {flags.map((flag) => {
            const current = displayValue(flag);
            const changed = localOverrides[flag.key] !== undefined;
            const isSaving = savingKeys.has(flag.key);
            return (
              <Card key={flag.key} className={changed ? "border-primary" : undefined}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <CardTitle className="text-base">
                        {flagLabels[flag.key] ?? flag.key}
                        {changed && (
                          <span className="ml-2 text-xs font-normal text-primary">(已修改)</span>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {flagDescriptions[flag.key] ?? ""}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs font-medium ${
                          current ? "text-green-600" : "text-muted-foreground"
                        }`}
                      >
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin inline" />
                        ) : current ? (
                          "已开启"
                        ) : (
                          "已关闭"
                        )}
                      </span>
                      <Switch
                        id={flag.key}
                        checked={current}
                        onCheckedChange={() => handleToggle(flag.key)}
                        disabled={isSaving}
                        data-testid={`switch-feature-flag-${flag.key}`}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>来源: {flag.source === "db" ? "数据库" : flag.source === "env" ? "环境变量" : "默认值"}</span>
                    <span>键名: {flag.key}</span>
                    {flag.updatedAt && (
                      <span>更新时间: {new Date(flag.updatedAt).toLocaleString("zh-CN")}</span>
                    )}
                    {flag.updatedBy && (
                      <span>操作人: {flag.updatedBy}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!pendingToggle} onOpenChange={(open) => !open && setPendingToggle(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingDisablesLocationGate ? "确认关闭定位限制" : "确认开启危险开关"}</DialogTitle>
            <DialogDescription>
              {pendingFlag
                ? `你即将开启「${flagLabels[pendingFlag.key] ?? pendingFlag.key}」。${flagDescriptions[pendingFlag.key] ?? ""}`
                : "确认要开启此功能开关吗？"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingToggle(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDangerousToggle}>
              {pendingDisablesLocationGate ? "确认关闭限制" : "确认开启"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
