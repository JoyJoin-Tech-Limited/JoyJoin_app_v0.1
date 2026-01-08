import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Clock, Loader2 } from "lucide-react";
import { XiaoyueDialog } from "@/components/XiaoyueDialog";
import { StickyCTA, StickyCTAButton } from "@/components/StickyCTA";

export default function ProfileSetupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");

  const setupMutation = useMutation({
    mutationFn: async (data: { displayName: string }) => {
      return await apiRequest("POST", "/api/profile/setup", data);
    },
    onSuccess: async () => {
      // Refetch auth user to update onboarding state
      await queryClient.refetchQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "资料已保存",
        description: "欢迎来到悦聚！",
      });
      setLocation("/");
    },
    onError: (error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!displayName.trim()) {
      toast({
        title: "请输入昵称",
        variant: "destructive",
      });
      return;
    }

    setupMutation.mutate({
      displayName: displayName.trim(),
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 container mx-auto px-4 py-6 max-w-md">
        <motion.div
          className="space-y-6 flex flex-col items-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Xiaoyue mascot */}
          <XiaoyueDialog
            mood="excited"
            message="给自己取个响亮的名字吧~"
            avatarSize={96}
          />

          {/* 时长预期提示 */}
          <motion.div
            className="w-full flex items-center gap-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg px-4 py-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
            <p className="text-sm text-purple-700 dark:text-purple-300">
              完整注册大约需要 <span className="font-semibold">3-5 分钟</span>
            </p>
          </motion.div>

          <Card className="w-full border shadow-sm">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">昵称</Label>
                <Input
                  id="displayName"
                  placeholder="输入你的昵称"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-12 text-lg"
                  data-testid="input-display-name"
                />
                <p className="text-xs text-muted-foreground">
                  这是其他人看到的名字
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <StickyCTA>
        <StickyCTAButton
          onClick={handleSubmit}
          disabled={setupMutation.isPending || !displayName.trim()}
          isLoading={setupMutation.isPending}
          loadingText="保存中..."
          data-testid="button-save-profile"
        >
          继续
        </StickyCTAButton>
      </StickyCTA>
    </div>
  );
}
