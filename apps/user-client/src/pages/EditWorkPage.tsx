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

// Industry category options aligned with the 3-tier taxonomy (Layer 1 categories).
// These ids/labels mirror INDUSTRY_TAXONOMY in packages/shared/src/industryTaxonomy.ts.
const INDUSTRY_CATEGORY_OPTIONS: Array<{ id: string; label: string; icon: string }> = [
  { id: "finance",              label: "金融服务",       icon: "💰" },
  { id: "tech",                 label: "科技互联网",     icon: "💻" },
  { id: "manufacturing",        label: "制造业",         icon: "🏭" },
  { id: "consumer_retail",      label: "消费品/零售",    icon: "🛍️" },
  { id: "real_estate",          label: "房地产/建筑",    icon: "🏗️" },
  { id: "healthcare",           label: "医疗健康",       icon: "🏥" },
  { id: "education",            label: "教育培训",       icon: "📚" },
  { id: "professional_services",label: "专业服务",       icon: "💼" },
  { id: "media_creative",       label: "传媒/创意",      icon: "🎨" },
  { id: "logistics",            label: "物流/供应链",    icon: "📦" },
  { id: "government_public",    label: "政府/公共服务",  icon: "🏛️" },
  { id: "life_services",        label: "生活服务",       icon: "🛎️" },
  { id: "energy_environment",   label: "能源/环保",      icon: "🔋" },
  { id: "agriculture_food",     label: "农业/食品",      icon: "🌾" },
  { id: "culture_sports",       label: "文化/体育",      icon: "⚽" },
];

const workSchema = z.object({
  // Current 3-tier taxonomy fields (Layer 1 category).  These replace the
  // legacy `industry` flat-string field which is no longer in the active
  // updateFullProfileSchema and should not be used in new code.
  industryCategory: z.string().optional(),
  industryCategoryLabel: z.string().optional(),
  roleTitleShort: z.string().optional(),
  workVisibility: z.enum(["hide_all", "show_industry_only"]).optional(),
});

type WorkForm = z.infer<typeof workSchema>;

export default function EditWorkPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  // Derive the currently-selected category id from the stored `industryCategory`
  // field.  Also accept `industryCategoryLabel` as a display fallback.
  const form = useForm<WorkForm>({
    resolver: zodResolver(workSchema),
    defaultValues: {
      industryCategory: user?.industryCategory || "",
      industryCategoryLabel: user?.industryCategoryLabel || "",
      roleTitleShort: user?.roleTitleShort || "",
      workVisibility: user?.workVisibility || "show_industry_only",
    },
  });

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
    const cleanedData = {
      ...data,
      industryCategory: data.industryCategory && data.industryCategory.trim() !== '' ? data.industryCategory : undefined,
      industryCategoryLabel: data.industryCategoryLabel && data.industryCategoryLabel.trim() !== '' ? data.industryCategoryLabel : undefined,
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

  const selectedCategory = form.watch("industryCategory");

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
        {/* Industry Category (Layer 1) */}
        <div className="space-y-2">
          <Label>行业大类</Label>
          <div className="space-y-3 mt-2">
            {INDUSTRY_CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  form.setValue("industryCategory", cat.id);
                  form.setValue("industryCategoryLabel", cat.label);
                }}
                className={`
                  w-full px-5 py-4 text-left rounded-lg border transition-all text-base flex items-center gap-3
                  ${selectedCategory === cat.id
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border hover-elevate active-elevate-2'
                  }
                `}
                data-testid={`button-industry-${cat.id}`}
              >
                <span className="text-xl">{cat.icon}</span>
                <span>{cat.label}</span>
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
