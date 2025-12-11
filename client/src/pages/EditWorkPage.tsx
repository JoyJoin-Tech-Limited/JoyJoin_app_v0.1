import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const workSchema = z.object({
  industry: z.string().optional(),
  roleTitleShort: z.string().optional(),
  seniority: z.enum(["Intern", "Junior", "Mid", "Senior", "Founder", "Executive"]).optional(),
  workVisibility: z.enum(["hide_all", "show_industry_only"]).optional(),
});

type WorkForm = z.infer<typeof workSchema>;

const industryOptions = [
  "大厂", "金融", "科技初创", "AI/ML", "跨境电商", "投资",
  "咨询", "消费品", "艺术/设计", "教育", "医疗", "政府/公共", "其他"
];

export default function EditWorkPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const form = useForm<WorkForm>({
    resolver: zodResolver(workSchema),
    defaultValues: {
      industry: user?.industry || "",
      roleTitleShort: user?.roleTitleShort || "",
      seniority: user?.seniority || undefined,
      workVisibility: user?.workVisibility || "show_industry_only",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: WorkForm) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "保存成功",
        description: "工作信息已更新",
      });
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
    // Clean up empty strings - send undefined instead of empty string for optional fields
    const cleanedData = {
      ...data,
      industry: data.industry && data.industry.trim() !== '' ? data.industry : undefined,
      roleTitleShort: data.roleTitleShort && data.roleTitleShort.trim() !== '' ? data.roleTitleShort : undefined,
    };
    updateMutation.mutate(cleanedData);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center h-14 px-4">
          <Button 
            variant="ghost" 
            size="icon"
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
        {/* Industry */}
        <div className="space-y-2">
          <Label>行业</Label>
          <div className="space-y-3 mt-2">
            {industryOptions.map((ind) => (
              <button
                key={ind}
                type="button"
                onClick={() => form.setValue("industry", ind)}
                className={`
                  w-full px-5 py-4 text-left rounded-lg border transition-all text-base
                  ${form.watch("industry") === ind
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border hover-elevate active-elevate-2'
                  }
                `}
                data-testid={`button-industry-${ind}`}
              >
                {ind}
              </button>
            ))}
          </div>
        </div>

        {/* Role Title */}
        <div className="space-y-2">
          <Label htmlFor="roleTitleShort">职位</Label>
          <Input
            id="roleTitleShort"
            placeholder="例如：产品经理、软件工程师等"
            {...form.register("roleTitleShort")}
            data-testid="input-roleTitleShort"
          />
        </div>

        {/* Seniority */}
        <div className="space-y-2">
          <Label>资历</Label>
          <div className="space-y-3 mt-2">
            {[
              { value: "Intern", label: "实习生" },
              { value: "Junior", label: "初级" },
              { value: "Mid", label: "中级" },
              { value: "Senior", label: "高级" },
              { value: "Founder", label: "创始人" },
              { value: "Executive", label: "高管" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => form.setValue("seniority", option.value as any)}
                className={`
                  w-full px-5 py-4 text-left rounded-lg border transition-all text-base
                  ${form.watch("seniority") === option.value
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border hover-elevate active-elevate-2'
                  }
                `}
                data-testid={`button-seniority-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>
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
                className={`
                  w-full px-5 py-4 text-left rounded-lg border transition-all text-base
                  ${form.watch("workVisibility") === option.value
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border hover-elevate active-elevate-2'
                  }
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
            disabled={updateMutation.isPending}
            data-testid="button-save"
          >
            {updateMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </form>
    </div>
  );
}
