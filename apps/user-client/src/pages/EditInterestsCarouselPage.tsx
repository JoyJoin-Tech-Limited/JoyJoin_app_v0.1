import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateUserDerivedQueries } from "@/lib/userStateInvalidation";
import { useToast } from "@/hooks/use-toast";
import { InterestCarousel, type InterestCarouselData } from "@/components/interests/InterestCarousel";
import type { HeatLevel } from "@/data/interestCarouselData";

export default function EditInterestsCarouselPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Load existing selections from DB to pre-populate the carousel
  const { data: existingInterests, isLoading } = useQuery<any>({
    queryKey: ["/api/user/interests"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: InterestCarouselData) => {
      return await apiRequest("POST", "/api/user/interests", { interests: data });
    },
    onSuccess: async () => {
      await invalidateUserDerivedQueries();
      toast({ title: "兴趣已更新 🎉", description: "你的兴趣画像已同步更新" });
      setLocation("/profile/edit");
    },
    onError: (error: Error) => {
      toast({ title: "保存失败", description: error.message, variant: "destructive" });
    },
  });

  // Convert DB selections array → { topicId: HeatLevel } map for the carousel
  const initialSelections: Record<string, HeatLevel> = {};
  if (existingInterests?.selections) {
    for (const s of existingInterests.selections) {
      initialSelections[s.topicId] = s.level as HeatLevel;
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <InterestCarousel
      initialSelections={initialSelections}
      onComplete={(data) => saveMutation.mutate(data)}
      onBack={() => setLocation("/profile/edit")}
    />
  );
}
