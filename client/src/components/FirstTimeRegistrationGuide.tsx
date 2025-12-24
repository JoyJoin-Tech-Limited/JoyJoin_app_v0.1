import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Sparkles, 
  CalendarCheck, 
  Users, 
  MessageCircle,
  ArrowRight,
  Clock,
  RefreshCw
} from "lucide-react";

interface FirstTimeRegistrationGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: () => void;
}

const GUIDE_STORAGE_KEY = "first_registration_guide_shown";

export function useFirstTimeRegistrationGuide() {
  const [hasSeenGuide, setHasSeenGuide] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(GUIDE_STORAGE_KEY) === "true";
  });

  const markAsSeen = () => {
    localStorage.setItem(GUIDE_STORAGE_KEY, "true");
    setHasSeenGuide(true);
  };

  return { hasSeenGuide, markAsSeen };
}

export default function FirstTimeRegistrationGuide({
  open,
  onOpenChange,
  onContinue,
}: FirstTimeRegistrationGuideProps) {
  const steps = [
    {
      icon: CalendarCheck,
      title: "确认报名",
      description: "选择偏好后完成报名，系统开始为你匹配",
    },
    {
      icon: Clock,
      title: "等待揭晓",
      description: "活动前1天，小悦会通知你同桌名单",
    },
    {
      icon: Users,
      title: "认识同桌",
      description: "查看同桌档案，了解他们的性格和兴趣",
    },
    {
      icon: MessageCircle,
      title: "开启社交",
      description: "活动当天，带上好心情赴约",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center pb-2">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-xl font-bold">
            第一次参加盲盒活动？
          </DialogTitle>
          <DialogDescription className="text-base">
            了解报名后会发生什么
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {steps.map((step, index) => (
            <Card key={index} className="p-3 border-0 bg-muted/50">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <step.icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      第{index + 1}步
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm">{step.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-3 border-primary/20 bg-primary/5">
          <div className="flex items-start gap-3">
            <RefreshCw className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">改签政策：</span>
              活动前48小时可免费改签一次，24小时内仅限VIP会员改签
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-2 pt-4">
          <Button 
            onClick={onContinue} 
            className="w-full"
            data-testid="button-continue-registration"
          >
            知道了，继续报名
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full text-muted-foreground"
            data-testid="button-cancel-guide"
          >
            稍后再说
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
