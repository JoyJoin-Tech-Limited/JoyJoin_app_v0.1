import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useEventPoolRegistration } from "@/hooks/useEventPoolRegistration";
import SheetHeader from "./SheetHeader";
import FloatingOrbs from "./FloatingOrbs";
import TransitionMascot from "./TransitionMascot";
import FooterActions from "./FooterActions";
import SuccessCelebration from "./SuccessCelebration";
import WhyThisFitsCard from "./WhyThisFitsCard";
import BudgetSelectionStep from "./steps/BudgetSelectionStep";
import SocialGoalsStep from "./steps/SocialGoalsStep";
import SmartDefaultsStep from "./steps/SmartDefaultsStep";
import DinnerPreferencesStep from "./steps/DinnerPreferencesStep";
import BarPreferencesStep from "./steps/BarPreferencesStep";
import BlindPoolTrustExplainer from "./BlindPoolTrustExplainer";
import { shenzhenClusters } from "@shared/districts";

interface JoinEventPoolSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poolData: {
    poolId: string;
    title: string;
    date: string;
    area: string;
    city: string;
    eventType: "饭局" | "酒局";
    registrationCount: number;
  };
}

export default function JoinEventPoolSheet({
  open,
  onOpenChange,
  poolData,
}: JoinEventPoolSheetProps) {
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showMascot, setShowMascot] = useState(false);
  const [mascotMessage, setMascotMessage] = useState("");

  // Fetch the user's top priority interest for the optional boost CTA
  const { data: interestsSummary } = useQuery<{
    topPriorities?: Array<{ topicId: string; label: string; heat: number }>;
  } | null>({
    queryKey: ["/api/user/interests/summary"],
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });
  const topBoostInterest = interestsSummary?.topPriorities?.[0];

  const {
    step,
    setStep,
    preferences,
    updatePreferences,
    registerMutation,
    saveDraft,
    isFormValid,
  } = useEventPoolRegistration({
    poolId: poolData.poolId,
    eventType: poolData.eventType,
    onSuccess: () => {
      setShowSuccess(true);
    },
  });

  const [isPrefilledFromProfile, setIsPrefilledFromProfile] = useState(false);

  // Initialize smart defaults
  useEffect(() => {
    if (open && user) {
      // Set default districts based on event area
      // Map area name (e.g., "南山区") to cluster id (e.g., "nanshan")
      const cluster = shenzhenClusters.find(c =>
        c.displayName === poolData.area || c.name === poolData.area
      );
      const defaultDistricts = cluster ? cluster.districts.map(d => d.id) : [];

      // Set default languages from user profile (preferredLanguages field)
      const userLanguages: string[] = user.preferredLanguages ?? [];

      const updates: Parameters<typeof updatePreferences>[0] = {
        districts: defaultDistricts,
        languages: userLanguages,
      };

      // Pre-fill dietary restrictions from user profile (only when no selection yet)
      const currentDietary = preferences.dietary || [];
      if ((user.dietaryRestrictions ?? []).length > 0 && currentDietary.length === 0) {
        updates.dietary = user.dietaryRestrictions!;
      }

      // Pre-fill social goals from user's profile intent (only when no selection yet)
      const currentGoals = preferences.socialGoals || [];
      if (user.intent && user.intent.length > 0 && currentGoals.length === 0) {
        updates.socialGoals = user.intent;
        setIsPrefilledFromProfile(true);
      } else {
        // Ensure banner state is cleared when we decide not to prefill
        setIsPrefilledFromProfile(false);
      }

      updatePreferences(updates);
    }
  }, [open, user, poolData.area, preferences.socialGoals]);

  // Reset prefill flag when the sheet closes so each session starts clean
  useEffect(() => {
    if (!open) {
      setIsPrefilledFromProfile(false);
    }
  }, [open]);

  // Show mascot during step transitions
  useEffect(() => {
    if (step === 2 && preferences.budget) {
      setMascotMessage("太棒了！继续加油 🎉");
      setShowMascot(true);
      
      const timer = setTimeout(() => {
        setShowMascot(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [step, preferences.budget]);

  const handleSubmit = () => {
    if (isFormValid()) {
      registerMutation.mutate();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSkipOptional = () => {
    // Submit with current preferences
    handleSubmit();
  };

  const handleNavigateToEvents = () => {
    onOpenChange(false);
    setShowSuccess(false);
    setStep(1);
  };

  const totalSteps = 3;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Floating Orbs Background */}
        <FloatingOrbs />

        {/* Mascot */}
        <TransitionMascot show={showMascot} message={mascotMessage} />

        {/* Success Celebration */}
        {showSuccess ? (
          <SuccessCelebration
            onNavigate={handleNavigateToEvents}
            boostInterestKey={topBoostInterest?.topicId}
            boostInterestLabel={topBoostInterest?.label}
            boostInterestHeat={topBoostInterest?.heat}
          />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 pb-4">
              <SheetHeader
                currentStep={step}
                totalSteps={totalSteps}
                poolData={{
                  title: poolData.title,
                  date: poolData.date,
                  area: poolData.area,
                  registrationCount: poolData.registrationCount,
                }}
              />
            </div>

            {/* Steps Content */}
            <div className="flex-1 overflow-y-auto pr-2 -mr-2 scrollbar-thin">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="pb-4"
                >
                  {step === 1 && (
                    <>
                      <WhyThisFitsCard
                        poolId={poolData.poolId}
                        eventType={poolData.eventType}
                        area={poolData.area}
                        enabled={open}
                      />
                      <BudgetSelectionStep
                        eventType={poolData.eventType}
                        selectedBudget={preferences.budget}
                        onSelectBudget={(budget) => updatePreferences({ budget })}
                      />
                    </>
                  )}

                  {step === 2 && (
                    <SocialGoalsStep
                      selectedGoals={preferences.socialGoals || []}
                      onSelectGoals={(goals) => updatePreferences({ socialGoals: goals })}
                      registrationCount={poolData.registrationCount}
                      isPrefilledFromProfile={isPrefilledFromProfile}
                      onClearPrefill={() => setIsPrefilledFromProfile(false)}
                    />
                  )}

                  {step === 3 && (
                    <>
                      <SmartDefaultsStep
                        eventType={poolData.eventType}
                        eventArea={poolData.area}
                        userLanguages={user?.preferredLanguages ?? []}
                        selectedDistricts={preferences.districts || []}
                        selectedLanguages={preferences.languages || []}
                        onUpdateDistricts={(districts) => updatePreferences({ districts })}
                        onUpdateLanguages={(languages) => updatePreferences({ languages })}
                      />

                      <div className="mt-6">
                        {poolData.eventType === "饭局" ? (
                          <DinnerPreferencesStep
                            selectedCuisines={preferences.cuisines || []}
                            selectedDietary={preferences.dietary || []}
                            tasteIntensity={preferences.tasteIntensity}
                            onUpdateCuisines={(cuisines) => updatePreferences({ cuisines })}
                            onUpdateDietary={(dietary) => updatePreferences({ dietary })}
                            onUpdateTasteIntensity={(intensity) => 
                              updatePreferences({ tasteIntensity: intensity })
                            }
                          />
                        ) : (
                          <BarPreferencesStep
                            selectedBarThemes={preferences.barThemes || []}
                            alcoholComfort={preferences.alcoholComfort}
                            selectedMusicPreference={preferences.musicPreference || []}
                            onUpdateBarThemes={(themes) => updatePreferences({ barThemes: themes })}
                            onUpdateAlcoholComfort={(comfort) => 
                              updatePreferences({ alcoholComfort: comfort })
                            }
                            onUpdateMusicPreference={(music) => 
                              updatePreferences({ musicPreference: music })
                            }
                          />
                        )}
                      </div>

                      {/* Trust explainer — shown before final submit on step 3 */}
                      <div className="mt-6">
                        <BlindPoolTrustExplainer
                          poolData={{
                            date: poolData.date,
                            area: poolData.area,
                            city: poolData.city,
                            eventType: poolData.eventType,
                          }}
                          selectedBudget={preferences.budget}
                        />
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="shrink-0 mt-auto">
              <FooterActions
                currentStep={step}
                totalSteps={totalSteps}
                onBack={handleBack}
                onSubmit={handleSubmit}
                onSaveDraft={saveDraft}
                onSkipOptional={step === 3 ? handleSkipOptional : undefined}
                isSubmitting={registerMutation.isPending}
                canSubmit={isFormValid()}
                showSaveDraft={step === 3}
                showSkipOptional={step === 3}
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
