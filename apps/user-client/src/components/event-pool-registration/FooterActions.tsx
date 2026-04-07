import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { haptics } from "@/lib/haptics";
import SwipeToUnlock from "@/components/SwipeToUnlock";

interface FooterActionsProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onSubmit: () => void;
  onSaveDraft?: () => void;
  onSkipOptional?: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;
  showSaveDraft?: boolean;
  showSkipOptional?: boolean;
}

export default function FooterActions({
  currentStep,
  totalSteps,
  onBack,
  onSubmit,
  onSaveDraft,
  onSkipOptional,
  isSubmitting,
  canSubmit,
  showSaveDraft = false,
  showSkipOptional = false,
}: FooterActionsProps) {
  const handleBack = () => {
    haptics.light();
    onBack();
  };

  const handleSubmit = () => {
    if (canSubmit) {
      haptics.medium();
      onSubmit();
    }
  };

  return (
    <div className="space-y-3 pt-4 border-t">
      {/* Primary CTA */}
      {currentStep === totalSteps ? (
        <div className="space-y-2 rounded-[28px] border border-primary/10 bg-gradient-to-br from-primary/5 to-violet-500/5 p-3">
          <p className="px-2 text-xs text-muted-foreground">
            向右滑动，正式把这次相遇交给小悦安排。
          </p>
          {isSubmitting ? (
            <Button disabled className="w-full" size="lg">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              正在封盒...
            </Button>
          ) : (
            <SwipeToUnlock
              onUnlock={handleSubmit}
              disabled={!canSubmit}
              ariaLabel="滑动确认报名"
              labelStages={[
                { threshold: 0, label: "封存这次相遇 >" },
                { threshold: 30, label: "继续滑动..." },
                { threshold: 80, label: "马上封盒" },
              ]}
            />
          )}
        </div>
      ) : (
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              AI匹配中...
            </>
          ) : (
            "继续下一步"
          )}
        </Button>
      )}

      {/* Secondary Actions */}
      <div className="flex gap-2">
        {currentStep > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="flex-1"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回修改
          </Button>
        )}
        
        {showSaveDraft && onSaveDraft && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              haptics.light();
              onSaveDraft();
            }}
            className="flex-1"
          >
            <Save className="mr-2 h-4 w-4" />
            稍后继续
          </Button>
        )}
        
        {showSkipOptional && onSkipOptional && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              haptics.light();
              onSkipOptional();
            }}
            className="flex-1"
          >
            跳过可选项 →
          </Button>
        )}
      </div>
    </div>
  );
}
