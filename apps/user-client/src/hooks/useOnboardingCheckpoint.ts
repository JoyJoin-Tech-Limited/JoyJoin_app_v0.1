import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

/**
 * Hook for saving onboarding checkpoint to backend
 * Replaces localStorage-based state persistence
 */
export function useOnboardingCheckpoint() {
  const saveCheckpoint = useMutation({
    mutationFn: async (step: string) => {
      return apiRequest("POST", "/api/onboarding/checkpoint", {
        step,
        timestamp: Date.now(),
      });
    },
    onSuccess: () => {
      // Invalidate user query to refresh checkpoint data
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error) => {
      console.error("[useOnboardingCheckpoint] Failed to save checkpoint:", error);
      // Don't throw - checkpoint save is non-blocking for UX
    },
  });

  return { saveCheckpoint };
}
