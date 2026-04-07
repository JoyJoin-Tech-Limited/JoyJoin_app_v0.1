import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { haptics } from "@/lib/haptics";
import SwipeToConfirm from "./shared/SwipeToConfirm";

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
  /**
   * When `"ignition"`, the primary CTA on the final step is replaced with the
   * swipe-to-confirm ritual (Wave 2 EXP_IGNITION_CONFIRMATION).
   * A plain button fallback is always rendered regardless of this value.
   */
  experimentVariant?: "ignition";
  /** Analytics callbacks forwarded to SwipeToConfirm (ignition variant only). */
  onIgnitionSwipeStarted?: () => void;
  onIgnitionSwipeCompleted?: () => void;
  onIgnitionSwipeAbandoned?: (progressPct: number) => void;
  onIgnitionFallbackUsed?: () => void;
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
  experimentVariant,
  onIgnitionSwipeStarted,
  onIgnitionSwipeCompleted,
  onIgnitionSwipeAbandoned,
  onIgnitionFallbackUsed,
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

  const isFinalStep = currentStep === totalSteps;
  const showIgnition = experimentVariant === "ignition" && isFinalStep;

  return (
    <div className="space-y-3 pt-4 border-t">
      {/* Primary CTA — ignition experiment variant on final step */}
      {showIgnition ? (
        <SwipeToConfirm
          onConfirm={handleSubmit}
          isSubmitting={isSubmitting}
          disabled={!canSubmit}
          onSwipeStarted={onIgnitionSwipeStarted}
          onSwipeCompleted={onIgnitionSwipeCompleted}
          onSwipeAbandoned={onIgnitionSwipeAbandoned}
          onFallbackUsed={onIgnitionFallbackUsed}
        />
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
              正在锁定你的席位…
            </>
          ) : (
            "锁定这一席"
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
            返回调整
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
            下次再来
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
