import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Briefcase, Info } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WORK_MODE_TO_LABEL } from "@shared/occupations";

const workSchema = z.object({
  workVisibility: z.enum(["hide_all", "show_industry_only"]).optional(),
});

type WorkForm = z.infer<typeof workSchema>;

export default function EditWorkPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const form = useForm<WorkForm>({
    resolver: zodResolver(workSchema),
    defaultValues: {
      workVisibility: "show_industry_only",
    },
  });

  // Reset form with server-loaded value once user data is available
  useEffect(() => {
    if (user?.workVisibility) {
      form.reset({ workVisibility: user.workVisibility });
    }
  }, [user?.workVisibility, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: WorkForm) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/profile/edit");
    },
    onError: (error: Error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WorkForm) => {
    updateMutation.mutate(data);
  };

  // Build the full 3-tier industry label from structured classification fields
  const industryParts = [
    user?.industryCategoryLabel,
    user?.industrySegmentLabel,
    user?.industryNicheLabel,
  ].filter(Boolean);
  const industryDisplay = industryParts.length > 0 ? industryParts.join(" · ") : null;

  if (isLoading || !user) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center h-14 px-4">
          <Button 
            variant="ghost" 
            size="icon"
            aria-label="返回编辑资料页"
            onClick={() => setLocation("/profile/edit")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-2 text-lg font-semibold">工作信息</h1>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6 max-w-2xl mx-auto pb-24">
        {/* Current industry classification — read-only */}
        <div className="space-y-2">
          <Label>当前行业</Label>
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-muted/40 text-sm"
            data-testid="display-industry"
          >
            <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">
              {industryDisplay
                ? industryDisplay
                : user?.workMode && WORK_MODE_TO_LABEL[user.workMode as keyof typeof WORK_MODE_TO_LABEL]
                  ? <span className="text-muted-foreground">{WORK_MODE_TO_LABEL[user.workMode as keyof typeof WORK_MODE_TO_LABEL]}</span>
                  : <span className="text-muted-foreground">未设置</span>
              }
            </span>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            行业分类在注册时通过三级行业体系自动设定，暂不支持在此处单独修改。
          </p>
        </div>

        {/* Work Visibility */}
        <div className="space-y-2">
          <Label>工作信息可见性</Label>
          <p className="text-xs text-muted-foreground mb-2">
            控制其他人能看到你的多少工作信息
          </p>
          <div className="space-y-3">
            {[
              { value: "hide_all", label: "完全隐藏" },
              { value: "show_industry_only", label: "仅显示行业" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => form.setValue("workVisibility", option.value as any)}
                aria-pressed={form.watch("workVisibility") === option.value}
                className={`
                  w-full px-5 py-4 text-left rounded-xl border-2 transition-all duration-150 text-base
                  ${form.watch("workVisibility") === option.value
                    ? 'border-primary [background:var(--btn-primary-gradient)] text-primary-foreground font-semibold shadow-[var(--btn-shadow-primary)]'
                    : 'border-border hover-elevate active-elevate-2'
                  }
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                `}
                data-testid={`button-work-visibility-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button 
            type="submit" 
            className="w-full"
            loading={updateMutation.isPending}
            data-testid="button-save"
          >
            保存
          </Button>
        </div>
      </form>
    </div>
  );
}
