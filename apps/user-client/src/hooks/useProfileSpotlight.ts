import { useQuery } from "@tanstack/react-query";

interface SpotlightProfile {
  userId: string;
  displayName: string;
  archetype?: string | null;
  secondaryArchetype?: string | null;
  industry?: string | null;
  ageRange?: string;
  interests?: string[];
  socialStyle?: string | null;
  ageVisible?: boolean;
  industryVisible?: boolean;
}

interface SpotlightResponse {
  profile: SpotlightProfile;
  compatibility?: {
    score: number;
    highlights: string[];
  };
}

export function useProfileSpotlight(
  eventId: string | undefined,
  userId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery<SpotlightResponse>({
    queryKey: ['/api/events', eventId, 'spotlight', userId],
    queryFn: async () => {
      if (!eventId || !userId) throw new Error('Event and user ID required');
      
      const res = await fetch(`/api/events/${eventId}/spotlight/${userId}`, {
        credentials: 'include',
      });
      
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('Not authorized to view this profile');
        }
        throw new Error('Failed to fetch profile');
      }
      
      return res.json();
    },
    enabled: options?.enabled !== false && !!eventId && !!userId,
    staleTime: 1000 * 60 * 10,
    retry: false,
  });
}

export function useTableMatesProfiles(
  eventId: string | undefined,
  userIds: string[]
) {
  // Include sorted userIds in queryKey to differentiate unique participant combinations
  const sortedUserIds = [...userIds].sort();
  
  return useQuery<SpotlightProfile[]>({
    queryKey: ['/api/events', eventId, 'tablemates-profiles', sortedUserIds],
    queryFn: async () => {
      if (!eventId || userIds.length === 0) return [];
      
      const profiles = await Promise.all(
        userIds.map(async (userId) => {
          try {
            const res = await fetch(`/api/events/${eventId}/spotlight/${userId}`, {
              credentials: 'include',
            });
            if (!res.ok) return null;
            const data = await res.json();
            return data.profile;
          } catch {
            return null;
          }
        })
      );
      
      return profiles.filter((p): p is SpotlightProfile => p !== null);
    },
    enabled: !!eventId && userIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });
}
