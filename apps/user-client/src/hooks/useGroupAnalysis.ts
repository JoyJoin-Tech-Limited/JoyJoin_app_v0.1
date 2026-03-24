/**
 * useGroupAnalysis
 *
 * Fetches the AI-generated group analysis for a matched pool group.
 * Endpoint: GET /api/pool-groups/:groupId/analysis
 *
 * - Uses react-query with a 7-minute client-side stale time. The server
 *   caches results for 7 days (per group roster); the client refreshes
 *   at most once per 7 minutes so it picks up any server-side updates.
 * - Disabled when groupId is null/undefined (e.g. group not yet matched).
 * - Returns `isLoading`, `data: GroupAnalysisResponse | undefined`, and `error`.
 */
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { GroupAnalysisResponse } from "@shared/types/groupAnalysis";

export function useGroupAnalysis(groupId: string | null | undefined) {
  return useQuery<GroupAnalysisResponse>({
    queryKey: ["group-analysis", groupId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/pool-groups/${groupId}/analysis`);
      if (!res.ok) throw new Error("Failed to fetch group analysis");
      return res.json();
    },
    enabled: !!groupId,
    staleTime: 1000 * 60 * 7,
    retry: 2,
  });
}
