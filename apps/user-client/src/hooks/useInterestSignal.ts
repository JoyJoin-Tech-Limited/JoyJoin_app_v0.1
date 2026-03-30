import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface InterestSignal {
  id: string;
  userId: string;
  interestKey: string;
  interestLabel: string;
  enthusiasmLevel: number;      // 1–5
  discussionStyle: string;      // one of DISCUSSION_STYLE_OPTIONS keys
  conversationDepth: number;    // 1–3
  updatedAt: string | null;
  createdAt: string | null;
}

export interface UpsertInterestSignalInput {
  interestKey: string;
  interestLabel: string;
  enthusiasmLevel: number;
  discussionStyle: string;
  conversationDepth: number;
}

async function fetchInterestSignals(): Promise<InterestSignal[]> {
  const res = await fetch("/api/user/interest-signals", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to fetch interest signals: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.signals ?? [];
}

async function upsertInterestSignal(data: UpsertInterestSignalInput): Promise<InterestSignal> {
  const res = await fetch("/api/user/interest-signals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to save interest signal: ${res.status} ${res.statusText}`);
  const json = await res.json();
  return json.data as InterestSignal;
}

/** Returns the user's existing interest signals and a mutation to upsert one. */
export function useInterestSignal() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["/api/user/interest-signals"],
    queryFn: fetchInterestSignals,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const mutation = useMutation({
    mutationFn: upsertInterestSignal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/interest-signals"] });
    },
  });

  return {
    signals: query.data ?? [],
    isLoading: query.isLoading,
    upsertSignal: mutation.mutateAsync,
    isSubmitting: mutation.isPending,
  };
}
