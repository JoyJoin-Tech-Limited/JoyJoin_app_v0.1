import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft } from "lucide-react";
import { intentOptions } from "@/lib/userFieldMappings";
import { useEffect } from "react";

const intentSchema = z.object({
  intent: z.array(z.enum(["networking", "friends", "discussion", "fun", "romance", "flexible"])).min(1, "请至少选择一个活动意图"),
});

type IntentForm = z.infer<typeof intentSchema>;

export default function EditIntentPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const form = useForm<IntentForm>({
    resolver: zodResolver(intentSchema),
    defaultValues: {
      intent: [],
    },
  });

  // Update form when user data loads
  useEffect(() => {
    if (user?.intent) {
      form.setValue("intent", Array.isArray(user.intent) ? user.intent : [user.intent]);
    }
  }, [user, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: IntentForm) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "保存成功",
        description: "活动意图已更新",
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

  // Toggle intent selection with flexible exclusivity logic
  const toggleIntent = (intentValue: "networking" | "friends" | "discussion" | "fun" | "romance" | "flexible") => {
    const current = form.watch("intent") || [];
    
    if (intentValue === "flexible") {
      // If selecting "flexible", clear all other intents
      if (current.includes("flexible")) {
        form.setValue("intent", []);
      } else {
        form.setValue("intent", ["flexible"]);
      }
    } else {
      // If selecting a specific intent
      if (current.includes(intentValue)) {
        // Deselect this intent
        form.setValue("intent", current.filter(i => i !== intentValue) as typeof current);
      } else {
        // Select this intent and remove "flexible" if present
        const newIntents = current.filter(i => i !== "flexible");
        form.setValue("intent", [...newIntents, intentValue] as typeof current);
      }
    }
  };

  const onSubmit = (data: IntentForm) => {
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
          <h1 className="ml-2 text-lg font-semibold">活动意图</h1>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-6 max-w-2xl mx-auto pb-24">
        <div className="space-y-2">
          <Label>默认活动意图 *</Label>
          <p className="text-xs text-muted-foreground mb-2">
            你参加活动的主要目的是什么？这是默认设置，加入活动时可以调整
          </p>
          <div className="space-y-3 mt-2">
            {intentOptions.map((option) => {
              const currentIntents = form.watch("intent") || [];
              const isSelected = currentIntents.includes(option.value);
              const isFlexible = option.value === "flexible";
              const hasFlexible = currentIntents.includes("flexible");
              const isDisabled = !isFlexible && hasFlexible;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleIntent(option.value)}
                  disabled={isDisabled}
                  className={`
                    w-full px-5 py-4 text-left rounded-lg border transition-all
                    ${isSelected
                      ? 'border-primary bg-primary/5 text-primary' 
                      : isDisabled
                      ? 'border-border bg-muted/30 text-muted-foreground cursor-not-allowed'
                      : 'border-border hover-elevate active-elevate-2'
                    }
                  `}
                  data-testid={`button-intent-${option.value}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`
                      mt-1 flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center
                      ${isSelected 
                        ? 'bg-primary border-primary' 
                        : 'border-border'
                      }
                    `}>
                      {isSelected && (
                        <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-base">{option.label}</div>
                      <div className="text-sm text-muted-foreground mt-1">{option.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {form.formState.errors.intent && (
            <p className="text-sm text-destructive mt-1">
              {form.formState.errors.intent.message}
            </p>
          )}
        </div>
      </form>

      {/* Bottom action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
        <Button 
          onClick={form.handleSubmit(onSubmit)} 
          className="w-full"
          disabled={updateMutation.isPending}
          data-testid="button-save"
        >
          {updateMutation.isPending ? "保存中..." : "保存"}
        </Button>
      </div>
    </div>
  );
}
