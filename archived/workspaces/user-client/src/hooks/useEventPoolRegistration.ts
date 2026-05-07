import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  type EventPoolRegistrationPayload,
  type NormalizedEventPoolRegistrationPayload,
} from "@shared/api";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  buildBrowserPoolRegistrationResumeContext,
  clearStoredBrowserPoolRegistrationResumeContext,
  persistBrowserPoolRegistrationResumeContext,
  readStoredBrowserPoolRegistrationResumeContext,
  type BrowserPoolRegistrationEntitlementCode,
  type BrowserPoolRegistrationResumeContext,
} from "@/lib/poolRegistrationResume";
import { invalidateUserDerivedQueries } from "@/lib/userStateInvalidation";
import { useToast } from "@/hooks/use-toast";
import { haptics } from "@/lib/haptics";
import { confettiPresets } from "@/lib/confetti-utils";

interface UserProfile {
  id?: string;
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
  poolTitle?: string;
  poolArea?: string;
  poolDate?: string;
  onSuccess?: () => void;
}

const LAST_PREFS_KEYS = [
  "budget",
  "socialGoals",
  "languages",
  "districts",
  "cuisines",
  "dietary",
  "tasteIntensity",
  "barThemes",
  "alcoholComfort",
  "musicPreference",
] as const;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function pickStoredPreferences(value: unknown): Partial<EventPreferences> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const picked: Partial<EventPreferences> = {};

  for (const key of LAST_PREFS_KEYS) {
    const storedValue = candidate[key];
    if (storedValue == null) continue;

    switch (key) {
      case "budget":
      case "tasteIntensity":
      case "alcoholComfort":
        if (typeof storedValue === "string") {
          picked[key] = storedValue;
        }
        break;
      default:
        if (isStringArray(storedValue)) {
          picked[key] = storedValue;
        }
        break;
    }
  }

  return picked;
}

function getDraftStorageKey(poolId: string): string {
  return `draft-${poolId}`;
}

function readStoredDraftPreferences(poolId: string): Partial<EventPreferences> | null {
  try {
    const draft = localStorage.getItem(getDraftStorageKey(poolId));
    if (!draft) {
      return null;
    }

    return pickStoredPreferences(JSON.parse(draft));
  } catch (error) {
    console.error("Failed to restore draft:", error);
    return null;
  }
}

function buildRegistrationPayload(
  eventType: EventPreferences["eventType"],
  preferences: Partial<EventPreferences>,
): EventPoolRegistrationPayload {
  const basePayload = {
    eventIntent: preferences.socialGoals,
    preferredLanguages: preferences.languages,
  };

  return eventType === "饭局"
    ? {
        ...basePayload,
        budgetRange: preferences.budget ? [preferences.budget] : undefined,
        cuisinePreferences: preferences.cuisines,
        dietaryRestrictions: preferences.dietary,
        tasteIntensity: preferences.tasteIntensity ? [preferences.tasteIntensity] : undefined,
      }
    : {
        ...basePayload,
        barBudgetRange: preferences.budget ? [preferences.budget] : undefined,
        barThemes: preferences.barThemes,
        alcoholComfort: Array.isArray(preferences.alcoholComfort)
          ? preferences.alcoholComfort
          : preferences.alcoholComfort
            ? [preferences.alcoholComfort]
            : [],
      };
}

function buildPreferencesFromResumeDraft(
  eventType: EventPreferences["eventType"],
  draft: NormalizedEventPoolRegistrationPayload,
): Partial<EventPreferences> {
  return {
    eventType,
    budget: draft.barBudgetRange?.[0] ?? draft.budgetRange?.[0] ?? "",
    socialGoals: draft.eventIntent ?? [],
    languages: draft.preferredLanguages ?? [],
    districts: [],
    cuisines: draft.cuisinePreferences ?? [],
    dietary: draft.dietaryRestrictions ?? [],
    tasteIntensity: draft.tasteIntensity?.[0],
    barThemes: draft.barThemes ?? [],
    alcoholComfort: draft.alcoholComfort?.[0],
    musicPreference: [],
  };
}

export function buildRestoredPreferencesFromResumeContext(
  eventType: EventPreferences["eventType"],
  draft: NormalizedEventPoolRegistrationPayload,
  storedDraft: Partial<EventPreferences> | null,
): Partial<EventPreferences> {
  const resumePreferences = buildPreferencesFromResumeDraft(eventType, draft);

  if (!storedDraft) {
    return resumePreferences;
  }

  return {
    ...resumePreferences,
    ...storedDraft,
    eventType,
  };
}

function getEntitlementCode(value: unknown): BrowserPoolRegistrationEntitlementCode | null {
  if (
    value === "NO_ACTIVE_ENTITLEMENT" ||
    value === "NO_AVAILABLE_EVENT_PACK_CREDITS"
  ) {
    return value;
  }

  return null;
}

function createEntitlementRegistrationError(
  code: BrowserPoolRegistrationEntitlementCode,
  message: string,
  data: unknown,
): Error & { code: BrowserPoolRegistrationEntitlementCode; data: unknown } {
  const error = new Error(message) as Error & {
    code: BrowserPoolRegistrationEntitlementCode;
    data: unknown;
  };
  error.name = "PoolRegistrationEntitlementError";
  error.code = code;
  error.data = data;
  return error;
}

export function useEventPoolRegistration({ 
  poolId, 
  eventType,
  poolTitle,
  poolArea,
  poolDate,
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
  const [resumeContext, setResumeContext] = useState<BrowserPoolRegistrationResumeContext | null>(null);
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
        localStorage.setItem(getDraftStorageKey(poolId), JSON.stringify(preferences));
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

    const storedResumeContext = readStoredBrowserPoolRegistrationResumeContext({
      currentUserId: user?.id,
    });

    if (storedResumeContext.status === "clear") {
      clearStoredBrowserPoolRegistrationResumeContext();
    } else if (
      storedResumeContext.status === "ready" &&
      storedResumeContext.context.poolId === poolId
    ) {
      const nextContext = storedResumeContext.context;
      const storedDraft = readStoredDraftPreferences(poolId);
      setResumeContext(nextContext);
      setPreferences(
        buildRestoredPreferencesFromResumeContext(eventType, nextContext.draft, storedDraft),
      );
      setStep(nextContext.resumeStep);
      setIsPrefilledFromProfile(false);
      toast({
        title: nextContext.paymentStatus === "paid" ? "权益已到账" : "已恢复草稿",
        description:
          nextContext.paymentStatus === "paid"
            ? "你刚才填写的预算和偏好已经接回来，可以继续完成报名"
            : "继续之前的填写",
      });
      return;
    }

    const storedDraft = readStoredDraftPreferences(poolId);
    if (storedDraft) {
      setPreferences({ ...storedDraft, eventType }); // Ensure eventType is current
      toast({
        title: "已恢复草稿",
        description: "继续之前的填写",
      });
      return; // Draft takes priority — skip profile pre-fill
    }

    // No per-pool draft: try last preferences for this event type
    try {
      const lastPrefs = localStorage.getItem(`joyjoin_last_prefs_${eventType}`);
      if (lastPrefs) {
        const parsed = JSON.parse(lastPrefs);
        const safeLastPrefs = pickStoredPreferences(parsed);
        if (safeLastPrefs) {
          setPreferences(prev => ({ ...prev, ...safeLastPrefs, eventType }));
          // Silent pre-fill — no toast, as this is just convenience pre-population
          return;
        }
      }
    } catch (_error) {
      // Fall through to profile prefill
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
      const payload = buildRegistrationPayload(eventType, preferences);
      const response = await apiRequest(
        "POST",
        `/api/event-pools/${poolId}/register`,
        payload,
        { allowStatuses: [403] },
      );

      if (response.status === 403) {
        const data = await response.json().catch(() => null);
        const code = getEntitlementCode((data as { code?: unknown } | null)?.code);
        const message =
          typeof (data as { message?: unknown } | null)?.message === "string"
            ? (data as { message: string }).message
            : "无法完成报名，请稍后重试";

        if (code) {
          throw createEntitlementRegistrationError(code, message, data);
        }

        throw new Error(message);
      }

      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      haptics.success();
      confettiPresets.celebration();
      await invalidateUserDerivedQueries();
      await queryClient.refetchQueries({ queryKey: ["/api/my-pool-registrations"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/event-pools"] });
      
      // Clear draft
      localStorage.removeItem(getDraftStorageKey(poolId));
      clearStoredBrowserPoolRegistrationResumeContext();
      setResumeContext(null);

      // Save last preferences for this event type for future rejoin pre-fill
      try {
        const toSave = {
          budget: preferences.budget,
          socialGoals: preferences.socialGoals,
          languages: preferences.languages,
          districts: preferences.districts,
          // conditional fields
          ...(preferences.cuisines ? { cuisines: preferences.cuisines } : {}),
          ...(preferences.dietary ? { dietary: preferences.dietary } : {}),
          ...(preferences.tasteIntensity ? { tasteIntensity: preferences.tasteIntensity } : {}),
          ...(preferences.barThemes ? { barThemes: preferences.barThemes } : {}),
          ...(preferences.alcoholComfort ? { alcoholComfort: preferences.alcoholComfort } : {}),
          ...(preferences.musicPreference ? { musicPreference: preferences.musicPreference } : {}),
        };
        localStorage.setItem(`joyjoin_last_prefs_${eventType}`, JSON.stringify(toSave));
      } catch (_e) {
        // Storage failures are non-fatal
      }
      
      // Trigger success callback
      onSuccess?.();
    },
    onError: (error: any) => {
      const code = getEntitlementCode(error?.code);

      if (code) {
        try {
          localStorage.setItem(getDraftStorageKey(poolId), JSON.stringify(preferences));
        } catch (_storageError) {
          // Storage failures are non-fatal here; the dedicated return context is the main source of truth.
        }

        const nextResumeContext = buildBrowserPoolRegistrationResumeContext({
          userId: user?.id ?? null,
          poolId,
          poolTitle,
          poolArea,
          poolDate,
          poolEventType: eventType,
          draft: buildRegistrationPayload(eventType, preferences),
          resumeStep: step,
          handoffCode: code,
        });

        persistBrowserPoolRegistrationResumeContext(nextResumeContext);
        setResumeContext(nextResumeContext);
        haptics.light();
        toast({
          title:
            code === "NO_AVAILABLE_EVENT_PACK_CREDITS"
              ? "次数已用完，先续上权益"
              : "先开通权益，再继续报名",
          description: "你刚填写的预算和偏好已经为你保留，支付确认后会自动回到这里继续。",
        });
        return;
      }

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
    localStorage.setItem(getDraftStorageKey(poolId), JSON.stringify(preferences));
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
    resumeContext,
    saveDraft,
    isFormValid,
    isPrefilledFromProfile,
    clearPrefill,
  };
}
