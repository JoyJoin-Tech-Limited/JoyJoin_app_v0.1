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

const socialSchema = z.object({
  icebreakerRole: z.string().optional(),
  socialStyle: z.string().optional(),
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
      icebreakerRole: undefined,
      socialStyle: undefined,
    },
  });

  useEffect(() => {
    if (user) {
      form.setValue("icebreakerRole", user.icebreakerRole || undefined);
      form.setValue("socialStyle", user.socialStyle || undefined);
    }
  }, [user, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: SocialForm) => {
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

  const onSubmit = (data: SocialForm) => {
    updateMutation.mutate(data);
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
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            破冰角色
          </Label>
          <p className="text-xs text-muted-foreground">
            在社交场合，你通常扮演什么角色？
          </p>
          <div className="space-y-2 mt-2">
            {icebreakerRoleOptions.map((option) => {
              const isSelected = form.watch("icebreakerRole") === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => form.setValue("icebreakerRole", isSelected ? undefined : option.value)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover-elevate"
                  }`}
                  data-testid={`option-icebreaker-${option.value}`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            社交风格
          </Label>
          <p className="text-xs text-muted-foreground">
            你的社交能量类型是？
          </p>
          <div className="space-y-2 mt-2">
            {socialStyleOptions.map((option) => {
              const isSelected = form.watch("socialStyle") === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => form.setValue("socialStyle", isSelected ? undefined : option.value)}
                  className={`w-full text-left p-4 rounded-lg border transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover-elevate"
                  }`}
                  data-testid={`option-style-${option.value}`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button 
            type="submit" 
            className="w-full max-w-2xl mx-auto block"
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
