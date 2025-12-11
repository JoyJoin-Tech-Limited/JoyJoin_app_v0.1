import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Same interest options as InterestsTopicsPage with emojis
const INTERESTS_OPTIONS = [
  { id: "outdoor_adventure", label: "户外冒险", emoji: "🏔️" },
  { id: "sports_fitness", label: "运动健身", emoji: "⚽" },
  { id: "food_dining", label: "美食探店", emoji: "🍜" },
  { id: "arts_culture", label: "艺术文化", emoji: "🎨" },
  { id: "music_concerts", label: "音乐现场", emoji: "🎵" },
  { id: "reading_books", label: "阅读书籍", emoji: "📚" },
  { id: "tech_gadgets", label: "科技数码", emoji: "💻" },
  { id: "games_board", label: "桌游卡牌", emoji: "🎲" },
  { id: "games_video", label: "电子游戏", emoji: "🎮" },
  { id: "photography", label: "摄影拍照", emoji: "📷" },
  { id: "travel", label: "旅行探索", emoji: "✈️" },
  { id: "diy_crafts", label: "手工DIY", emoji: "✂️" },
  { id: "pets_animals", label: "宠物动物", emoji: "🐶" },
  { id: "volunteering", label: "志愿公益", emoji: "🤝" },
  { id: "entrepreneurship", label: "创业商业", emoji: "💡" },
  { id: "investing", label: "投资理财", emoji: "💰" },
  { id: "meditation", label: "冥想正念", emoji: "🧘" },
  { id: "languages", label: "语言学习", emoji: "🗣️" },
];

// Conversation topics with categories
const TOPICS_OPTIONS = [
  { id: "career_growth", label: "职业发展", category: "work" },
  { id: "startup_ideas", label: "创业想法", category: "work" },
  { id: "tech_trends", label: "科技趋势", category: "tech" },
  { id: "ai_future", label: "AI与未来", category: "tech" },
  { id: "relationships", label: "人际关系", category: "personal" },
  { id: "dating_love", label: "恋爱情感", category: "personal" },
  { id: "mental_health", label: "心理健康", category: "personal" },
  { id: "life_philosophy", label: "人生哲学", category: "personal" },
  { id: "movies_shows", label: "影视剧集", category: "entertainment" },
  { id: "music_taste", label: "音乐品味", category: "entertainment" },
  { id: "travel_stories", label: "旅行故事", category: "lifestyle" },
  { id: "food_culture", label: "美食文化", category: "lifestyle" },
  { id: "fashion_style", label: "时尚穿搭", category: "lifestyle" },
  { id: "current_events", label: "时事新闻", category: "society" },
  { id: "politics", label: "政治话题", category: "society" },
  { id: "social_issues", label: "社会议题", category: "society" },
  { id: "parenting", label: "育儿经验", category: "family" },
  { id: "hobbies_deep", label: "小众爱好", category: "other" },
];

const interestsSchema = z.object({
  interestsTop: z.array(z.string()).optional(),
  topicsHappy: z.array(z.string()).optional(),
  topicsAvoid: z.array(z.string()).optional(),
});

type InterestsForm = z.infer<typeof interestsSchema>;

export default function EditInterestsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const { data: user, isLoading } = useQuery<any>({ queryKey: ["/api/auth/user"] });

  const form = useForm<InterestsForm>({
    resolver: zodResolver(interestsSchema),
    defaultValues: {
      interestsTop: user?.interestsTop || [],
      topicsHappy: user?.topicsHappy || [],
      topicsAvoid: user?.topicsAvoid || [],
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InterestsForm) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "保存成功",
        description: "兴趣偏好已更新",
      });
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

  const toggleInterest = (interestId: string) => {
    const current = form.watch("interestsTop") || [];
    if (current.includes(interestId)) {
      form.setValue("interestsTop", current.filter(i => i !== interestId));
    } else {
      form.setValue("interestsTop", [...current, interestId]);
    }
  };

  const toggleTopicHappy = (topicId: string) => {
    const current = form.watch("topicsHappy") || [];
    if (current.includes(topicId)) {
      form.setValue("topicsHappy", current.filter(t => t !== topicId));
    } else {
      form.setValue("topicsHappy", [...current, topicId]);
    }
  };

  const toggleTopicAvoid = (topicId: string) => {
    const current = form.watch("topicsAvoid") || [];
    if (current.includes(topicId)) {
      form.setValue("topicsAvoid", current.filter(t => t !== topicId));
    } else {
      form.setValue("topicsAvoid", [...current, topicId]);
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

  const selectedInterests = form.watch("interestsTop") || [];
  const selectedTopicsHappy = form.watch("topicsHappy") || [];
  const selectedTopicsAvoid = form.watch("topicsAvoid") || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Content */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 space-y-8 max-w-2xl mx-auto pb-24">
        {/* Interests Section */}
        <div className="space-y-3">
          <div>
            <Label className="text-base font-semibold">兴趣爱好</Label>
            <p className="text-sm text-muted-foreground mt-1">选择你感兴趣的活动类型</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {INTERESTS_OPTIONS.map((interest) => (
              <Badge
                key={interest.id}
                variant={selectedInterests.includes(interest.id) ? "default" : "outline"}
                className="cursor-pointer text-base px-4 py-2.5"
                onClick={() => toggleInterest(interest.id)}
                data-testid={`badge-interest-${interest.id}`}
              >
                <span className="mr-1">{interest.emoji}</span>
                {interest.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Topics Happy Section */}
        <div className="space-y-3">
          <div>
            <Label className="text-base font-semibold">喜欢聊的话题</Label>
            <p className="text-sm text-muted-foreground mt-1">选择你感兴趣的聊天话题</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {TOPICS_OPTIONS.map((topic) => (
              <Badge
                key={topic.id}
                variant={selectedTopicsHappy.includes(topic.id) ? "default" : "outline"}
                className="cursor-pointer text-base px-4 py-2.5"
                onClick={() => toggleTopicHappy(topic.id)}
                data-testid={`badge-topic-happy-${topic.id}`}
              >
                {topic.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Topics Avoid Section */}
        <div className="space-y-3">
          <div>
            <Label className="text-base font-semibold">避免的话题</Label>
            <p className="text-sm text-muted-foreground mt-1">选择你不想聊的话题</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {TOPICS_OPTIONS.map((topic) => (
              <Badge
                key={topic.id}
                variant={selectedTopicsAvoid.includes(topic.id) ? "destructive" : "outline"}
                className="cursor-pointer text-base px-4 py-2.5"
                onClick={() => toggleTopicAvoid(topic.id)}
                data-testid={`badge-topic-avoid-${topic.id}`}
              >
                {topic.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button 
            type="submit" 
            className="w-full"
            disabled={updateMutation.isPending}
            data-testid="button-save"
          >
            {updateMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </form>
    </div>
  );
}
