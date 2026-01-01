import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Circle, 
  Brain, 
  CalendarPlus,
  ArrowRight,
  Sparkles,
  UserCircle,
  MessageCircle
} from "lucide-react";
import { Link } from "wouter";

interface JourneyStep {
  id: string;
  title: string;
  subtitle?: string;
  completed: boolean;
  optional?: boolean;
  icon: typeof CheckCircle2;
  actionLabel?: string;
  actionPath?: string;
}

interface JourneyProgressCardProps {
  hasCompletedPersonalityTest: boolean;
  hasCompletedBasicInfo?: boolean;
  hasCompletedEnrichment?: boolean;
  hasRegisteredEvent: boolean;
  onSelectEvent?: () => void;
}

export default function JourneyProgressCard({
  hasCompletedPersonalityTest,
  hasCompletedBasicInfo = false,
  hasCompletedEnrichment = false,
  hasRegisteredEvent,
  onSelectEvent,
}: JourneyProgressCardProps) {
  const steps: JourneyStep[] = [
    {
      id: "personality",
      title: "性格测试",
      completed: hasCompletedPersonalityTest,
      icon: Brain,
      actionLabel: "开始测试",
      actionPath: "/personality-test",
    },
    {
      id: "basic-info",
      title: "基础信息",
      completed: hasCompletedBasicInfo,
      icon: UserCircle,
      actionLabel: "去填写",
      actionPath: "/personality-test/complete",
    },
    {
      id: "enrichment",
      title: "让小悦更懂你",
      subtitle: "提升匹配精准度",
      completed: hasCompletedEnrichment,
      optional: true,
      icon: MessageCircle,
      actionLabel: "聊一聊",
      actionPath: "/chat-registration?mode=enrichment",
    },
    {
      id: "first-event",
      title: "报名首场盲盒活动",
      completed: hasRegisteredEvent,
      icon: CalendarPlus,
      actionLabel: "立即选择 ↓",
      actionPath: "/discover",
    },
  ];

  // For progress calculation, optional steps count as 0.5 when incomplete
  const requiredSteps = steps.filter(s => !s.optional);
  const optionalSteps = steps.filter(s => s.optional);
  const completedRequired = requiredSteps.filter(s => s.completed).length;
  const completedOptional = optionalSteps.filter(s => s.completed).length;

  // Display count excludes optional steps from denominator if not completed
  const displayTotal = requiredSteps.length;
  const displayCompleted = completedRequired;
  const progressPercent = (displayCompleted / displayTotal) * 100;
  
  // Find next required step, or show optional if all required done
  const nextRequiredStep = requiredSteps.find(s => !s.completed);
  const nextStep = nextRequiredStep || steps.find(s => !s.completed);

  // Hide card when all required steps are done AND user registered for event
  if (displayCompleted === displayTotal && hasRegisteredEvent) {
    return null;
  }

  return (
    <Card className="border-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" data-testid="card-journey-progress">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">你的悦聚·JoyJoin之旅</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {displayCompleted}/{displayTotal} 已完成
          </span>
        </div>

        <Progress value={progressPercent} className="h-1.5 mb-3" />

        <div className="space-y-1">
          {steps.map((step) => {
            const StepIcon = step.icon;
            const isNextStep = nextStep?.id === step.id;
            const showAction = !step.completed && isNextStep && step.actionPath;
            // For optional steps, also show action button if previous required steps are done
            const showOptionalAction = step.optional && !step.completed && 
              requiredSteps.slice(0, 2).every(s => s.completed) && step.actionPath;
            
            return (
              <div 
                key={step.id}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  step.completed 
                    ? "bg-primary/5" 
                    : isNextStep 
                      ? "bg-muted/50" 
                      : ""
                }`}
                data-testid={`journey-step-${step.id}`}
              >
                <div className="flex-shrink-0">
                  {step.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm ${
                      step.completed 
                        ? "text-muted-foreground line-through" 
                        : "font-medium"
                    }`}>
                      {step.title}
                    </span>
                    {step.optional && !step.completed && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                        可选
                      </Badge>
                    )}
                  </div>
                  {step.subtitle && !step.completed && (
                    <p className="text-xs text-muted-foreground">{step.subtitle}</p>
                  )}
                </div>

                {(showAction || showOptionalAction) && (
                  <>
                    {step.id === "first-event" && onSelectEvent ? (
                      <Button 
                        size="sm" 
                        variant="default"
                        className="h-7 text-xs"
                        data-testid={`button-journey-${step.id}`}
                        onClick={onSelectEvent}
                      >
                        {step.actionLabel}
                      </Button>
                    ) : (
                      <Link href={step.actionPath!}>
                        <Button 
                          size="sm" 
                          variant={step.optional ? "outline" : "default"}
                          className="h-7 text-xs"
                          data-testid={`button-journey-${step.id}`}
                        >
                          {step.actionLabel}
                          {!step.optional && <ArrowRight className="h-3 w-3 ml-1" />}
                        </Button>
                      </Link>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {nextStep && !nextStep.optional && (
          <p className="text-xs text-muted-foreground mt-2 text-center">
            {nextStep.id === "first-event" 
              ? "完成报名后，小悦就能为你精准匹配同桌啦"
              : `完成${nextStep.title}后，继续下一步`
            }
          </p>
        )}
      </CardContent>
    </Card>
  );
}
