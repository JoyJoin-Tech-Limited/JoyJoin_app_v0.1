import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { buildOnboardingFlowState } from "./flow";

export function useOnboardingOrchestrator() {
  const auth = useAuth();
  const onboarding = useMemo(() => buildOnboardingFlowState(auth.user), [auth.user]);

  return {
    ...auth,
    ...onboarding,
  };
}
