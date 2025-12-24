import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { NotificationCounts } from "@shared/schema";

export function useNotificationCounts() {
  return useQuery<NotificationCounts>({
    queryKey: ['/api/notifications/counts'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useMarkNotificationsAsRead() {
  return useMutation({
    mutationFn: async (category: string) => {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ category }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });
    },
  });
}
