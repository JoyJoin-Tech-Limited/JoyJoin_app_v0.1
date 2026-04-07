import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { haptics } from "@/lib/haptics";

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
          "确认报名"
        )}
      </Button>

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
