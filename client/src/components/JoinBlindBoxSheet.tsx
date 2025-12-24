//my path:/Users/felixg/projects/JoyJoin3/client/src/components/JoinBlindBoxSheet.tsx
import { useState } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Calendar, 
  MapPin, 
  Users, 
  ChevronRight,
  Info,
  CheckCircle2,
  DollarSign,
  Sparkles,
  Share2,
  UserPlus
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getCurrencySymbol } from "@/lib/currency";
import { 
  shenzhenClusters
} from "@/lib/districts";

interface JoinBlindBoxSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventData: {
    poolId: string | null;
    date: string;
    time: string;
    eventType: "饭局" | "酒局";
    area: string;
    priceTier?: string;
    isAA?: boolean;
    isGirlsNight?: boolean;
    city?: "香港" | "深圳";
  };
}

export default function JoinBlindBoxSheet({ 
  open, 
  onOpenChange, 
  eventData 
}: JoinBlindBoxSheetProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [mustMatchTogether, setMustMatchTogether] = useState(true);
  
  // 预算偏好 - 可多选
  const [budgetPreference, setBudgetPreference] = useState<string[]>([]);
  
  // 确认弹窗状态
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // 商圈多选 - 选择片区自动全选该片区所有商圈
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  
  // 组队邀请状态
  const [showTeamInvite, setShowTeamInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [teammateStatus, setTeammateStatus] = useState<'waiting' | 'joined' | null>(null);

  // 用户偏好 - 语言和口味
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedTasteIntensity, setSelectedTasteIntensity] = useState<string[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  
  // 参与意图 - Event-specific intent (multi-select)
  const [selectedIntent, setSelectedIntent] = useState<string[]>([]);

  const budgetOptions = [
    { value: "150以下", label: "≤150" },
    { value: "150-200", label: "150-200" },
    { value: "200-300", label: "200-300" },
    { value: "300-500", label: "300-500" },
  ];

  const languageOptions = [
    { value: "中文（国语）", label: "中文（国语）" },
    { value: "中文（粤语）", label: "中文（粤语）" },
    { value: "英语", label: "英语" },
  ];

  const tasteIntensityOptions = [
    { value: "爱吃辣", label: "爱吃辣" },
    { value: "不辣/清淡为主", label: "不辣/清淡为主" },
  ];

  const cuisineOptions = [
    { value: "中餐", label: "中餐" },
    { value: "川菜", label: "川菜" },
    { value: "粤菜", label: "粤菜" },
    { value: "火锅", label: "火锅" },
    { value: "烧烤", label: "烧烤" },
    { value: "西餐", label: "西餐" },
    { value: "日料", label: "日料" },
  ];

  const toggleBudget = (value: string) => {
    setBudgetPreference(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const toggleLanguage = (value: string) => {
    setSelectedLanguages(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const toggleTasteIntensity = (value: string) => {
    setSelectedTasteIntensity(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  // Toggle intent with flexible exclusivity logic
  const toggleIntent = (intentValue: string) => {
    if (intentValue === "flexible") {
      // If selecting "flexible", clear all other intents
      if (selectedIntent.includes("flexible")) {
        setSelectedIntent([]);
      } else {
        setSelectedIntent(["flexible"]);
      }
    } else {
      // If selecting a specific intent
      if (selectedIntent.includes(intentValue)) {
        // Deselect this intent
        setSelectedIntent(selectedIntent.filter(i => i !== intentValue));
      } else {
        // Select this intent and remove "flexible" if present
        const newIntents = selectedIntent.filter(i => i !== "flexible");
        setSelectedIntent([...newIntents, intentValue]);
      }
    }
  };

  const toggleCuisine = (value: string) => {
    setSelectedCuisines(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const clearAllPreferences = () => {
    setSelectedLanguages([]);
    setSelectedTasteIntensity([]);
    setSelectedCuisines([]);
  };

  const saveBudgetMutation = useMutation({
    mutationFn: async (budgetPreference: string[]) => {
      return await apiRequest("POST", "/api/profile/budget", {
        budgetPreference,
      });
    },
    onError: (error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConfirm = () => {
    if (budgetPreference.length === 0) {
      toast({
        title: "请选择预算范围",
        description: "至少选择一个预算档位",
        variant: "destructive",
      });
      return;
    }

    // 打开确认弹窗
    setShowConfirmDialog(true);
  };

  const handleFinalConfirm = async () => {
    // 保存预算偏好到用户profile
    try {
      await saveBudgetMutation.mutateAsync(budgetPreference);

      // 归一化前端要传给后端 / 支付页的数据
      const city = eventData.city || "深圳";
      const area = eventData.area;
      // 目前后端将 district 用作「商圈/区域」键；先用 area 直接作为 district，保证与默认池 key 一致
      const district = area;

      // 用户本次报名的主预算档（取所选中的第一个）
      const primaryBudgetTier = budgetPreference[0] || "";

      // 保存城市信息和用户偏好到localStorage用于后续页面
      localStorage.setItem("blindbox_city", city);
      localStorage.setItem(
        "blindbox_preferences",
        JSON.stringify({
          languages: selectedLanguages,
          tasteIntensity: selectedTasteIntensity,
          cuisines: selectedCuisines,
        })
      );

      // 保存盲盒事件数据到localStorage，用于支付页调用 /api/blind-box-events
      const blindboxEventPayload = {
        // 关联的活动池 ID（用于后端将用户报名写入正确的池子）
        poolId: eventData.poolId || null,

        // 基本信息
        date: eventData.date,
        time: eventData.time,
        eventType: eventData.eventType,
        city,

        // 区域相关：同时写 district 和 area，后端会优先用 district，fallback 到 area
        district,
        area,

        // 预算：数组 + 主预算档，兼容后端的 budget / budgetTier 逻辑
        budgetTier: primaryBudgetTier,
        budget: budgetPreference,

        // 偏好信息
        selectedDistricts,
        acceptNearby: selectedDistricts.length > 1,
        selectedLanguages,
        selectedTasteIntensity,
        selectedCuisines,

        // 参与意图：同时写入 socialGoals 和 intent，方便后端与其它模块复用
        socialGoals: selectedIntent,
        intent: selectedIntent,

        // 组队邀请相关
        inviteFriends: showTeamInvite,
        friendsCount: showTeamInvite ? 1 : 0,
        inviteLink: showTeamInvite ? inviteLink : null,
        mustMatchTogether: showTeamInvite ? mustMatchTogether : false,
      };

      console.log("[JoinBlindBoxSheet] saving blindbox_event_data:", blindboxEventPayload);

      localStorage.setItem(
        "blindbox_event_data",
        JSON.stringify(blindboxEventPayload)
      );

      setShowConfirmDialog(false);
      onOpenChange(false);
      // 导航到付费页面
      setTimeout(() => {
        setLocation("/blindbox/payment");
      }, 300);
    } catch (error) {
      // Error already handled by mutation's onError
    }
  };

  const getConfirmButtonText = () => {
    if (showTeamInvite) {
      return "确认参与（组队报名）";
    }
    return "确认参与";
  };

  return (
    <>
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content 
          className="bg-background flex flex-col rounded-t-[10px] h-[80vh] mt-24 fixed bottom-0 left-0 right-0 z-50 outline-none"
          data-testid="drawer-join-blindbox"
        >
          {/* 拖拽指示器 */}
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-4 mb-4" />
          
          {/* 可滚动内容 */}
          <div className="overflow-y-auto flex-1 px-4 pb-6">
            {/* 标题 */}
            <Drawer.Title className="text-xl font-bold mb-4" data-testid="text-join-title">
              确认参与信息
            </Drawer.Title>

            {/* A. 报名摘要 */}
            <div className="mb-6 p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">{eventData.date} {eventData.time}</span>
                <Badge variant="secondary" className="text-xs">
                  {eventData.eventType}
                </Badge>
                {eventData.isGirlsNight && (
                  <Badge className="text-xs bg-pink-500 hover:bg-pink-600">
                    👭 Girls Night
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{eventData.area}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>最少4人，最多6人</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span>当天现场AA</span>
              </div>
            </div>

            {/* === USER PREFERENCES SECTION === */}
            <div className="mb-6 space-y-6">
              {/* 预算选择 */}
              <div>
                <div className="mb-3">
                  <h3 className="text-base font-semibold mb-1">你的预算范围？</h3>
                  <p className="text-xs text-muted-foreground">(必填)</p>
                </div>
                <div className="space-y-3">
                  {budgetOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => toggleBudget(option.value)}
                      className="w-full flex items-center justify-between p-4 rounded-xl border-2 border-border bg-background transition-all hover-elevate"
                      data-testid={`button-budget-${option.value}`}
                    >
                      <span className="font-medium text-base">{getCurrencySymbol(eventData.city || "深圳")}{option.label}</span>
                      <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        budgetPreference.includes(option.value)
                          ? 'bg-foreground border-foreground'
                          : 'border-foreground/30'
                      }`}>
                        {budgetPreference.includes(option.value) && (
                          <CheckCircle2 className="h-4 w-4 text-background" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* B. 参与意图 (Event-specific intent) - 可选 */}
              <div>
                <div className="mb-3">
                  <h3 className="text-base font-semibold mb-1">参与这场活动的主要目的？</h3>
                  <p className="text-xs text-muted-foreground">选填 · 帮助AI匹配，也可以保持开放心态不选 · 可多选</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: "flexible", label: "灵活开放·都可以", icon: "✨" },
                    { value: "networking", label: "拓展人脉", icon: "💼" },
                    { value: "friends", label: "交朋友", icon: "👋" },
                    { value: "discussion", label: "深度讨论", icon: "💬" },
                    { value: "fun", label: "娱乐放松", icon: "🎉" },
                    { value: "romance", label: "浪漫社交", icon: "💕" },
                  ].map((option) => {
                    const isSelected = selectedIntent.includes(option.value);
                    const isFlexible = option.value === "flexible";
                    const hasFlexible = selectedIntent.includes("flexible");
                    const isDisabled = !isFlexible && hasFlexible;

                    return (
                      <button
                        key={option.value}
                        onClick={() => toggleIntent(option.value)}
                        disabled={isDisabled}
                        className={`px-3 py-3 rounded-lg border-2 text-sm transition-all hover-elevate ${
                          isSelected
                            ? 'border-primary bg-primary/5 font-medium'
                            : isDisabled
                            ? 'border-muted bg-muted/50 text-muted-foreground cursor-not-allowed'
                            : 'border-muted bg-muted/30'
                        }`}
                        data-testid={`button-intent-${option.value}`}
                      >
                        <span className="mr-1">{option.icon}</span>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {selectedIntent.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIntent([])}
                    className="mt-2 w-full text-xs text-muted-foreground"
                    data-testid="button-clear-intent"
                  >
                    清空选择
                  </Button>
                )}
              </div>

              {/* C. 我的偏好 */}
              <div>
                <div className="mb-3">
                  <h3 className="text-base font-semibold mb-1">我的偏好（可多选）</h3>
                  <p className="text-xs text-muted-foreground">帮助AI更精准匹配餐厅和同伴</p>
                </div>
                
                <div className="space-y-4">
                  {/* 语言偏好 */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">语言</h4>
                    <div className="grid grid-cols-3 gap-2">
                      {languageOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => toggleLanguage(option.value)}
                          className={`px-3 py-2 rounded-lg border-2 text-sm transition-all hover-elevate ${
                            selectedLanguages.includes(option.value)
                              ? 'border-primary bg-primary/5 font-medium'
                              : 'border-muted bg-muted/30'
                          }`}
                          data-testid={`button-language-${option.value}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 口味偏好 */}
                  <div>
                    <h4 className="text-sm font-medium mb-2">口味偏好（用于匹配餐厅）</h4>
                    
                    {/* 口味强度 */}
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-2">口味强度</p>
                      <div className="grid grid-cols-2 gap-2">
                        {tasteIntensityOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => toggleTasteIntensity(option.value)}
                            className={`px-3 py-2 rounded-lg border-2 text-sm transition-all hover-elevate ${
                              selectedTasteIntensity.includes(option.value)
                                ? 'border-primary bg-primary/5 font-medium'
                                : 'border-muted bg-muted/30'
                            }`}
                            data-testid={`button-taste-${option.value}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 主流菜系 */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">主流菜系</p>
                      <div className="grid grid-cols-3 gap-2">
                        {cuisineOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => toggleCuisine(option.value)}
                            className={`px-3 py-2 rounded-lg border-2 text-sm transition-all hover-elevate ${
                              selectedCuisines.includes(option.value)
                                ? 'border-primary bg-primary/5 font-medium'
                                : 'border-muted bg-muted/30'
                            }`}
                            data-testid={`button-cuisine-${option.value}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 一键清空 - 放在最后，样式弱化 */}
                  {(selectedLanguages.length > 0 || selectedTasteIntensity.length > 0 || selectedCuisines.length > 0) && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearAllPreferences}
                      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      data-testid="button-clear-preferences"
                    >
                      一键清空所有偏好
                    </Button>
                  )}
                </div>
              </div>

            {/* D. 选择片区 - 点击即全选该片区所有商圈 */}
            <div className="mb-6">
              <div className="mb-3">
                <h3 className="text-base font-semibold mb-1">选择片区</h3>
                <p className="text-xs text-muted-foreground">选择片区后默认覆盖该区所有商圈</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {shenzhenClusters.map(cluster => {
                  const clusterDistrictIds = cluster.districts.map(d => d.id);
                  const selectedInCluster = clusterDistrictIds.filter(id => selectedDistricts.includes(id));
                  const isClusterSelected = selectedInCluster.length === clusterDistrictIds.length;
                  const isPartiallySelected = selectedInCluster.length > 0 && selectedInCluster.length < clusterDistrictIds.length;
                  
                  return (
                    <button
                      key={cluster.id}
                      onClick={() => {
                        if (isClusterSelected) {
                          setSelectedDistricts(prev => prev.filter(id => !clusterDistrictIds.includes(id)));
                        } else {
                          setSelectedDistricts(prev => {
                            const withoutCluster = prev.filter(id => !clusterDistrictIds.includes(id));
                            return [...new Set([...withoutCluster, ...clusterDistrictIds])];
                          });
                        }
                      }}
                      className={`
                        inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
                        transition-all border-2
                        ${isClusterSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : isPartiallySelected
                            ? 'bg-primary/20 text-primary border-primary/50'
                            : 'bg-background border-border hover-elevate'
                        }
                      `}
                      data-testid={`chip-cluster-${cluster.id}`}
                    >
                      <span>{cluster.name}</span>
                      {isClusterSelected && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-primary-foreground/20 text-primary-foreground">
                          {clusterDistrictIds.length}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedDistricts.length === 0 && (
                <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg mt-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm text-primary">
                    选择片区，AI会在该区域为你匹配
                  </span>
                </div>
              )}
            </div>
            </div>

            {/* E. 规则与保障 */}
            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  <p className="font-medium mb-1">规则与保障</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>AI智能匹配 · 满4人成局 · 最多6人</li>
                    <li>成局前可退；成局后至开局前24小时内不可退</li>
                    <li>报名收取平台服务费；当天现场点单AA</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* F. 组队邀请 - 游戏化设计 */}
            <div className="mb-6">
              <div className="mb-3">
                <h3 className="text-base font-semibold mb-1">组队出击</h3>
                <p className="text-xs text-muted-foreground">邀请1位朋友一起，优先匹配同局</p>
              </div>

              {!showTeamInvite ? (
                <Button
                  variant="outline"
                  className="w-full justify-between h-auto py-4"
                  onClick={() => {
                    setShowTeamInvite(true);
                    const generatedLink = `https://joyjoin.app/invite/${Date.now().toString(36)}${Math.random().toString(36).substr(2, 6)}`;
                    setInviteLink(generatedLink);
                  }}
                  data-testid="button-start-team"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserPlus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium">发起组队</div>
                      <div className="text-xs text-muted-foreground">分享给朋友，一起参加</div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Button>
              ) : (
                <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">组队进度</div>
                        <div className="text-xs text-muted-foreground">
                          {teammateStatus === 'joined' ? '队友已就位' : '等待队友加入 (1/2)'}
                        </div>
                      </div>
                    </div>
                    {teammateStatus === 'joined' ? (
                      <Badge className="bg-green-500">已就位</Badge>
                    ) : (
                      <Badge variant="secondary" className="animate-pulse">等待中</Badge>
                    )}
                  </div>

                  {teammateStatus !== 'joined' && (
                    <Button
                      className="w-full gap-2"
                      onClick={async () => {
                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: '悦聚·组队邀请',
                              text: `邀请你一起参加${eventData.eventType}活动`,
                              url: inviteLink || window.location.href
                            });
                          } catch (err) {
                            toast({
                              title: "分享取消",
                              description: "你可以稍后再试",
                            });
                          }
                        } else {
                          toast({
                            title: "请复制链接分享",
                            description: inviteLink || window.location.href,
                          });
                        }
                      }}
                      data-testid="button-share-invite"
                    >
                      <Share2 className="h-4 w-4" />
                      分享到微信
                    </Button>
                  )}

                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="match-together" 
                      checked={mustMatchTogether}
                      onCheckedChange={setMustMatchTogether}
                      data-testid="switch-match-together"
                    />
                    <Label htmlFor="match-together" className="text-xs cursor-pointer">
                      同组必同局匹配
                    </Label>
                  </div>

                  <button
                    onClick={() => {
                      setShowTeamInvite(false);
                      setTeammateStatus(null);
                      setInviteLink(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                    data-testid="button-cancel-team"
                  >
                    取消组队
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* F. 底部操作区 */}
          <div className="border-t p-4 space-y-2 flex-shrink-0 bg-background">
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleConfirm}
              disabled={budgetPreference.length === 0}
              data-testid="button-confirm-join"
            >
              {getConfirmButtonText()}
            </Button>
            {budgetPreference.length === 0 && (
              <p className="text-xs text-center text-muted-foreground">
                请先选择预算范围
              </p>
            )}
            <Button 
              variant="ghost" 
              className="w-full" 
              size="sm"
              data-testid="button-save-only"
            >
              仅保存设置（不报名）
            </Button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>

    {/* 确认弹窗 */}
    <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" data-testid="dialog-confirm-join">
        <DialogHeader>
          <DialogTitle>确认参与信息</DialogTitle>
          <DialogDescription>
            请确认你的预算范围和偏好选项
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* 1. 摘要 */}
          <div className="space-y-2 pb-4 border-b">
            <h3 className="text-sm font-semibold text-muted-foreground">摘要</h3>
            <div className="text-sm space-y-1">
              <p><strong>{eventData.date} {eventData.time}</strong> · {eventData.eventType} · {eventData.area}</p>
              <p className="text-muted-foreground">成员人数：4-6人</p>
            </div>
          </div>

          {/* 2. 预算 */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">预算</h3>
            <div className="grid grid-cols-2 gap-2">
              {budgetOptions.map((option) => {
                const isSelected = budgetPreference.includes(option.value);
                const isRecommended = option.value === "100-200"; // 示例：100-200为本区推荐
                return (
                  <div
                    key={option.value}
                    className={`relative flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-muted bg-muted/30"
                    }`}
                    data-testid={`dialog-budget-${option.value}`}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-background" />
                      )}
                    </div>
                    <span className={`text-sm ${isSelected ? "font-medium" : ""}`}>
                      {getCurrencySymbol(eventData.city || "深圳")}{option.label}
                    </span>
                    {isRecommended && (
                      <Badge variant="secondary" className="absolute -top-2 -right-2 text-[10px] h-4 px-1">
                        本区推荐
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 我的偏好 */}
          {(selectedLanguages.length > 0 || selectedTasteIntensity.length > 0 || selectedCuisines.length > 0) && (
            <div className="space-y-3 pb-4 border-b">
              <h3 className="text-sm font-semibold">我的偏好</h3>
              <div className="space-y-2 text-sm">
                {selectedLanguages.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">语言：</span>
                    <span className="font-medium ml-2">{selectedLanguages.join(' · ')}</span>
                  </div>
                )}
                {selectedTasteIntensity.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">口味强度：</span>
                    <span className="font-medium ml-2">{selectedTasteIntensity.join(' · ')}</span>
                  </div>
                )}
                {selectedCuisines.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">菜系：</span>
                    <span className="font-medium ml-2">{selectedCuisines.join(' · ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. 已选片区 */}
          {selectedDistricts.length > 0 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">已选片区</h3>
                <p className="text-xs text-muted-foreground">共覆盖 {selectedDistricts.length} 个商圈</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {shenzhenClusters
                  .filter(cluster => cluster.districts.some(d => selectedDistricts.includes(d.id)))
                  .map(cluster => {
                    const selectedCount = cluster.districts.filter(d => selectedDistricts.includes(d.id)).length;
                    const totalCount = cluster.districts.length;
                    return (
                      <Badge key={cluster.id} variant="secondary">
                        {cluster.name} ({selectedCount}/{totalCount})
                      </Badge>
                    );
                  })
                }
              </div>
            </div>
          )}

          {/* 5. 费用说明 */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <h3 className="text-sm font-semibold mb-2">费用说明</h3>
            <p className="text-xs text-muted-foreground">
              平台服务费 + 当天AA，无二次加价
            </p>
          </div>

          {/* 6. 规则摘要 */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
            <h3 className="text-sm font-semibold mb-2 text-blue-600 dark:text-blue-400">规则摘要</h3>
            <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
              <li>• 成局条件：满4人成局，最多6人</li>
              <li>• 退改规则：成局前可退；成局后至开局前24小时内不可退</li>
            </ul>
          </div>

          {/* 6. 组队邀请（可选） */}
          {showTeamInvite && (
            <div className="p-3 border rounded-lg">
              <h3 className="text-sm font-semibold mb-2">组队出击</h3>
              <p className="text-xs text-muted-foreground mb-2">
                已发起组队，等待1位朋友加入
              </p>
              <Badge variant={teammateStatus === 'joined' ? "default" : "secondary"}>
                {teammateStatus === 'joined' ? '队友已就位' : '等待中'}
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowConfirmDialog(false)}
            data-testid="button-dialog-cancel"
          >
            返回修改
          </Button>
          <Button
            onClick={handleFinalConfirm}
            disabled={saveBudgetMutation.isPending}
            data-testid="button-dialog-confirm"
          >
            {saveBudgetMutation.isPending ? "处理中..." : "确认并支付"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
}
