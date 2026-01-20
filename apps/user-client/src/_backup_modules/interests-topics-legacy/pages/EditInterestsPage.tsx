/**
 * ⚠️ LEGACY FILE - MOVED TO BACKUP
 * 
 * Original Location: apps/user-client/src/pages/EditInterestsPage.tsx
 * Original Route: /profile/edit/interests
 * Moved On: 2026-01-19
 * Reason: Uses legacy 20-interest system, replaced by Interest Carousel
 * 
 * This page allowed users to edit their interest selections using the old
 * 20-interest + topic avoidance system. The new system uses the Interest
 * Carousel with 60 topics and doesn't have a separate edit page (users
 * can re-take the carousel in onboarding).
 * 
 * See README.md in this folder for restoration instructions.
 */

import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Ban, Heart } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { INTERESTS_OPTIONS, TOPICS_GROUPS, getAllTopics, type InterestOption, type TopicGroup } from "../../../data/interestsTopicsData";
import { getUserPrimaryInterests, getUserTopicAvoidances } from "@/lib/userFieldMappings";

const interestsSchema = z.object({
  primaryInterests: z.array(z.string()).max(3, "最多选择3个主要兴趣"),
  topicAvoidances: z.array(z.string()).optional(),
});

type InterestsForm = z.infer<typeof interestsSchema>;

export default function EditInterestsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const form = useForm<InterestsForm>({
    resolver: zodResolver(interestsSchema),
    defaultValues: {
      primaryInterests: getUserPrimaryInterests(user),
      topicAvoidances: getUserTopicAvoidances(user),
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InterestsForm) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/profile/edit");
    },
    onError: (error: Error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InterestsForm) => {
    updateMutation.mutate(data);
  };

  const togglePrimaryInterest = (interestId: string) => {
    const current = form.watch("primaryInterests") || [];
    if (current.includes(interestId)) {
      form.setValue("primaryInterests", current.filter(i => i !== interestId));
    } else if (current.length < 3) {
      form.setValue("primaryInterests", [...current, interestId]);
    } else {
      toast({
        title: "最多选择3个",
        description: "请先取消一个再选择新的",
        variant: "destructive",
      });
    }
  };

  const toggleTopicAvoidance = (topicId: string) => {
    const current = form.watch("topicAvoidances") || [];
    if (current.includes(topicId)) {
      form.setValue("topicAvoidances", current.filter(t => t !== topicId));
    } else {
      form.setValue("topicAvoidances", [...current, topicId]);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  const selectedPrimaryInterests = form.watch("primaryInterests") || [];
  const selectedTopicAvoidances = form.watch("topicAvoidances") || [];
  const allTopics = getAllTopics();

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center h-14 px-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setLocation("/profile/edit")}
            data-testid="button-back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-2 text-lg font-semibold">兴趣偏好</h1>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-8 max-w-2xl mx-auto pb-24">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <Label className="text-base font-semibold">主要兴趣</Label>
            <Badge variant="secondary" className="text-xs">
              {selectedPrimaryInterests.length}/3
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">选择1-3个最感兴趣的活动类型，用于活动匹配</p>
          <div className="flex flex-wrap gap-3">
            {INTERESTS_OPTIONS.map((interest: InterestOption) => (
              <Badge
                key={interest.id}
                variant={selectedPrimaryInterests.includes(interest.id) ? "default" : "outline"}
                className="cursor-pointer text-base px-4 py-2.5"
                onClick={() => togglePrimaryInterest(interest.id)}
                data-testid={`badge-interest-${interest.id}`}
              >
                {interest.label}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" />
            <Label className="text-base font-semibold">话题排斥</Label>
            {selectedTopicAvoidances.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {selectedTopicAvoidances.length}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            选择聚会中想避免的话题，匹配时会尽量避开
          </p>
          
          {Object.entries(TOPICS_GROUPS).map(([groupKey, group]: [string, TopicGroup]) => (
            <div key={groupKey} className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.topics.map((topic: { id: string; label: string }) => (
                  <Badge
                    key={topic.id}
                    variant={selectedTopicAvoidances.includes(topic.id) ? "destructive" : "outline"}
                    className="cursor-pointer text-sm px-3 py-1.5"
                    onClick={() => toggleTopicAvoidance(topic.id)}
                    data-testid={`badge-topic-avoid-${topic.id}`}
                  >
                    {topic.label}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button 
            type="submit" 
            className="w-full"
            disabled={updateMutation.isPending || selectedPrimaryInterests.length === 0}
            data-testid="button-save"
          >
            {updateMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </form>
    </div>
  );
}
