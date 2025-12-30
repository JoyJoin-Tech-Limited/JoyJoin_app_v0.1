import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Sparkles, 
  ArrowRight, 
  ChevronLeft,
  User,
  MapPin,
  Target,
  Calendar,
  Heart,
  Briefcase,
  Zap,
  Star,
  Check,
} from "lucide-react";
import { archetypeConfig } from "@/lib/archetypes";
import { archetypeAvatars, archetypeGradients } from "@/lib/archetypeAvatars";
import { intentOptions } from "@/lib/userFieldMappings";
import { 
  GENDER_OPTIONS, 
  CURRENT_CITY_OPTIONS, 
  RELATIONSHIP_STATUS_OPTIONS,
  WORK_MODE_OPTIONS,
  WORK_MODE_LABELS,
} from "@shared/constants";
import type { RoleResult } from "@shared/schema";

import xiaoyueNormal from "@assets/Xiao_Yue_Avatar-01_1766766685652.png";
import xiaoyueExcited from "@assets/Xiao_Yue_Avatar-03_1766766685650.png";
import xiaoyuePointing from "@assets/Xiao_Yue_Avatar-04_1766766685649.png";

const POST_TEST_CACHE_KEY = "joyjoin_post_test_flow";
const CACHE_EXPIRY_HOURS = 24;

// Interest options for extended data (simplified from InterestsTopicsPage)
const INTERESTS_OPTIONS = [
  { id: "food_dining", label: "美食探店" },
  { id: "travel", label: "说走就走" },
  { id: "city_walk", label: "City Walk" },
  { id: "drinks_bar", label: "喝酒小酌" },
  { id: "music_live", label: "音乐Live" },
  { id: "photography", label: "拍拍拍" },
  { id: "sports_fitness", label: "撸铁运动" },
  { id: "arts_culture", label: "看展看剧" },
  { id: "games_video", label: "打游戏" },
  { id: "pets_animals", label: "吸猫撸狗" },
  { id: "reading_books", label: "看书充电" },
  { id: "tech_gadgets", label: "数码控" },
  { id: "outdoor_adventure", label: "徒步露营" },
  { id: "games_board", label: "桌游卡牌" },
  { id: "entrepreneurship", label: "创业商业" },
];

// Industry options for extended data
const INDUSTRY_OPTIONS = [
  { id: "tech_internet", label: "互联网/科技" },
  { id: "finance_banking", label: "金融/银行" },
  { id: "consulting_professional", label: "咨询/专业服务" },
  { id: "media_entertainment", label: "媒体/娱乐" },
  { id: "education_research", label: "教育/科研" },
  { id: "healthcare_medical", label: "医疗/健康" },
  { id: "retail_consumer", label: "零售/消费" },
  { id: "manufacturing", label: "制造/工业" },
  { id: "real_estate", label: "房地产" },
  { id: "government_ngo", label: "政府/公益" },
  { id: "creative_design", label: "创意/设计" },
  { id: "other", label: "其他" },
];

type FlowStep = "results" | "essential" | "extended" | "complete";

interface PostTestData {
  step: FlowStep;
  nickname: string;
  gender: string;
  city: string;
  intent: string[];
  birthYear: string;
  birthYearVisible: boolean;
  relationshipStatus: string;
  workMode: string;
  industry: string;
  interests: string[];
  timestamp: number;
}

type XiaoyueMood = "normal" | "excited" | "pointing";

const XIAOYUE_AVATARS: Record<XiaoyueMood, string> = {
  normal: xiaoyueNormal,
  excited: xiaoyueExcited,
  pointing: xiaoyuePointing,
};

function XiaoyueMascot({ 
  mood = "normal", 
  message,
  className,
  horizontal = false,
  size = "normal",
}: { 
  mood?: XiaoyueMood; 
  message: string;
  className?: string;
  horizontal?: boolean;
  size?: "normal" | "large";
}) {
  const imgSize = size === "large" ? "w-20 h-20" : "w-16 h-16";
  
  if (horizontal) {
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <motion.div
          animate={{ 
            scale: [1, 1.02, 1],
            y: [0, -2, 0],
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative shrink-0"
        >
          <img 
            src={XIAOYUE_AVATARS[mood]} 
            alt="小悦" 
            className={cn(imgSize, "object-contain drop-shadow-lg")}
            data-testid="img-xiaoyue-avatar"
          />
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="relative bg-card border border-border rounded-2xl px-4 py-3 shadow-md flex-1"
        >
          <div className="absolute top-4 -left-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-card" />
          <div className="absolute top-4 -left-[9px] w-0 h-0 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-border" />
          <p className="text-lg leading-relaxed" data-testid="text-xiaoyue-message">
            {message}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <motion.div
        animate={{ 
          scale: [1, 1.02, 1],
          y: [0, -3, 0],
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative"
      >
        <img 
          src={XIAOYUE_AVATARS[mood]} 
          alt="小悦" 
          className={cn(size === "large" ? "w-32 h-32" : "w-28 h-28", "object-contain drop-shadow-lg")}
          data-testid="img-xiaoyue-avatar"
        />
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="relative bg-card border border-border rounded-2xl px-5 py-3 shadow-md max-w-[300px]"
      >
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-card" />
        <div className="absolute -top-[9px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-border" />
        <p className="text-center text-base leading-relaxed" data-testid="text-xiaoyue-message">
          {message}
        </p>
      </motion.div>
    </div>
  );
}

function SelectionChips({
  options,
  selected,
  onSelect,
  multiSelect = false,
}: {
  options: { value: string; label: string; description?: string }[];
  selected: string | string[];
  onSelect: (value: string | string[]) => void;
  multiSelect?: boolean;
}) {
  const handleSelect = (value: string) => {
    if (multiSelect) {
      const currentSelected = Array.isArray(selected) ? selected : [];
      if (value === "flexible") {
        if (currentSelected.includes("flexible")) {
          onSelect([]);
        } else {
          onSelect(["flexible"]);
        }
      } else {
        if (currentSelected.includes(value)) {
          onSelect(currentSelected.filter(v => v !== value));
        } else {
          const newSelection = currentSelected.filter(v => v !== "flexible");
          onSelect([...newSelection, value]);
        }
      }
    } else {
      onSelect(value);
    }
  };

  const isSelected = (value: string) => {
    if (multiSelect) {
      return Array.isArray(selected) && selected.includes(value);
    }
    return selected === value;
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option, index) => (
        <motion.button
          key={option.value}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleSelect(option.value)}
          className={cn(
            "px-3 py-2 rounded-lg border transition-all duration-200 min-h-[44px]",
            "hover-elevate active-elevate-2",
            isSelected(option.value)
              ? "border-primary bg-primary/10 shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
          data-testid={`chip-${option.value}`}
        >
          <span className={cn(
            "text-[15px] font-medium",
            isSelected(option.value) && "text-primary"
          )}>
            {option.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}

function ButtonGroup({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((option, index) => (
        <motion.button
          key={option}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: index * 0.05 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => onSelect(option)}
          className={cn(
            "flex-1 py-4 px-4 rounded-xl border-2 transition-all duration-200 min-h-[56px]",
            "hover-elevate active-elevate-2 text-base font-medium",
            selected === option
              ? "border-primary bg-primary/10 text-primary shadow-sm"
              : "border-border bg-card hover:border-primary/50"
          )}
          data-testid={`button-${option}`}
        >
          {option}
        </motion.button>
      ))}
    </div>
  );
}

function loadCachedData(): PostTestData | null {
  try {
    const cached = localStorage.getItem(POST_TEST_CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as PostTestData;
    const now = Date.now();
    const expiryMs = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
    
    if (now - data.timestamp > expiryMs) {
      localStorage.removeItem(POST_TEST_CACHE_KEY);
      return null;
    }
    
    return data;
  } catch {
    localStorage.removeItem(POST_TEST_CACHE_KEY);
    return null;
  }
}

function saveCachedData(data: Partial<PostTestData>) {
  try {
    const existing = loadCachedData();
    const updated: PostTestData = {
      step: data.step || existing?.step || "results",
      nickname: data.nickname ?? existing?.nickname ?? "",
      gender: data.gender ?? existing?.gender ?? "",
      city: data.city ?? existing?.city ?? "",
      intent: data.intent ?? existing?.intent ?? [],
      birthYear: data.birthYear ?? existing?.birthYear ?? "",
      birthYearVisible: data.birthYearVisible ?? existing?.birthYearVisible ?? true,
      relationshipStatus: data.relationshipStatus ?? existing?.relationshipStatus ?? "",
      workMode: data.workMode ?? existing?.workMode ?? "",
      industry: data.industry ?? existing?.industry ?? "",
      interests: data.interests ?? existing?.interests ?? [],
      timestamp: Date.now(),
    };
    localStorage.setItem(POST_TEST_CACHE_KEY, JSON.stringify(updated));
  } catch {
    console.error("Failed to save post-test data");
  }
}

function clearCachedData() {
  localStorage.removeItem(POST_TEST_CACHE_KEY);
}

export default function PostTestFlowPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState<FlowStep>("results");
  const [showReveal, setShowReveal] = useState(true);
  const [countdown, setCountdown] = useState(3);
  
  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [intent, setIntent] = useState<string[]>([]);
  
  const [birthYear, setBirthYear] = useState("");
  const [birthYearVisible, setBirthYearVisible] = useState(true);
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [workMode, setWorkMode] = useState("");
  const [industry, setIndustry] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  
  const [completeCountdown, setCompleteCountdown] = useState(3);

  const { data: result, isLoading } = useQuery<RoleResult>({
    queryKey: ['/api/personality-test/results'],
  });

  const archetype = result?.primaryRole || "开心柯基";
  const archetypeData = archetypeConfig[archetype];
  const archetypeAvatar = archetypeAvatars[archetype];
  const archetypeGradient = archetypeGradients[archetype];

  useEffect(() => {
    const cached = loadCachedData();
    if (cached) {
      if (cached.step !== "results") {
        setStep(cached.step);
        setShowReveal(false);
      }
      setNickname(cached.nickname);
      setGender(cached.gender);
      setCity(cached.city);
      setIntent(cached.intent);
      setBirthYear(cached.birthYear);
      setBirthYearVisible(cached.birthYearVisible);
      setRelationshipStatus(cached.relationshipStatus);
      setWorkMode(cached.workMode);
      setIndustry(cached.industry || "");
      setInterests(cached.interests || []);
    }
  }, []);

  useEffect(() => {
    if (!result || !showReveal) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => setShowReveal(false), 500);
      return () => clearTimeout(timer);
    }
  }, [countdown, result, showReveal]);

  useEffect(() => {
    if (step !== "complete") return;

    if (completeCountdown > 0) {
      const timer = setTimeout(() => setCompleteCountdown(completeCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setLocation("/discover");
    }
  }, [step, completeCountdown, setLocation]);

  const progress = useMemo(() => {
    switch (step) {
      case "results": return 33;
      case "essential": return 66;
      case "extended": return 100;
      case "complete": return 100;
      default: return 0;
    }
  }, [step]);

  const birthYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let year = currentYear - 18; year >= currentYear - 60; year--) {
      years.push(year.toString());
    }
    return years;
  }, []);

  const saveProfileMutation = useMutation({
    mutationFn: async (data: {
      displayName: string;
      gender: string;
      currentCity: string;
      intent: string[];
      birthdate?: string;
      ageVisibility?: string;
      relationshipStatus?: string;
      workMode?: string;
    }) => {
      return await apiRequest("PATCH", "/api/profile", data);
    },
    onSuccess: async () => {
      await apiRequest("POST", "/api/auth/complete-personality-test");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      clearCachedData();
      setStep("complete");
    },
    onError: (error: Error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleResultsContinue = () => {
    setStep("essential");
    saveCachedData({ step: "essential" });
  };

  const handleEssentialContinue = () => {
    if (!nickname || nickname.length < 2) {
      toast({ title: "请输入至少2个字符的昵称", variant: "destructive" });
      return;
    }
    if (!gender) {
      toast({ title: "请选择性别", variant: "destructive" });
      return;
    }
    if (!city) {
      toast({ title: "请选择所在城市", variant: "destructive" });
      return;
    }
    if (intent.length === 0) {
      toast({ title: "请至少选择一个活动意图", variant: "destructive" });
      return;
    }

    saveCachedData({ 
      step: "extended",
      nickname,
      gender,
      city,
      intent,
    });
    setStep("extended");
  };

  const handleExtendedComplete = () => {
    const profileData: any = {
      displayName: nickname,
      gender,
      currentCity: city,
      intent,
    };

    if (birthYear) {
      profileData.birthdate = `${birthYear}-01-01`;
      profileData.ageVisibility = birthYearVisible ? "show_age_range" : "hide_all";
    }
    if (relationshipStatus) {
      profileData.relationshipStatus = relationshipStatus;
    }
    if (workMode) {
      profileData.workMode = workMode;
    }
    if (industry) {
      profileData.industry = industry;
    }
    if (interests.length > 0) {
      profileData.interestsTop = interests;
    }

    saveProfileMutation.mutate(profileData);
  };

  const toggleInterest = (interestId: string) => {
    if (interests.includes(interestId)) {
      setInterests(interests.filter(id => id !== interestId));
    } else {
      if (interests.length >= 5) {
        toast({ title: "最多选择5个兴趣", variant: "destructive" });
        return;
      }
      setInterests([...interests, interestId]);
    }
  };

  const handleSkipExtended = () => {
    const profileData = {
      displayName: nickname,
      gender,
      currentCity: city,
      intent,
    };
    saveProfileMutation.mutate(profileData);
  };

  const handleBack = () => {
    if (step === "essential") {
      setStep("results");
      saveCachedData({ step: "results" });
    } else if (step === "extended") {
      setStep("essential");
      saveCachedData({ step: "essential" });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-muted-foreground">正在加载你的结果...</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">未找到测试结果</p>
          <Button onClick={() => setLocation("/personality-test")} data-testid="button-retry">
            重新测试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AnimatePresence>
        {showReveal && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
              className="text-center"
            >
              {countdown > 0 ? (
                <motion.span
                  key={countdown}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.5, opacity: 0 }}
                  className="text-8xl font-bold text-primary"
                >
                  {countdown}
                </motion.span>
              ) : (
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-4"
                >
                  <Sparkles className="w-16 h-16 text-primary" />
                  <span className="text-2xl font-bold">揭晓结果</span>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {step !== "complete" && (
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {step !== "results" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBack}
                  data-testid="button-back"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-semibold">
                {step === "results" ? "测试结果" : step === "essential" ? "基础信息" : "更多信息"}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {step === "results" ? "1" : step === "essential" ? "2" : "3"}/3
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>
      )}

      <div className="p-4 pb-32">
        <AnimatePresence mode="wait">
          {step === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-6"
            >
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", duration: 0.8, delay: 0.2 }}
                  className={cn(
                    "w-32 h-32 mx-auto rounded-full p-1",
                    "bg-gradient-to-br",
                    archetypeGradient
                  )}
                >
                  <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
                    <img 
                      src={archetypeAvatar} 
                      alt={archetype}
                      className="w-28 h-28 object-contain"
                      data-testid="img-archetype-avatar"
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="space-y-2"
                >
                  <p className="text-muted-foreground">你是</p>
                  <h1 className="text-3xl font-bold text-foreground" data-testid="text-archetype-name">
                    {archetype}
                  </h1>
                  <Badge variant="secondary" className="text-sm">
                    {archetypeData?.nickname || "社交达人"}
                  </Badge>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-card rounded-2xl p-5 border shadow-sm"
              >
                <p className="text-base leading-relaxed text-foreground/80" data-testid="text-archetype-description">
                  {archetypeData?.description || "独特的社交风格"}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="space-y-3"
              >
                <h3 className="font-semibold text-center">你的核心特质</h3>
                <div className="space-y-2">
                  {(archetypeData?.traits || ["独特", "有趣", "友善"]).map((trait, index) => (
                    <motion.div
                      key={trait}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1 + index * 0.1 }}
                      className="flex items-center gap-3 bg-card rounded-xl p-4 border"
                      data-testid={`trait-${index}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        {index === 0 ? <Zap className="w-4 h-4 text-primary" /> : 
                         index === 1 ? <Star className="w-4 h-4 text-primary" /> :
                         <Heart className="w-4 h-4 text-primary" />}
                      </div>
                      <span className="text-base font-medium">{trait}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}

          {step === "essential" && (
            <motion.div
              key="essential"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-6"
            >
              <XiaoyueMascot
                mood="normal"
                message="最后4个问题，帮你找到最合拍的人"
                horizontal
                size="large"
              />

              <div className="space-y-5">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-2"
                >
                  <Label className="flex items-center gap-2 text-base">
                    <User className="w-4 h-4 text-primary" />
                    昵称
                  </Label>
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="至少2个字符"
                    className="h-14 text-base rounded-xl"
                    data-testid="input-nickname"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <Label className="flex items-center gap-2 text-base">
                    <Heart className="w-4 h-4 text-primary" />
                    性别
                  </Label>
                  <ButtonGroup
                    options={GENDER_OPTIONS.filter(g => g !== "不透露") as unknown as string[]}
                    selected={gender}
                    onSelect={setGender}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-2"
                >
                  <Label className="flex items-center gap-2 text-base">
                    <MapPin className="w-4 h-4 text-primary" />
                    所在城市
                  </Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger className="h-14 text-base rounded-xl" data-testid="select-city">
                      <SelectValue placeholder="选择城市" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENT_CITY_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c} className="text-base py-3">
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-2"
                >
                  <Label className="flex items-center gap-2 text-base">
                    <Target className="w-4 h-4 text-primary" />
                    活动意图（可多选）
                  </Label>
                  <SelectionChips
                    options={intentOptions.map(o => ({ value: o.value, label: o.label }))}
                    selected={intent}
                    onSelect={(v) => setIntent(v as string[])}
                    multiSelect
                  />
                </motion.div>
              </div>
            </motion.div>
          )}

          {step === "extended" && (
            <motion.div
              key="extended"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-md mx-auto space-y-6"
            >
              <XiaoyueMascot
                mood="pointing"
                message="再多了解一点，匹配更精准"
                horizontal
                size="large"
              />

              <div className="space-y-5">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-base">
                      <Calendar className="w-4 h-4 text-primary" />
                      出生年份
                    </Label>
                    <button
                      onClick={() => setBirthYearVisible(!birthYearVisible)}
                      className={cn(
                        "text-sm px-3 py-1 rounded-full transition-colors",
                        birthYearVisible 
                          ? "bg-primary/10 text-primary" 
                          : "bg-muted text-muted-foreground"
                      )}
                      data-testid="toggle-birth-visibility"
                    >
                      {birthYearVisible ? "显示" : "保密"}
                    </button>
                  </div>
                  <Select value={birthYear} onValueChange={setBirthYear}>
                    <SelectTrigger className="h-14 text-base rounded-xl" data-testid="select-birthyear">
                      <SelectValue placeholder="选择年份" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {birthYearOptions.map((year) => (
                        <SelectItem key={year} value={year} className="text-base py-3">
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-2"
                >
                  <Label className="flex items-center gap-2 text-base">
                    <Heart className="w-4 h-4 text-primary" />
                    感情状态
                  </Label>
                  <SelectionChips
                    options={RELATIONSHIP_STATUS_OPTIONS.filter(r => r !== "不透露").map(r => ({ value: r, label: r }))}
                    selected={relationshipStatus}
                    onSelect={(v) => setRelationshipStatus(v as string)}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-2"
                >
                  <Label className="flex items-center gap-2 text-base">
                    <Briefcase className="w-4 h-4 text-primary" />
                    工作状态
                  </Label>
                  <SelectionChips
                    options={WORK_MODE_OPTIONS.map(w => ({ 
                      value: w, 
                      label: WORK_MODE_LABELS[w] 
                    }))}
                    selected={workMode}
                    onSelect={(v) => setWorkMode(v as string)}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-2"
                >
                  <Label className="flex items-center gap-2 text-base">
                    <Briefcase className="w-4 h-4 text-primary" />
                    所在行业
                  </Label>
                  <SelectionChips
                    options={INDUSTRY_OPTIONS.map(i => ({ 
                      value: i.id, 
                      label: i.label 
                    }))}
                    selected={industry}
                    onSelect={(v) => setIndustry(v as string)}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="space-y-2"
                >
                  <Label className="flex items-center gap-2 text-base">
                    <Star className="w-4 h-4 text-primary" />
                    兴趣爱好（最多5个）
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {INTERESTS_OPTIONS.map((interest, index) => (
                      <motion.button
                        key={interest.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: index * 0.02 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleInterest(interest.id)}
                        className={cn(
                          "px-3 py-2 rounded-xl border-2 transition-all duration-200 min-h-[44px]",
                          "hover-elevate active-elevate-2",
                          interests.includes(interest.id)
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-card hover:border-primary/50"
                        )}
                        data-testid={`chip-interest-${interest.id}`}
                      >
                        <span className={cn(
                          "text-[15px] font-medium",
                          interests.includes(interest.id) && "text-primary"
                        )}>
                          {interest.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {step === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4"
            >
              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotate: [0, 2, -2, 0],
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative mb-8"
              >
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl scale-150" />
                <img 
                  src={xiaoyueExcited} 
                  alt="小悦" 
                  className="w-32 h-32 object-contain relative z-10 drop-shadow-xl"
                  data-testid="img-xiaoyue-celebration"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="absolute -top-2 -right-2"
                >
                  <Sparkles className="w-8 h-8 text-yellow-400" />
                </motion.div>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
                  className="absolute -bottom-1 -left-3"
                >
                  <Star className="w-6 h-6 text-primary fill-primary" />
                </motion.div>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-bold mb-3"
                data-testid="text-complete-title"
              >
                太棒了，小悦已经认识你啦！
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-muted-foreground mb-8"
                data-testid="text-complete-subtitle"
              >
                现在去看看有哪些适合你的小聚
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-4 mb-8"
              >
                <div 
                  className={cn(
                    "w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg",
                    archetypeGradient
                  )}
                >
                  <span className="text-4xl">{archetypeAvatar}</span>
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">你的社交人格</p>
                  <p className="text-xl font-bold">{archetype}</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="w-full max-w-xs"
              >
                <Button
                  onClick={() => setLocation("/discover")}
                  className="w-full min-h-[68px] text-lg rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-lg"
                  size="lg"
                  data-testid="button-start-explore"
                >
                  开始探索
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="flex items-center gap-2 text-sm text-muted-foreground mt-4"
              >
                <div className="relative w-5 h-5">
                  <svg className="w-5 h-5 transform -rotate-90">
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      className="opacity-20"
                    />
                    <circle
                      cx="10"
                      cy="10"
                      r="8"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      strokeDasharray={`${(completeCountdown / 3) * 50.26} 50.26`}
                      className="text-primary transition-all duration-1000"
                    />
                  </svg>
                </div>
                <span>{completeCountdown} 秒后自动跳转</span>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="text-sm text-muted-foreground mt-12"
              >
                想要更精准的匹配？
                <button 
                  onClick={() => setLocation("/profile/enrich")}
                  className="text-primary hover:underline ml-1"
                  data-testid="link-enrich-profile"
                >
                  稍后可以继续完善资料
                </button>
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {step !== "complete" && (
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4">
        <div className="max-w-md mx-auto">
          {step === "results" && (
            <div className="space-y-3">
              <Button
                onClick={() => setLocation("/personality-test/result")}
                className="w-full min-h-[68px] text-lg rounded-xl bg-gradient-to-r from-primary to-primary/80 shadow-lg"
                size="lg"
                data-testid="button-view-results"
              >
                查看完整结果
                <Sparkles className="w-5 h-5 ml-2" />
              </Button>
              <Button
                onClick={handleResultsContinue}
                variant="outline"
                className="w-full min-h-[56px] text-base rounded-xl"
                size="lg"
                data-testid="button-continue-results"
              >
                继续完善资料
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {step === "essential" && (
            <Button
              onClick={handleEssentialContinue}
              className="w-full h-14 text-lg rounded-xl"
              size="lg"
              data-testid="button-continue-essential"
            >
              进入悦聚
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          )}

          {step === "extended" && (
            <div className="space-y-3">
              <Button
                onClick={handleExtendedComplete}
                className="w-full h-14 text-lg rounded-xl"
                size="lg"
                disabled={saveProfileMutation.isPending}
                data-testid="button-complete"
              >
                {saveProfileMutation.isPending ? (
                  "保存中..."
                ) : (
                  <>
                    完成
                    <Check className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
              <button
                onClick={handleSkipExtended}
                disabled={saveProfileMutation.isPending}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                data-testid="button-skip"
              >
                稍后完善
              </button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
