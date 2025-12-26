import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, X, Clock, Users, Sparkles, Shield, ChevronRight, CheckCircle2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const GUIDE_DISMISSED_KEY = "blindbox_guide_dismissed";

interface BlindBoxGuideProps {
  className?: string;
  onLearnMore?: () => void;
  forceShow?: boolean;
}

export default function BlindBoxGuide({ className, onLearnMore, forceShow = false }: BlindBoxGuideProps) {
  const [isDismissed, setIsDismissed] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const showGuideParam = urlParams.get('showGuide');
    
    if (showGuideParam === 'true' || forceShow) {
      setDebugMode(true);
      setIsDismissed(false);
      return;
    }
    
    const dismissed = localStorage.getItem(GUIDE_DISMISSED_KEY);
    setIsDismissed(dismissed === "true");
  }, [forceShow]);

  const handleDismiss = () => {
    if (!debugMode) {
      localStorage.setItem(GUIDE_DISMISSED_KEY, "true");
    }
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  const steps = [
    { id: 1, label: "报名", icon: Gift, completed: false },
    { id: 2, label: "AI匹配", icon: Sparkles, completed: false },
    { id: 3, label: "揭晓", icon: Users, completed: false },
  ];

  const cardElement = (
    <Card 
      className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10" 
      data-testid="card-blindbox-guide"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
      
      <CardContent className="p-5 relative">
        <Button 
          variant="ghost" 
          size="icon"
          className="absolute top-2 right-2 h-7 w-7 opacity-60 hover:opacity-100"
          onClick={handleDismiss}
          data-testid="button-dismiss-guide"
        >
          <X className="h-4 w-4" />
        </Button>

        {debugMode && (
          <div className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 bg-yellow-500/20 text-yellow-600 rounded">
            DEBUG
          </div>
        )}

        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
              <Gift className="h-7 w-7 text-primary-foreground" />
            </div>
            {!prefersReducedMotion && (
              <motion.div 
                className="absolute -inset-1 rounded-2xl border border-primary/30"
                animate={{ 
                  scale: [1, 1.08, 1], 
                  opacity: [0.6, 0, 0.6] 
                }}
                transition={{ 
                  duration: 2.5, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  times: [0, 0.5, 1]
                }}
              />
            )}
          </div>

          <div className="flex-1 space-y-3 pt-1">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base">盲盒社交 · 惊喜匹配</h3>
                {!prefersReducedMotion && (
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                  </motion.div>
                )}
                {prefersReducedMotion && (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                小悦会根据你的性格与兴趣，为你匹配最合拍的同桌伙伴
              </p>
            </div>

            {/* Step flow - improved layout */}
            <div className="flex items-center justify-between pt-2 px-1">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${
                      step.completed 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted/80 text-muted-foreground'
                    }`}>
                      {step.completed ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <step.icon className="h-4 w-4" />
                      )}
                    </div>
                    <span className="text-xs mt-1.5 text-muted-foreground font-medium">{step.label}</span>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex-1 h-[2px] mx-2 -mt-5 bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40 rounded-full" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-xs bg-muted/50 px-2.5 py-1.5 rounded-full">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>提前1天揭晓</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs bg-muted/50 px-2.5 py-1.5 rounded-full">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>4-6人精品局</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs bg-muted/50 px-2.5 py-1.5 rounded-full">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span>隐私保护</span>
              </div>
            </div>
          </div>
        </div>

        {onLearnMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-4 text-primary hover:text-primary"
            onClick={onLearnMore}
            data-testid="button-guide-learn-more"
          >
            了解详细规则
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );

  if (prefersReducedMotion) {
    return <div className={className}>{cardElement}</div>;
  }

  return (
    <motion.div 
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {cardElement}
    </motion.div>
  );
}
