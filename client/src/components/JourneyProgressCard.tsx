import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle, 
  UserCheck, 
  Brain, 
  CalendarPlus,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Link } from "wouter";

interface JourneyStep {
  id: string;
  title: string;
  completed: boolean;
  icon: typeof CheckCircle2;
  actionLabel?: string;
  actionPath?: string;
}

interface JourneyProgressCardProps {
  isLoggedIn: boolean;
  hasCompletedPersonalityTest: boolean;
  hasRegisteredEvent: boolean;
}

export default function JourneyProgressCard({
  isLoggedIn,
  hasCompletedPersonalityTest,
  hasRegisteredEvent,
}: JourneyProgressCardProps) {
  const steps: JourneyStep[] = [
    {
      id: "register",
      title: "完成注册",
      completed: isLoggedIn,
      icon: UserCheck,
      actionLabel: "去注册",
      actionPath: "/register",
    },
    {
      id: "personality",
      title: "性格测试",
      completed: hasCompletedPersonalityTest,
      icon: Brain,
      actionLabel: "开始测试",
      actionPath: "/personality-test",
    },
    {
      id: "first-event",
      title: "报名首场活动",
      completed: hasRegisteredEvent,
      icon: CalendarPlus,
      actionLabel: "浏览活动",
      actionPath: "/discover",
    },
  ];

  const completedCount = steps.filter(s => s.completed).length;
  const progressPercent = (completedCount / steps.length) * 100;
  
  const nextStep = steps.find(s => !s.completed);

  if (completedCount === steps.length) {
    return null;
  }

  return (
    <Card className="border-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" data-testid="card-journey-progress">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">你的JoyJoin之旅</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {completedCount}/{steps.length} 已完成
          </span>
        </div>

        <Progress value={progressPercent} className="h-1.5 mb-4" />

        <div className="space-y-2">
          {steps.map((step, index) => (
            <div 
              key={step.id}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                step.completed 
                  ? "bg-primary/5" 
                  : nextStep?.id === step.id 
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
                <span className={`text-sm ${
                  step.completed 
                    ? "text-muted-foreground line-through" 
                    : "font-medium"
                }`}>
                  {step.title}
                </span>
              </div>

              {!step.completed && nextStep?.id === step.id && step.actionPath && (
                <Link href={step.actionPath}>
                  <Button 
                    size="sm" 
                    variant="default"
                    className="h-7 text-xs"
                    data-testid={`button-journey-${step.id}`}
                  >
                    {step.actionLabel}
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>

        {nextStep && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            完成{nextStep.title}后，小悦就能为你精准匹配同桌啦
          </p>
        )}
      </CardContent>
    </Card>
  );
}
