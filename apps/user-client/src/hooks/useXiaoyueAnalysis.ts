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

interface TopArchetypeCandidate {
  archetype: string;
  score: number;
  confidence?: number;
}

interface XiaoyueShareVariants {
  selfIntro: string;
  friendCallout: string;
  socialInvite: string;
}

interface XiaoyueAnalysisResult {
  headline?: string;
  analysis: string;
  socialRole?: string;
  bestScene?: string;
  microAction?: string;
  shareLine?: string;
  stateLabel?: string;
  whyThisFits?: string;
  blendLine?: string;
  expressionTags?: string[];
  shareVariants?: XiaoyueShareVariants;
  cached: boolean;
}

interface UseXiaoyueAnalysisOptions {
  archetype: string | null;
  secondaryArchetype?: string | null;
  topArchetypes?: TopArchetypeCandidate[] | null;
  traitScores: TraitScores | null;
  confidence?: number;
  enabled?: boolean;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${key}:${stableSerialize(item)}`).join(',')}}`;
  }

  return String(value ?? 'null');
}

export function useXiaoyueAnalysis({
  archetype,
  secondaryArchetype = null,
  topArchetypes = null,
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
    
    const cacheKey = `${archetype}_${secondaryArchetype ?? 'none'}_${stableSerialize(topArchetypes)}_${stableSerialize(traitScores)}_${confidence}`;
    if (fetchedRef.current === cacheKey) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    apiRequest("POST", "/api/xiaoyue/analysis", {
      archetype,
      secondaryArchetype,
      topArchetypes,
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
  }, [archetype, secondaryArchetype, topArchetypes, traitScores, confidence, enabled]);

  return {
    result,
    headline: result?.headline ?? null,
    analysis: result?.analysis ?? null,
    socialRole: result?.socialRole ?? null,
    bestScene: result?.bestScene ?? null,
    microAction: result?.microAction ?? null,
    shareLine: result?.shareLine ?? null,
    stateLabel: result?.stateLabel ?? null,
    whyThisFits: result?.whyThisFits ?? null,
    blendLine: result?.blendLine ?? null,
    expressionTags: result?.expressionTags ?? null,
    shareVariants: result?.shareVariants ?? null,
    isLoading,
    error,
    hasAnalysis: !!result?.analysis,
  };
}

export function prefetchXiaoyueAnalysis(
  archetype: string,
  traitScores: TraitScores,
  confidence: number,
  options?: {
    secondaryArchetype?: string | null;
    topArchetypes?: TopArchetypeCandidate[] | null;
  }
): void {
  if (confidence < 0.7) return;
  
  apiRequest("POST", "/api/xiaoyue/prefetch", {
    archetype,
    secondaryArchetype: options?.secondaryArchetype ?? null,
    topArchetypes: options?.topArchetypes ?? null,
    traitScores,
    confidence,
  }).catch((err) => {
    console.error("[prefetchXiaoyueAnalysis] Error:", err);
  });
}

export default useXiaoyueAnalysis;
