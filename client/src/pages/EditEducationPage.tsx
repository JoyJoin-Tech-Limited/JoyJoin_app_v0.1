import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const educationSchema = z.object({
  educationLevel: z.enum(["Bachelor's", "Master's", "PhD", "Some college/Associate", "Trade/Vocational"]).optional(),
  fieldOfStudy: z.string().optional(),
  studyLocale: z.enum(["Local", "Overseas", "Both"]).optional(),
  overseasRegions: z.array(z.string()).optional(),
});

type EducationForm = z.infer<typeof educationSchema>;

const overseasRegionOptions = [
  "美国", "英国", "加拿大", "澳大利亚", "新西兰",
  "新加坡", "香港", "日本", "韩国", "德国", "法国", "其他"
];

export default function EditEducationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const form = useForm<EducationForm>({
    resolver: zodResolver(educationSchema),
    defaultValues: {
      educationLevel: user?.educationLevel || undefined,
      fieldOfStudy: user?.fieldOfStudy || "",
      studyLocale: user?.studyLocale || undefined,
      overseasRegions: user?.overseasRegions || [],
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EducationForm) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "保存成功",
        description: "教育背景已更新",
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

  const onSubmit = (data: EducationForm) => {
    // Clean up empty strings - send undefined instead of empty string for optional fields
    const cleanedData = {
      ...data,
      fieldOfStudy: data.fieldOfStudy && data.fieldOfStudy.trim() !== '' ? data.fieldOfStudy : undefined,
    };
    updateMutation.mutate(cleanedData);
  };

  const toggleRegion = (region: string) => {
    const current = form.watch("overseasRegions") || [];
    if (current.includes(region)) {
      form.setValue("overseasRegions", current.filter(r => r !== region));
    } else {
      form.setValue("overseasRegions", [...current, region]);
    }
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

  const studyLocale = form.watch("studyLocale");
  const selectedRegions = form.watch("overseasRegions") || [];
  const showOverseasRegions = studyLocale === "Overseas" || studyLocale === "Both";

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
          <h1 className="ml-2 text-lg font-semibold">教育背景</h1>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6 max-w-2xl mx-auto pb-24">
        {/* Education Level */}
        <div className="space-y-2">
          <Label>教育水平</Label>
          <div className="space-y-3 mt-2">
            {[
              { value: "High school/below", label: "高中及以下" },
              { value: "Some college/Associate", label: "大专/副学士" },
              { value: "Bachelor's", label: "本科" },
              { value: "Master's", label: "硕士" },
              { value: "PhD", label: "博士" },
              { value: "Trade/Vocational", label: "职业培训" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => form.setValue("educationLevel", option.value as any)}
                className={`
                  w-full px-5 py-4 text-left rounded-lg border transition-all text-base
                  ${form.watch("educationLevel") === option.value
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border hover-elevate active-elevate-2'
                  }
                `}
                data-testid={`button-education-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Field of Study */}
        <div className="space-y-2">
          <Label htmlFor="fieldOfStudy">专业领域</Label>
          <Input
            id="fieldOfStudy"
            placeholder="例如：计算机科学、金融等"
            {...form.register("fieldOfStudy")}
            data-testid="input-fieldOfStudy"
          />
        </div>

        {/* Study Locale */}
        <div className="space-y-2">
          <Label>学习地点</Label>
          <div className="space-y-3 mt-2">
            {[
              { value: "Local", label: "本地" },
              { value: "Overseas", label: "海外" },
              { value: "Both", label: "都有" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => form.setValue("studyLocale", option.value as any)}
                className={`
                  w-full px-5 py-4 text-left rounded-lg border transition-all text-base
                  ${form.watch("studyLocale") === option.value
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border hover-elevate active-elevate-2'
                  }
                `}
                data-testid={`button-study-locale-${option.value}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overseas Regions */}
        {showOverseasRegions && (
          <div className="space-y-3">
            <Label>海外地区</Label>
            <p className="text-xs text-muted-foreground">
              选择你在海外学习的地区
            </p>
            <div className="grid grid-cols-2 gap-2">
              {overseasRegionOptions.map((region) => (
                <button
                  key={region}
                  type="button"
                  onClick={() => toggleRegion(region)}
                  className={`
                    px-5 py-4 rounded-lg border transition-all text-left text-base
                    ${selectedRegions.includes(region)
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-border hover-elevate active-elevate-2'
                    }
                  `}
                  data-testid={`button-region-${region}`}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>
        )}

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
