import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { haptics } from "@/lib/haptics";
import { confettiPresets } from "@/lib/confetti-utils";

interface UserProfile {
  intent?: string[];
}

interface EventPreferences {
  eventType: "饭局" | "酒局";
  budget: string;
  socialGoals: string[];
  districts: string[];
  languages: string[];
  // Conditional based on eventType
  cuisines?: string[];
  dietary?: string[];
  tasteIntensity?: string;
  barThemes?: string[];
  alcoholComfort?: string;
  musicPreference?: string[];
}

interface UseEventPoolRegistrationProps {
  poolId: string;
  eventType: "饭局" | "酒局";
  onSuccess?: () => void;
}

export function useEventPoolRegistration({ 
  poolId, 
  eventType,
  onSuccess 
}: UseEventPoolRegistrationProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [preferences, setPreferences] = useState<Partial<EventPreferences>>({
    eventType,
    socialGoals: [],
    districts: [],
    languages: [],
  });
  const [isPrefilledFromProfile, setIsPrefilledFromProfile] = useState(false);
  // Track whether the initial draft/pre-fill check on mount is done
  const initializedRef = useRef(false);

  // Fetch user profile to pre-fill social goals
  const { data: user } = useQuery<UserProfile>({ queryKey: ["/api/auth/user"] });

  // Auto-save to localStorage, debounced on preference changes
  useEffect(() => {
    // Avoid scheduling saves when there's nothing meaningful beyond eventType
    if (Object.keys(preferences).length <= 1) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        localStorage.setItem(`draft-${poolId}`, JSON.stringify(preferences));
      } catch (error) {
        console.error("Failed to save draft to localStorage:", error);
      }
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [preferences, poolId]);

  // On mount: restore draft if one exists; otherwise pre-fill from profile intent.
  // Uses a ref to ensure this initialisation runs only once, avoiding a race
  // condition between the draft-restore and profile-prefill logic.
  useEffect(() => {
    if (initializedRef.current) return;
    if (user === undefined) return; // Wait for user query to resolve
    initializedRef.current = true;

    const draft = localStorage.getItem(`draft-${poolId}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setPreferences({ ...parsed, eventType }); // Ensure eventType is current
        toast({
          title: "已恢复草稿",
          description: "继续之前的填写",
        });
        return; // Draft takes priority — skip profile pre-fill
      } catch (e) {
        console.error("Failed to parse draft:", e);
      }
    }

    // No draft: pre-fill social goals from profile intent if available
    if (user?.intent && user.intent.length > 0) {
      setPreferences(prev => ({ ...prev, socialGoals: user.intent as string[] }));
      setIsPrefilledFromProfile(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, poolId]);

  // Auto-advance Step 1 → Step 2 after budget selection
  useEffect(() => {
    if (step === 1 && preferences.budget) {
      const timer = setTimeout(() => {
        haptics.light();
        setStep(2);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [step, preferences.budget]);

  // Registration mutation
  const registerMutation = useMutation({
    mutationFn: async () => {
      const basePayload = {
        eventIntent: preferences.socialGoals,
        preferredLanguages: preferences.languages,
      };

      const payload =
        eventType === "饭局"
          ? {
              ...basePayload,
              // 饭局使用通用 budgetRange
              budgetRange: preferences.budget ? [preferences.budget] : undefined,
              cuisinePreferences: preferences.cuisines,
              dietaryRestrictions: preferences.dietary,
              tasteIntensity: preferences.tasteIntensity ? [preferences.tasteIntensity] : undefined,
            }
          : {
              ...basePayload,
              // 酒局使用 barBudgetRange（不是 budgetRange）
              barBudgetRange: preferences.budget ? [preferences.budget] : undefined,
              barThemes: preferences.barThemes,
              // 服务端按数组存储，确保发送数组类型
              alcoholComfort: Array.isArray(preferences.alcoholComfort)
                ? preferences.alcoholComfort
                : preferences.alcoholComfort
                ? [preferences.alcoholComfort]
                : [],
            };

      return await apiRequest(
        "POST",
        `/api/event-pools/${poolId}/register`,
        payload
      );
    },
    onSuccess: () => {
      haptics.success();
      confettiPresets.celebration();
      queryClient.invalidateQueries({ queryKey: ["/api/my-pool-registrations"] });
      
      // Clear draft
      localStorage.removeItem(`draft-${poolId}`);
      
      // Trigger success callback
      onSuccess?.();
    },
    onError: (error: any) => {
      haptics.error();
      toast({
        title: "报名失败",
        description: error.message || "无法完成报名，请重试",
        variant: "destructive",
      });
    }
  });

  const updatePreferences = (updates: Partial<EventPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
    // If user manually changes social goals, it's no longer a profile pre-fill
    if ("socialGoals" in updates) {
      setIsPrefilledFromProfile(false);
    }
  };

  const clearPrefill = () => {
    setPreferences(prev => ({ ...prev, socialGoals: [] }));
    setIsPrefilledFromProfile(false);
  };

  const saveDraft = () => {
    localStorage.setItem(`draft-${poolId}`, JSON.stringify(preferences));
    toast({
      title: "已保存草稿",
      description: "稍后可继续填写"
    });
  };

  const isFormValid = (): boolean => {
    return !!(preferences.budget && 
           preferences.socialGoals && 
           preferences.socialGoals.length > 0);
  };

  return {
    step,
    setStep,
    preferences,
    updatePreferences,
    registerMutation,
    saveDraft,
    isFormValid,
    isPrefilledFromProfile,
    clearPrefill,
  };
}
