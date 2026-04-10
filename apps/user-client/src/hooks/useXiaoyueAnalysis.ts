import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

interface TraitScores {
  A?: number;
  O?: number;
  C?: number;
  E?: number;
  X?: number;
  P?: number;
}

interface XiaoyueAnalysisResult {
  headline?: string;
  analysis: string;
  socialRole?: string;
  bestScene?: string;
  microAction?: string;
  shareLine?: string;
  stateLabel?: string;
  cached: boolean;
}

interface UseXiaoyueAnalysisOptions {
  archetype: string | null;
  traitScores: TraitScores | null;
  confidence?: number;
  enabled?: boolean;
}

export function useXiaoyueAnalysis({
  archetype,
  traitScores,
  confidence = 1,
  enabled = true,
}: UseXiaoyueAnalysisOptions) {
  const [result, setResult] = useState<XiaoyueAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !archetype || !traitScores) return;
    
    const cacheKey = `${archetype}_${JSON.stringify(traitScores)}_${confidence}`;
    if (fetchedRef.current === cacheKey) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    apiRequest("POST", "/api/xiaoyue/analysis", {
      archetype,
      traitScores,
      confidence,
    })
      .then((res) => res.json() as Promise<XiaoyueAnalysisResult>)
      .then((nextResult) => {
        setResult(nextResult);
        fetchedRef.current = cacheKey;
      })
      .catch((err) => {
        console.error("[useXiaoyueAnalysis] Error:", err);
        setError(err.message || "Failed to load analysis");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [archetype, traitScores, confidence, enabled]);

  return {
    result,
    headline: result?.headline ?? null,
    analysis: result?.analysis ?? null,
    socialRole: result?.socialRole ?? null,
    bestScene: result?.bestScene ?? null,
    microAction: result?.microAction ?? null,
    shareLine: result?.shareLine ?? null,
    stateLabel: result?.stateLabel ?? null,
    isLoading,
    error,
    hasAnalysis: !!result?.analysis,
  };
}

export function prefetchXiaoyueAnalysis(
  archetype: string,
  traitScores: TraitScores,
  confidence: number
): void {
  if (confidence < 0.7) return;
  
  apiRequest("POST", "/api/xiaoyue/prefetch", {
    archetype,
    traitScores,
    confidence,
  }).catch((err) => {
    console.error("[prefetchXiaoyueAnalysis] Error:", err);
  });
}

export default useXiaoyueAnalysis;
