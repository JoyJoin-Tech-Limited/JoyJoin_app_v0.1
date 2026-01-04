import { useQuery } from "@tanstack/react-query";
import type { BlindBoxEvent } from "@shared/schema";

interface InviteData {
  event: BlindBoxEvent;
  tablemates: TableMate[];
  venueInfo?: VenueInfo;
  inviteCode?: string;
}

interface TableMate {
  userId: string;
  displayName: string;
  archetype?: string | null;
  industry?: string | null;
}

interface VenueInfo {
  name: string;
  address: string;
  district?: string;
  mapUrl?: string;
}

export function useInviteData(eventId: string | undefined) {
  return useQuery<InviteData>({
    queryKey: ['/api/blind-box-events', eventId, 'invite'],
    queryFn: async () => {
      if (!eventId) throw new Error('Event ID required');
      
      const res = await fetch(`/api/blind-box-events/${eventId}`, {
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Failed to fetch event');
      const event = await res.json();
      
      const matchedAttendees = (event.matchedAttendees || []) as TableMate[];
      
      return {
        event,
        tablemates: matchedAttendees,
        venueInfo: event.selectedVenue ? {
          name: event.selectedVenue.name || event.venueName,
          address: event.selectedVenue.address || event.venueAddress,
          district: event.district,
        } : undefined,
        inviteCode: event.inviteCode,
      };
    },
    enabled: !!eventId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useMatchExplanations(eventId: string | undefined) {
  return useQuery({
    queryKey: ['/api/blind-box-events', eventId, 'match-explanations'],
    queryFn: async () => {
      if (!eventId) throw new Error('Event ID required');
      
      const res = await fetch(`/api/blind-box-events/${eventId}/match-explanations`, {
        credentials: 'include',
      });
      
      if (!res.ok) throw new Error('Failed to fetch explanations');
      return res.json();
    },
    enabled: !!eventId,
    staleTime: 1000 * 60 * 30,
  });
}
