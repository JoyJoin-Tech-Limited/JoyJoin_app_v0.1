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
import { Clock, Calendar, Check } from "lucide-react";
import { XiaoyueDialog } from "@/components/XiaoyueDialog";
import { StickyCTA, StickyCTAButton } from "@/components/StickyCTA";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { BirthDatePicker } from "@/components/BirthDatePicker";

export default function ProfileSetupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState<{ year: number; month: number; day: number } | undefined>();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const setupMutation = useMutation({
    mutationFn: async (data: { displayName: string; birthdate?: string }) => {
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

    if (!birthDate) {
      toast({
        title: "请选择生日",
        variant: "destructive",
      });
      return;
    }

    const birthdateString = `${birthDate.year}-${String(birthDate.month).padStart(2, '0')}-${String(birthDate.day).padStart(2, '0')}`;

    setupMutation.mutate({
      displayName: displayName.trim(),
      birthdate: birthdateString,
    });
  };

  const handleDateConfirm = () => {
    setShowDatePicker(false);
    if (birthDate) {
      toast({
        description: `生日已选择：${birthDate.year}年${birthDate.month}月${birthDate.day}日`,
        duration: 2000,
      });
    }
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

              <div className="space-y-2">
                <Label htmlFor="birthdate">生日</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDatePicker(true)}
                  className="w-full h-12 justify-start text-left font-normal"
                  data-testid="button-select-birthdate"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {birthDate ? (
                    <span className="flex items-center gap-2">
                      {birthDate.year}年{birthDate.month}月{birthDate.day}日
                      <Check className="h-4 w-4 text-green-600" />
                    </span>
                  ) : (
                    <span className="text-muted-foreground">选择你的生日</span>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  用于个性化体验，不会公开显示
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <StickyCTA>
        <StickyCTAButton
          onClick={handleSubmit}
          disabled={setupMutation.isPending || !displayName.trim() || !birthDate}
          isLoading={setupMutation.isPending}
          loadingText="保存中..."
          data-testid="button-save-profile"
        >
          继续
        </StickyCTAButton>
      </StickyCTA>

      {/* Date Picker Drawer */}
      <Drawer open={showDatePicker} onOpenChange={setShowDatePicker}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>选择你的生日</DrawerTitle>
            <DrawerDescription>
              滑动滚轮选择年、月、日
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <BirthDatePicker
              value={birthDate}
              onChange={setBirthDate}
              minYear={1960}
              maxYear={new Date().getFullYear()}
            />
          </div>
          <DrawerFooter>
            <Button onClick={handleDateConfirm} className="w-full" data-testid="button-confirm-birthdate">
              确认
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" className="w-full">
                取消
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
