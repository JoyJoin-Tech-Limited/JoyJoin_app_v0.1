import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Shared hook for canceling pool registrations
 * @returns Mutation for canceling a registration
 */
export function usePoolRegistrationCancel() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (registrationId: string) => {
      return await apiRequest("DELETE", `/api/pool-registrations/${registrationId}`);
    },
    onSuccess: () => {
      toast({
        title: "已取消报名",
        description: "你已成功取消此活动池报名",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/my-pool-registrations"] });
    },
    onError: (error: any) => {
      toast({
        title: "取消失败",
        description: error.message || "无法取消报名，请稍后再试",
        variant: "destructive",
      });
    },
  });
}
