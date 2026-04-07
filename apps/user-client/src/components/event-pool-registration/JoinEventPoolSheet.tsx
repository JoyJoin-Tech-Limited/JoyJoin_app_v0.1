import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import AtmosphereSelectionStep from "./steps/AtmosphereSelectionStep";
import SocialGoalsStep from "./steps/SocialGoalsStep";
import PrimaryGoalStep from "./steps/PrimaryGoalStep";
import SmartDefaultsStep from "./steps/SmartDefaultsStep";
import DinnerPreferencesStep from "./steps/DinnerPreferencesStep";
import BarPreferencesStep from "./steps/BarPreferencesStep";
import BlindPoolTrustExplainer from "./BlindPoolTrustExplainer";
import JoinErrorScreen from "@/components/matching/JoinErrorScreen";
import TestIncompleteScreen from "@/components/matching/TestIncompleteScreen";
import ExtendedDataEmptyScreen from "@/components/matching/ExtendedDataEmptyScreen";
import { shenzhenClusters } from "@shared/districts";
import {
  atmosphereFramingEnabled,
  socialGoalReframingEnabled,
  ignitionConfirmationEnabled,
} from "@/lib/wave2Experiments";
import { participationExperimentAnalytics } from "@/lib/participationExperimentAnalytics";

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
  const [, setLocation] = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showMascot, setShowMascot] = useState(false);
  const [mascotMessage, setMascotMessage] = useState("");

  // ── Wave 2 experiment flags (resolved once per sheet open) ──────────────────
  // Flags are resolved at runtime so per-session URL overrides take effect.
  const useAtmosphereFraming = atmosphereFramingEnabled();
  const useSocialGoalReframing = socialGoalReframingEnabled();
  const useIgnitionConfirmation = ignitionConfirmationEnabled();
  // Tracks whether the extended-data nudge has been dismissed in this session.
  // Once the user explicitly skips or acts on it, we don't re-show it.
  const [extendedDataNudgeDismissed, setExtendedDataNudgeDismissed] = useState(false);

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
      // `open` is the only trigger for this reset. The effect callback is recreated
      // on every render, so when `open` flips to false it closes over the latest
      // `registerMutation` instance returned by `useEventPoolRegistration`.
      setIsPrefilledFromProfile(false);
      setExtendedDataNudgeDismissed(false);
      setShowSuccess(false);
      setShowMascot(false);
      setStep(1);
      registerMutation.reset();
    }
  }, [open, setStep]);

  // Show mascot during step transitions
  useEffect(() => {
    if (step === 2 && preferences.budget) {
      setMascotMessage("很好！继续完善你的偏好 🎉");
      setShowMascot(true);
      
      const timer = setTimeout(() => {
        setShowMascot(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [step, preferences.budget]);

  // Analytics: track ignition experiment shown when reaching the final step
  useEffect(() => {
    if (step === 3 && useIgnitionConfirmation && open) {
      participationExperimentAnalytics.ignitionShown(poolData.poolId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, open]);

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
    setExtendedDataNudgeDismissed(false);
  };

  // Personality test incomplete: derived from auth state
  const isTestIncomplete = !!user && !user.hasCompletedPersonalityTest;

  // Extended data nudge: show once per sheet open when profile enrichment is incomplete.
  // The server computes `profileExtendedComplete` from education + industry + hometown,
  // so the CTA should route to a real profile-edit surface instead of the interests carousel.
  const showExtendedDataNudge =
    !isTestIncomplete &&
    !extendedDataNudgeDismissed &&
    user?.profileExtendedComplete === false;

  // Join error: mutation reached an error state
  // Note: registerMutation.mutate() takes no arguments — the payload is read
  // from the `preferences` closure inside useEventPoolRegistration, so retrying
  // without arguments re-uses the same form data correctly.
  const showJoinError = registerMutation.isError;

  const totalSteps = 3;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Floating Orbs Background — hidden when a matching-state screen is active */}
        {!isTestIncomplete && !showExtendedDataNudge && !showJoinError && <FloatingOrbs />}

        {/* Mascot */}
        <TransitionMascot show={showMascot} message={mascotMessage} />

        {/* ── Personality test incomplete gate ── */}
        {isTestIncomplete ? (
          <TestIncompleteScreen
            onContinueTest={() => {
              onOpenChange(false);
              setLocation("/personality-test");
            }}
            onDismiss={() => onOpenChange(false)}
          />
        ) : showExtendedDataNudge ? (
          /* ── Extended data optional nudge ── */
          <ExtendedDataEmptyScreen
            onFillProfile={() => {
              setExtendedDataNudgeDismissed(true);
              onOpenChange(false);
              setLocation("/profile/edit");
            }}
            onSkip={() => setExtendedDataNudgeDismissed(true)}
          />
        ) : showJoinError ? (
          /* ── Join error state ── */
          <JoinErrorScreen
            isRetrying={registerMutation.isPending}
            onRetry={() => registerMutation.mutate()}
            onBrowse={() => {
              registerMutation.reset();
              onOpenChange(false);
            }}
          />
        ) : showSuccess ? (
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
                        eventType={poolData.eventType}
                        area={poolData.area}
                        enabled={open}
                      />

                      {/* Compact reassurance row — only shown when there are registrations */}
                      {poolData.registrationCount > 0 && (
                        <div className="flex items-center justify-center gap-3 mb-4 px-2 py-2 rounded-xl bg-muted/40 border border-border/50">
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span className="text-green-500">✓</span>
                            <span>手机号验证</span>
                          </div>
                          <div className="h-3 w-px bg-border" />
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span>👥</span>
                            <span>{poolData.registrationCount} 人已入座</span>
                          </div>
                          <div className="h-3 w-px bg-border" />
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span>✨</span>
                            <span>AI智能匹配</span>
                          </div>
                        </div>
                      )}

                      {/* Exp 1: Atmosphere framing vs. standard budget selection */}
                      {useAtmosphereFraming ? (
                        <AtmosphereSelectionStep
                          poolId={poolData.poolId}
                          eventType={poolData.eventType}
                          selectedBudget={preferences.budget}
                          onSelectBudget={(budget) => updatePreferences({ budget })}
                        />
                      ) : (
                        <BudgetSelectionStep
                          eventType={poolData.eventType}
                          selectedBudget={preferences.budget}
                          onSelectBudget={(budget) => updatePreferences({ budget })}
                        />
                      )}
                    </>
                  )}

                  {step === 2 && (
                    /* Exp 2: Social-goal reframing vs. standard multi-select */
                    useSocialGoalReframing ? (
                      <PrimaryGoalStep
                        poolId={poolData.poolId}
                        selectedGoals={preferences.socialGoals || []}
                        onSelectGoals={(goals) => updatePreferences({ socialGoals: goals })}
                        registrationCount={poolData.registrationCount}
                        isPrefilledFromProfile={isPrefilledFromProfile}
                        onClearPrefill={() => setIsPrefilledFromProfile(false)}
                      />
                    ) : (
                      <SocialGoalsStep
                        selectedGoals={preferences.socialGoals || []}
                        onSelectGoals={(goals) => updatePreferences({ socialGoals: goals })}
                        registrationCount={poolData.registrationCount}
                        isPrefilledFromProfile={isPrefilledFromProfile}
                        onClearPrefill={() => setIsPrefilledFromProfile(false)}
                      />
                    )
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
                experimentVariant={useIgnitionConfirmation ? "ignition" : undefined}
                onIgnitionSwipeStarted={() =>
                  participationExperimentAnalytics.ignitionSwipeStarted(poolData.poolId)
                }
                onIgnitionSwipeCompleted={() =>
                  participationExperimentAnalytics.ignitionSwipeCompleted(poolData.poolId)
                }
                onIgnitionSwipeAbandoned={(pct) =>
                  participationExperimentAnalytics.ignitionSwipeAbandoned(poolData.poolId, pct)
                }
                onIgnitionFallbackUsed={() =>
                  participationExperimentAnalytics.ignitionFallbackUsed(poolData.poolId)
                }
              />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
