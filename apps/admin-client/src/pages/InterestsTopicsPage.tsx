import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { interestsTopicsSchema, type InterestsTopics } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/ui/use-toast";
import { Check, Star, Info, Flame, Sparkles, Ban } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import RegistrationProgress from "@/components/_archive/RegistrationProgress";
import CelebrationConfetti from "@/components/profile/CelebrationConfetti";
import InterestMapping from "@/components/profile/InterestMapping";

// Interest categories with emojis - displayed in two tiers (hot first, then more)
// Heat values based on platform big data (基于平台大数据)
const INTERESTS_OPTIONS = [
  // Top 10 热门兴趣 (shown first) - 用词基于100用户调研结果
  { id: "food_dining", label: "美食探店", emoji: "🍜", heat: 82 },
  { id: "travel", label: "说走就走", emoji: "✈️", heat: 75 },
  { id: "city_walk", label: "City Walk", emoji: "🚶", heat: 68 },
  { id: "drinks_bar", label: "喝酒小酌", emoji: "🍷", heat: 62 },
  { id: "music_live", label: "音乐Live", emoji: "🎵", heat: 58 },
  { id: "photography", label: "拍拍拍", emoji: "📷", heat: 52 },
  { id: "sports_fitness", label: "撸铁运动", emoji: "💪", heat: 48 },
  { id: "arts_culture", label: "看展看剧", emoji: "🎨", heat: 45 },
  { id: "games_video", label: "打游戏", emoji: "🎮", heat: 42 },
  { id: "pets_animals", label: "吸猫撸狗", emoji: "🐱", heat: 38 },
  // More options (expandable) - 用词基于100用户调研结果
  { id: "reading_books", label: "看书充电", emoji: "📚", heat: 35 },
  { id: "tech_gadgets", label: "数码控", emoji: "💻", heat: 32 },
  { id: "outdoor_adventure", label: "徒步露营", emoji: "🏕️", heat: 28 },
  { id: "games_board", label: "桌游卡牌", emoji: "🎲", heat: 25 },
  { id: "entrepreneurship", label: "创业商业", emoji: "💡", heat: 22 },
  { id: "investing", label: "投资理财", emoji: "💰", heat: 20 },
  { id: "diy_crafts", label: "手工DIY", emoji: "✂️", heat: 18 },
  { id: "volunteering", label: "志愿公益", emoji: "🤝", heat: 15 },
  { id: "meditation", label: "冥想正念", emoji: "🧘", heat: 12 },
  { id: "languages", label: "语言学习", emoji: "🗣️", heat: 10 },
];

// Topic groups with mood icons - reorganized into three categories
const TOPICS_GROUPS = {
  casual: {
    name: "聊着玩",
    description: "轻松日常，怎么开心怎么聊",
    topics: [
      { id: "movies_shows", label: "追剧躺平", mood: "😄", heat: 68 },
      { id: "music_taste", label: "听歌演唱会", mood: "🎶", heat: 55 },
      { id: "food_culture", label: "美食安利", mood: "😋", heat: 65 },
      { id: "travel_stories", label: "旅行故事", mood: "🌍", heat: 62 },
      { id: "fashion_trends", label: "潮流时尚", mood: "👗", heat: 60 },
      { id: "gossip_entertainment", label: "八卦娱乐", mood: "🤭", heat: 58 },
      { id: "zodiac_mbti", label: "星座MBTI", mood: "✨", heat: 72 },
      { id: "work_rants", label: "职场吐槽", mood: "😤", heat: 65 },
      { id: "hobbies_niche", label: "小众爱好", mood: "🤓", heat: 35 },
    ]
  },
  deep: {
    name: "走心聊",
    description: "认真交流，聊点有深度的",
    topics: [
      { id: "life_philosophy", label: "人生三观", mood: "🤔", heat: 45 },
      { id: "career_growth", label: "职业发展", mood: "📈", heat: 48 },
      { id: "relationships", label: "人际社交", mood: "🤝", heat: 42 },
      { id: "dating_love", label: "恋爱情感", mood: "💕", heat: 52 },
      { id: "mental_health", label: "情绪心理", mood: "🧠", heat: 38 },
      { id: "startup_ideas", label: "创业想法", mood: "💡", heat: 32 },
      { id: "tech_ai", label: "科技AI", mood: "🤖", heat: 40 },
      { id: "self_growth", label: "自我成长", mood: "🌱", heat: 44 },
    ]
  },
  sensitive: {
    name: "看情况",
    description: "因人而异，适合熟了再聊",
    topics: [
      { id: "current_events", label: "时事新闻", mood: "📰", heat: 28 },
      { id: "politics", label: "政治话题", mood: "🏛️", heat: 15 },
      { id: "social_issues", label: "社会议题", mood: "📢", heat: 22 },
      { id: "parenting", label: "育儿经验", mood: "👶", heat: 18 },
      { id: "religion", label: "宗教信仰", mood: "🙏", heat: 12 },
      { id: "money_finance", label: "收入理财", mood: "💰", heat: 25 },
    ]
  }
};

export default function InterestsTopicsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const totalSteps = 2;
  const [showCelebration, setShowCelebration] = useState(false);
  const [showMajorCelebration, setShowMajorCelebration] = useState(false);
  const [showMoreInterests, setShowMoreInterests] = useState(false);

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [primaryInterests, setPrimaryInterests] = useState<string[]>([]);
  const [topicAvoidances, setTopicAvoidances] = useState<string[]>([]);

  // Celebration effect when step 1 completes
  useEffect(() => {
    if (step === 2 && showCelebration) {
      const timer = setTimeout(() => setShowCelebration(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [step, showCelebration]);

  const form = useForm<InterestsTopics>({
    resolver: zodResolver(interestsTopicsSchema),
    defaultValues: {
      interestsTop: [],
      primaryInterests: [],
      topicAvoidances: [],
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: InterestsTopics) => {
      return await apiRequest("POST", "/api/user/interests-topics", data);
    },
    onSuccess: async () => {
      setShowMajorCelebration(true);
      
      toast({
        title: "太棒了！兴趣设置完成",
        description: "接下来是趣味性格测试",
      });
      
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      await queryClient.refetchQueries({ queryKey: ['/api/auth/user'] });
      
      setTimeout(() => {
        setLocation("/personality-test");
      }, 1200);
    },
    onError: (error: Error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleInterest = (interestId: string) => {
    if (selectedInterests.includes(interestId)) {
      const newSelected = selectedInterests.filter(id => id !== interestId);
      setSelectedInterests(newSelected);
      // Also remove from primary if it was primary
      if (primaryInterests.includes(interestId)) {
        setPrimaryInterests(primaryInterests.filter(id => id !== interestId));
      }
    } else {
      if (selectedInterests.length >= 7) {
        toast({
          title: "最多选择7个兴趣",
          variant: "destructive",
        });
        return;
      }
      setSelectedInterests([...selectedInterests, interestId]);
    }
  };

  const togglePrimaryInterest = (interestId: string) => {
    if (!selectedInterests.includes(interestId)) return;
    
    if (primaryInterests.includes(interestId)) {
      setPrimaryInterests(primaryInterests.filter(id => id !== interestId));
    } else {
      if (primaryInterests.length >= 3) {
        toast({
          title: "最多标记3个主要兴趣",
          variant: "destructive",
        });
        return;
      }
      setPrimaryInterests([...primaryInterests, interestId]);
    }
  };

  const toggleTopicAvoidance = (topicId: string) => {
    if (topicAvoidances.includes(topicId)) {
      setTopicAvoidances(topicAvoidances.filter(id => id !== topicId));
    } else {
      if (topicAvoidances.length >= 4) {
        toast({
          title: "最多选择4个",
          variant: "destructive",
        });
        return;
      }
      setTopicAvoidances([...topicAvoidances, topicId]);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      // Validate interests step
      if (selectedInterests.length < 3) {
        toast({
          title: "请至少选择3个兴趣",
          variant: "destructive",
        });
        return;
      }
      if (primaryInterests.length < 1) {
        toast({
          title: "请点击星标标记1-3个主要兴趣",
          variant: "destructive",
        });
        return;
      }
      setShowCelebration(true);
      setTimeout(() => setStep(2), 400);
    } else {
      // Step 2 - topic avoidances (optional, can skip with empty or "都OK")
      saveMutation.mutate({
        interestsTop: selectedInterests,
        primaryInterests: primaryInterests,
        topicAvoidances: topicAvoidances.length > 0 ? topicAvoidances : undefined,
      });
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const progress = (step / totalSteps) * 100;

  const getInterestLabel = (id: string) => {
    const interest = INTERESTS_OPTIONS.find(i => i.id === id);
    return interest ? `${interest.emoji} ${interest.label}` : id;
  };

  // Split interests into visible (first 10) and hidden (rest)
  const visibleInterests = INTERESTS_OPTIONS.slice(0, 10);
  const hiddenInterests = INTERESTS_OPTIONS.slice(10);

  // Calculate similar users count (simulated for now)
  const similarUsersCount = Math.floor(150 + selectedInterests.length * 30 + (primaryInterests.length * 50));

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <RegistrationProgress 
        currentStage="interests" 
        currentStep={step}
        totalSteps={totalSteps}
      />
      
      {/* Celebration overlay */}
      <CelebrationConfetti show={showCelebration} type="step" />
      <CelebrationConfetti show={showMajorCelebration} type="major" />

      {/* Form content */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-6 pb-20">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
          {/* Step 1: Interests Selection */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in-50 duration-300">
              <div>
                <h2 className="text-xl font-bold mb-2">你的兴趣爱好</h2>
                <p className="text-sm text-muted-foreground">
                  兴趣 = 你喜欢做什么（周末活动）
                </p>
              </div>

              <div className="flex items-start gap-2 bg-primary/5 p-3 rounded-md border border-primary/20">
                <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  选择你感兴趣的3-7个，然后点击 <Star className="h-3 w-3 inline text-amber-500" /> 标记1-3个主要兴趣，悦仔会优先匹配同频的人。
                  <span className="text-muted-foreground/70">（热度基于平台大数据）</span>
                </p>
              </div>

              {/* Interest Selection */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>选择兴趣（3-7个）</Label>
                  <motion.span 
                    className="text-xs text-muted-foreground"
                    animate={{ scale: selectedInterests.length > 0 ? [1, 1.05, 1] : 1 }}
                  >
                    已选 <span className="font-semibold text-primary">{selectedInterests.length}</span>/7
                  </motion.span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {visibleInterests.map((interest) => {
                    const isSelected = selectedInterests.includes(interest.id);
                    const isPrimary = primaryInterests.includes(interest.id);
                    return (
                      <div
                        key={interest.id}
                        className={`
                          relative px-4 py-2.5 rounded-lg border-2 transition-all
                          ${isSelected 
                            ? isPrimary 
                              ? 'border-amber-500 bg-amber-500/10' 
                              : 'border-primary bg-primary/5' 
                            : 'border-border hover-elevate'
                          }
                        `}
                      >
                        <button
                          type="button"
                          onClick={() => toggleInterest(interest.id)}
                          data-testid={`button-interest-${interest.id}`}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{interest.emoji}</span>
                            <span className="text-sm font-medium flex-1">{interest.label}</span>
                            {interest.heat >= 50 && (
                              <span className="text-xs text-orange-500 flex items-center gap-0.5">
                                <Flame className="h-3 w-3" />
                                {interest.heat}%
                              </span>
                            )}
                          </div>
                        </button>
                        {isSelected && (
                          <motion.button
                            type="button"
                            onClick={() => togglePrimaryInterest(interest.id)}
                            data-testid={`button-star-${interest.id}`}
                            className="absolute top-1 right-1 p-1"
                            animate={primaryInterests.length === 0 && !isPrimary ? {
                              scale: [1, 1.2, 1],
                              opacity: [0.6, 1, 0.6],
                            } : {}}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          >
                            <Star 
                              className={`h-4 w-4 transition-colors ${
                                isPrimary 
                                  ? 'text-amber-500 fill-amber-500' 
                                  : 'text-muted-foreground hover:text-amber-400'
                              }`} 
                            />
                          </motion.button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Expand more button */}
                {!showMoreInterests && hiddenInterests.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowMoreInterests(true)}
                    className="w-full mt-3 py-2 text-sm text-primary hover:underline"
                    data-testid="button-show-more-interests"
                  >
                    查看更多兴趣 ({hiddenInterests.length}个)
                  </button>
                )}

                {/* Hidden interests */}
                <AnimatePresence>
                  {showMoreInterests && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {hiddenInterests.map((interest) => {
                          const isSelected = selectedInterests.includes(interest.id);
                          const isPrimary = primaryInterests.includes(interest.id);
                          return (
                            <div
                              key={interest.id}
                              className={`
                                relative px-4 py-2.5 rounded-lg border-2 transition-all
                                ${isSelected 
                                  ? isPrimary 
                                    ? 'border-amber-500 bg-amber-500/10' 
                                    : 'border-primary bg-primary/5' 
                                  : 'border-border hover-elevate'
                                }
                              `}
                            >
                              <button
                                type="button"
                                onClick={() => toggleInterest(interest.id)}
                                data-testid={`button-interest-${interest.id}`}
                                className="w-full text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">{interest.emoji}</span>
                                  <span className="text-sm font-medium">{interest.label}</span>
                                </div>
                              </button>
                              {isSelected && (
                                <motion.button
                                  type="button"
                                  onClick={() => togglePrimaryInterest(interest.id)}
                                  data-testid={`button-star-${interest.id}`}
                                  className="absolute top-1 right-1 p-1"
                                  animate={primaryInterests.length === 0 && !isPrimary ? {
                                    scale: [1, 1.2, 1],
                                    opacity: [0.6, 1, 0.6],
                                  } : {}}
                                  transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    ease: "easeInOut",
                                  }}
                                >
                                  <Star 
                                    className={`h-4 w-4 transition-colors ${
                                      isPrimary 
                                        ? 'text-amber-500 fill-amber-500' 
                                        : 'text-muted-foreground hover:text-amber-400'
                                    }`} 
                                  />
                                </motion.button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Primary interests indicator */}
              {primaryInterests.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"
                >
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span className="text-sm">
                    主要兴趣（{primaryInterests.length}/3）：
                    <span className="font-semibold">{primaryInterests.map(id => getInterestLabel(id)).join('、')}</span>
                  </span>
                </motion.div>
              )}

              {/* Similar users count */}
              {selectedInterests.length >= 3 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-sm text-muted-foreground"
                >
                  ✨ 平台上有 <span className="font-semibold text-primary">{similarUsersCount}</span> 人和你兴趣相似
                </motion.div>
              )}

              {/* Interest Mapping Visualization */}
              {selectedInterests.length >= 3 && primaryInterests.length >= 1 && (
                <>
                  <Separator className="my-4" />
                  <InterestMapping
                    selectedInterests={selectedInterests}
                    primaryInterests={primaryInterests}
                    allInterestsOptions={INTERESTS_OPTIONS}
                  />
                </>
              )}
            </div>
          )}

          {/* Step 2: Topic Avoidances (排斥法) */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in-50 duration-300">
              <div>
                <h2 className="text-xl font-bold mb-2">话题雷区</h2>
                <p className="text-sm text-muted-foreground">
                  有些话题不适合在饭桌上聊？告诉悦仔，帮你避开尴尬
                </p>
              </div>

              <div className="flex items-start gap-2 bg-primary/5 p-3 rounded-md border border-primary/20">
                <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  选择最多4个你不想在饭局上聊的话题（可选）。没有特别排斥的话题？直接点「完成」跳过
                </p>
              </div>

              {/* Topic avoidance options */}
              <div className="space-y-4">
                {Object.entries(TOPICS_GROUPS).map(([groupKey, group]) => (
                  <div key={groupKey}>
                    <div className="mb-2">
                      <h3 className="font-medium text-sm text-muted-foreground">{group.name}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {group.topics.map((topic) => {
                        const isAvoided = topicAvoidances.includes(topic.id);
                        return (
                          <button
                            key={topic.id}
                            type="button"
                            onClick={() => toggleTopicAvoidance(topic.id)}
                            data-testid={`button-topic-avoid-${topic.id}`}
                            className={`
                              px-3 py-2.5 rounded-lg border-2 transition-all text-sm text-left
                              ${isAvoided 
                                ? 'border-red-400 bg-red-400/10 text-red-600 dark:text-red-400' 
                                : 'border-border hover-elevate'
                              }
                            `}
                          >
                            <div className="flex items-center gap-2">
                              <Ban className={`h-4 w-4 ${isAvoided ? 'text-red-500' : 'text-muted-foreground/50'}`} />
                              <span>{topic.label}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {groupKey !== 'sensitive' && <Separator className="my-3" />}
                  </div>
                ))}
              </div>

              {/* Selection summary */}
              <div className="space-y-2 pt-2">
                {topicAvoidances.length > 0 ? (
                  <div className="flex items-center gap-2 text-sm text-red-500">
                    <Ban className="h-4 w-4" />
                    <span>已选 {topicAvoidances.length}/4 个不想聊的话题</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>都OK，没有特别排斥的话题</span>
                  </div>
                )}
              </div>
            </div>
          )}
          </motion.div>
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="border-t p-4 bg-background sticky bottom-0">
        <div className="max-w-2xl mx-auto flex gap-3">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1"
              data-testid="button-back"
            >
              上一步
            </Button>
          )}
          <Button
            onClick={handleNext}
            className="flex-1"
            disabled={saveMutation.isPending}
            data-testid="button-next"
          >
            {step === totalSteps ? (
              saveMutation.isPending ? "保存中..." : "完成"
            ) : (
              "下一步"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
