import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, X, Clock, Users, Sparkles } from "lucide-react";

const GUIDE_DISMISSED_KEY = "blindbox_guide_dismissed";

interface BlindBoxGuideProps {
  className?: string;
}

export default function BlindBoxGuide({ className }: BlindBoxGuideProps) {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(GUIDE_DISMISSED_KEY);
    setIsDismissed(dismissed === "true");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(GUIDE_DISMISSED_KEY, "true");
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div className={className}>
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20" data-testid="card-blindbox-guide">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">什么是盲盒模式？</span>
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  报名后，活动开始前1天揭晓你的同桌名单。AI小悦会根据大家的性格、兴趣精心搭配，
                  保证每一桌都是"聊得来"的氛围！
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>提前1天揭晓</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>4-6人精品小局</span>
                  </div>
                </div>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="h-7 w-7 -mt-1 -mr-1"
              onClick={handleDismiss}
              data-testid="button-dismiss-guide"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
