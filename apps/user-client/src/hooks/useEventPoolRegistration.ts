import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { haptics } from "@/lib/haptics";
import { confettiPresets } from "@/lib/confetti-utils";

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

  // Auto-save to localStorage every 3s
  useEffect(() => {
    const timer = setInterval(() => {
      if (Object.keys(preferences).length > 1) { // More than just eventType
        localStorage.setItem(`draft-${poolId}`, JSON.stringify(preferences));
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [preferences, poolId]);

  // Restore draft on mount
  useEffect(() => {
    const draft = localStorage.getItem(`draft-${poolId}`);
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setPreferences({ ...parsed, eventType }); // Ensure eventType is current
        toast({ 
          title: "已恢复草稿",
          description: "继续之前的填写"
        });
      } catch (e) {
        console.error("Failed to parse draft:", e);
      }
    }
  }, [poolId, eventType, toast]);

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
      return await apiRequest("POST", `/api/event-pools/${poolId}/register`, {
        budgetRange: [preferences.budget],
        eventIntent: preferences.socialGoals,
        preferredDistricts: preferences.districts,
        preferredLanguages: preferences.languages,
        // Conditional fields based on event type
        ...(eventType === "饭局" ? {
          cuisinePreferences: preferences.cuisines,
          dietaryRestrictions: preferences.dietary,
          tasteIntensity: preferences.tasteIntensity,
        } : {
          barThemes: preferences.barThemes,
          alcoholComfort: preferences.alcoholComfort,
          musicPreference: preferences.musicPreference,
        })
      });
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
  };
}
