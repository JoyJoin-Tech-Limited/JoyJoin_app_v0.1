import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Users } from "lucide-react";
import { useEffect } from "react";

// ❌ DEPRECATED: EditSocialPage - All fields removed from UI
// This page is kept for routing compatibility but shows no editable fields
// Fields (icebreakerRole, socialStyle) are kept in DB for backward compatibility

const socialSchema = z.object({
  // ❌ DEPRECATED: icebreakerRole - hidden from UI but kept in DB for backward compatibility
  // ❌ DEPRECATED: socialStyle - hidden from UI but kept in DB for backward compatibility
});

type SocialForm = z.infer<typeof socialSchema>;

const icebreakerRoleOptions = [
  { value: "starter", label: "话题发起者", description: "喜欢主动开启话题" },
  { value: "listener", label: "倾听者", description: "擅长倾听和理解他人" },
  { value: "responder", label: "积极回应者", description: "善于回应和互动" },
  { value: "observer", label: "安静观察者", description: "偏好先观察再参与" },
  { value: "connector", label: "连接者", description: "喜欢帮助他人建立联系" },
];

const socialStyleOptions = [
  { value: "extrovert", label: "外向型", description: "从社交中获取能量" },
  { value: "introvert", label: "内向型", description: "需要独处充电" },
  { value: "ambivert", label: "中间型", description: "视情况而定" },
  { value: "energetic", label: "活力型", description: "喜欢热闹活跃的氛围" },
  { value: "calm", label: "沉稳型", description: "偏好安静平和的交流" },
];

export default function EditSocialPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const form = useForm<SocialForm>({
    resolver: zodResolver(socialSchema),
    defaultValues: {
      // ❌ DEPRECATED: All fields removed from UI
    },
  });

  // ❌ DEPRECATED: useEffect removed - no fields to populate

  const updateMutation = useMutation({
    mutationFn: async (data: SocialForm) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      // Redirect back since there are no fields to edit
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

  const onSubmit = (data: SocialForm) => {
    // ❌ DEPRECATED: No fields to submit, just redirect back
    setLocation("/profile/edit");
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
          <h1 className="ml-2 text-lg font-semibold">社交风格</h1>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6 max-w-2xl mx-auto pb-24">
        {/* ❌ DEPRECATED: All social preference fields removed from UI */}
        
        <div className="text-center py-12 space-y-4">
          <Users className="h-16 w-16 mx-auto text-muted-foreground/50" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-muted-foreground">社交风格设置已迁移</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              社交偏好设置已整合到其他设置页面中，请返回查看其他可编辑选项。
            </p>
          </div>
          <Button 
            type="button"
            onClick={() => setLocation("/profile/edit")}
            variant="outline"
            className="mt-4"
          >
            返回资料编辑
          </Button>
        </div>

        {/* ❌ DEPRECATED: Icebreaker Role section removed */}
        {/* ❌ DEPRECATED: Social Style section removed */}

        {/* Save button removed - no fields to save */}
      </form>
    </div>
  );
}
