import { useState, useEffect } from "react";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MultiSelectButton, MultiSelectGroup, SingleSelectButton } from "@/components/ui/multi-select-button";
import { 
  Calendar, 
  MapPin, 
  Users, 
  ChevronRight,
  ChevronDown,
  Info,
  CheckCircle2,
  DollarSign,
  Sparkles,
  Share2,
  UserPlus,
  X,
  Briefcase,
  HandHeart,
  MessageCircle,
  PartyPopper,
  Heart,
  Shuffle,
  Wallet,
  Globe,
  UtensilsCrossed,
  Wine,
  Check
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { getCurrencySymbol } from "@/lib/currency";
import { 
  shenzhenClusters, 
  getDistrictById,
  getDistrictIdsByCluster
} from "@shared/districts";


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
  
  // 商圈多选 - 替代简单的 acceptNearby 开关
  // 根据用户选的片区自动预选对应商圈
  const getUserClusterId = () => {
    // 根据 eventData.area (片区名称如"南山区") 找到对应的 cluster
    const cluster = shenzhenClusters.find(c => 
      c.displayName === eventData.area || c.id === eventData.area
    );
    return cluster?.id || 'nanshan';
  };
  
  const userClusterId = getUserClusterId();
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(() => {
    // 初始化时自动选中用户片区的所有商圈
    return getDistrictIdsByCluster(userClusterId);
  });
  // 默认收起 - 如果已有选择，不展开任何片区
  const [expandedClusters, setExpandedClusters] = useState<string[]>([]);
  
  // 当用户切换片区时，重新计算预选商圈（保持收起状态）
  useEffect(() => {
    const newClusterId = getUserClusterId();
    const newDistrictIds = getDistrictIdsByCluster(newClusterId);
    setSelectedDistricts(newDistrictIds);
    // 不自动展开 - 用户可以点击展开
    setExpandedClusters([]);
  }, [eventData.area]);

  // 当活动类型切换时，重置不相关的偏好数据
  useEffect(() => {
    if (eventData.eventType === "饭局") {
      // 切换到饭局时，清空酒局偏好
      setSelectedBarThemes([]);
      setSelectedAlcoholComfort([]);
      setBarBudgetPreference([]);
    } else if (eventData.eventType === "酒局") {
      // 切换到酒局时，清空饭局偏好
      setSelectedTasteIntensity([]);
      setSelectedCuisines([]);
      setBudgetPreference([]);
    }
  }, [eventData.eventType]);

  // 获取有激活场地的商圈列表
  const { data: activeVenueDistricts, isLoading: isLoadingDistricts } = useQuery<{ clusterId: string; districtId: string; count: number }[]>({
    queryKey: ['/api/venues/active-districts', eventData.eventType],
    queryFn: async () => {
      const response = await fetch(`/api/venues/active-districts?eventType=${encodeURIComponent(eventData.eventType)}`);
      if (!response.ok) throw new Error('Failed to fetch active districts');
      return response.json();
    },
    enabled: open, // 只在弹窗打开时加载
  });

  // 检查是否有激活场地的商圈（区分加载中和无数据状态）
  const hasActiveVenueDistricts = (activeVenueDistricts?.length ?? 0) > 0;
  const isDistrictsDataLoaded = activeVenueDistricts !== undefined;

  // 根据激活场地过滤商圈列表（不再 fallback 显示全部）
  const filteredClusters = hasActiveVenueDistricts 
    ? shenzhenClusters.map(cluster => {
        const filteredDistricts = cluster.districts.filter(district => 
          activeVenueDistricts!.some(v => v.districtId === district.id)
        );
        return { ...cluster, districts: filteredDistricts };
      }).filter(cluster => cluster.districts.length > 0)
    : []; // 无激活场地时返回空数组
  
  // 组队邀请状态
  const [showTeamInvite, setShowTeamInvite] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [teammateStatus, setTeammateStatus] = useState<'waiting' | 'joined' | null>(null);

  // 用户偏好 - 语言和口味
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedTasteIntensity, setSelectedTasteIntensity] = useState<string[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  
  // 酒局偏好 - 酒吧主题和饮酒程度
  const [selectedBarThemes, setSelectedBarThemes] = useState<string[]>([]);
  const [selectedAlcoholComfort, setSelectedAlcoholComfort] = useState<string[]>([]);
  const [barBudgetPreference, setBarBudgetPreference] = useState<string[]>([]);
  
  // 参与意图 - Event-specific intent (multi-select)
  const [selectedIntent, setSelectedIntent] = useState<string[]>([]);

  // 饭局预算选项
  const budgetOptions = [
    { value: "150以下", label: "≤¥150" },
    { value: "150-200", label: "¥150-200" },
    { value: "200-300", label: "¥200-300" },
    { value: "300-500", label: "¥300-500" },
  ];

  // 酒局预算选项（每杯）
  const barBudgetOptions = [
    { value: "80以下", label: "≤¥80/杯" },
    { value: "80-150", label: "¥80-150/杯" },
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

  // 酒局偏好选项
  const barThemeOptions = [
    { value: "精酿", label: "精酿" },
    { value: "清吧", label: "清吧" },
    { value: "私密调酒·Homebar", label: "私密调酒·Homebar" },
  ];

  const alcoholComfortOptions = [
    { value: "可以喝酒", label: "可以喝酒" },
    { value: "微醺就好", label: "微醺就好" },
    { value: "无酒精饮品", label: "无酒精饮品" },
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

  // 灵活开放开关状态
  const [isFlexibleMode, setIsFlexibleMode] = useState(false);
  
  // Toggle flexible mode - clears other selections when enabled
  const toggleFlexibleMode = (enabled: boolean) => {
    setIsFlexibleMode(enabled);
    if (enabled) {
      setSelectedIntent(["flexible"]);
    } else {
      setSelectedIntent([]);
    }
  };

  // Toggle intent - no limit, auto-enable flexible mode when all 5 selected
  const toggleIntent = (intentValue: string) => {
    if (intentValue === "flexible") {
      toggleFlexibleMode(!isFlexibleMode);
      return;
    }
    
    // If in flexible mode, don't allow selecting specific intents
    if (isFlexibleMode) return;
    
    const allIntentValues = ["networking", "friends", "discussion", "fun", "romance"];
    
    if (selectedIntent.includes(intentValue)) {
      // Deselect this intent
      setSelectedIntent(selectedIntent.filter(i => i !== intentValue));
    } else {
      // Add the new intent
      const newSelection = [...selectedIntent, intentValue];
      
      // Check if all 5 are now selected - auto-enable flexible mode
      const nonFlexibleIntents = newSelection.filter(i => i !== "flexible");
      if (allIntentValues.every(v => nonFlexibleIntents.includes(v))) {
        // All 5 selected, switch to flexible mode
        setIsFlexibleMode(true);
        setSelectedIntent(["flexible"]);
        toast({
          title: "已切换到灵活开放模式",
          description: "全选即交给AI智能匹配",
        });
      } else {
        setSelectedIntent(newSelection);
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

  const toggleBarTheme = (value: string) => {
    setSelectedBarThemes(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const toggleAlcoholComfort = (value: string) => {
    // 单选：如果已选中则取消，否则替换为新选项
    if (selectedAlcoholComfort.includes(value)) {
      setSelectedAlcoholComfort([]);
    } else {
      setSelectedAlcoholComfort([value]);
    }
  };

  const clearAllPreferences = () => {
    setSelectedLanguages([]);
    setSelectedTasteIntensity([]);
    setSelectedCuisines([]);
    setSelectedBarThemes([]);
    setSelectedAlcoholComfort([]);
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

  // 获取当前活动类型对应的预算选择
  const currentBudgetSelection = eventData.eventType === "饭局" ? budgetPreference : barBudgetPreference;
  const hasBudgetSelected = currentBudgetSelection.length > 0;

  const handleConfirm = () => {
    if (!hasBudgetSelected) {
      toast({
        title: "请选择预算范围",
        description: eventData.eventType === "饭局" ? "至少选择一个预算档位" : "至少选择一个消费档位",
        variant: "destructive",
      });
      return;
    }

    // 打开确认弹窗
    setShowConfirmDialog(true);
  };

  const handleFinalConfirm = async () => {
    // 尝试保存预算偏好到用户profile（可选，即使失败也继续导航）
    try {
      await saveBudgetMutation.mutateAsync(budgetPreference);
    } catch (error) {
      // 忽略保存失败，继续执行导航
      console.log("[JoinBlindBoxSheet] Budget save skipped:", error);
    }

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
        barThemes: selectedBarThemes,
        alcoholComfort: selectedAlcoholComfort,
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
      // 饭局使用 budgetTier/budget, 酒局使用 barBudgetTier/barBudget
      budgetTier: eventData.eventType === "饭局" ? primaryBudgetTier : "",
      budget: eventData.eventType === "饭局" ? budgetPreference : [],
      barBudgetTier: eventData.eventType === "酒局" ? (barBudgetPreference[0] || "") : "",
      barBudget: eventData.eventType === "酒局" ? barBudgetPreference : [],

      // 偏好信息
      selectedDistricts,
      acceptNearby: selectedDistricts.length > 1,
      selectedLanguages,
      selectedTasteIntensity,
      selectedCuisines,
      barThemes: selectedBarThemes,
      alcoholComfort: selectedAlcoholComfort,

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

            {/* ========== STEP 1: 必填信息 ========== */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Wallet className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold">必填信息</h2>
                <Badge variant="destructive" className="text-xs">必填</Badge>
              </div>
              
              {/* 预算选择 - 根据活动类型显示不同选项 */}
              <div className="mb-6">
                {eventData.eventType === "饭局" ? (
                  <MultiSelectGroup
                    label="你的预算范围？"
                    hint="多选可提升42%匹配率"
                    selectedCount={budgetPreference.length}
                    showCounter={true}
                  >
                    <div className="grid grid-cols-2 gap-3 w-full">
                      {budgetOptions.map((option) => (
                        <MultiSelectButton
                          key={option.value}
                          selected={budgetPreference.includes(option.value)}
                          onClick={() => toggleBudget(option.value)}
                          className="w-full justify-center whitespace-nowrap"
                          data-testid={`button-budget-${option.value}`}
                        >
                          {option.label}
                        </MultiSelectButton>
                      ))}
                    </div>
                  </MultiSelectGroup>
                ) : (
                  <MultiSelectGroup
                    label="你的预算范围？（每杯）"
                    hint="选择适合你的消费档位"
                    selectedCount={barBudgetPreference.length}
                    showCounter={true}
                  >
                    <div className="grid grid-cols-2 gap-3 w-full">
                      {barBudgetOptions.map((option) => (
                        <MultiSelectButton
                          key={option.value}
                          selected={barBudgetPreference.includes(option.value)}
                          onClick={() => {
                            setBarBudgetPreference(prev => 
                              prev.includes(option.value) 
                                ? prev.filter(v => v !== option.value)
                                : [...prev, option.value]
                            );
                          }}
                          className="w-full justify-center whitespace-nowrap"
                          data-testid={`button-bar-budget-${option.value}`}
                        >
                          {option.label}
                        </MultiSelectButton>
                      ))}
                    </div>
                  </MultiSelectGroup>
                )}
              </div>

              {/* 选择商圈 - Checkbox列表样式 */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold mb-1">选择商圈</h3>
                    <p className="text-xs text-muted-foreground">多选商圈可提升匹配成功率</p>
                  </div>
                  {selectedDistricts.length > 0 && (
                    <button
                      onClick={() => setSelectedDistricts([])}
                      className="text-xs text-destructive hover:underline"
                      data-testid="button-clear-districts"
                    >
                      清空
                    </button>
                  )}
                </div>

                {/* 已选摘要 */}
                {selectedDistricts.length > 0 && (
                  <div className="mb-3 p-2 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">已选:</span>
                      {selectedDistricts.map(id => {
                        const district = getDistrictById(id);
                        return district ? (
                          <Badge key={id} variant="secondary" className="text-xs">
                            {district.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* 加载中显示骨架 */}
                {isLoadingDistricts && (
                  <div className="p-4 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed animate-pulse">
                    <p className="text-sm">加载中...</p>
                  </div>
                )}

                {/* 无可选商圈时显示提示（仅在数据加载完成后） */}
                {isDistrictsDataLoaded && !hasActiveVenueDistricts && (
                  <div className="p-4 text-center text-muted-foreground bg-muted/30 rounded-lg border border-dashed">
                    <p className="text-sm">暂无可选商圈，敬请期待</p>
                  </div>
                )}

                {/* 有可选商圈时显示列表 */}
                {isDistrictsDataLoaded && hasActiveVenueDistricts && (
                <div className="space-y-2 border rounded-lg overflow-hidden">
                  {filteredClusters.map(cluster => {
                    const clusterSelectedCount = cluster.districts.filter(d => selectedDistricts.includes(d.id)).length;
                    const allClusterDistrictIds = cluster.districts.map(d => d.id);
                    const allSelected = allClusterDistrictIds.every(id => selectedDistricts.includes(id));
                    const isExpanded = expandedClusters.includes(cluster.id);
                    
                    return (
                      <div key={cluster.id} className="border-b last:border-b-0">
                        {/* 区域头部 - sticky header样式 */}
                        <div
                          className="flex items-center justify-between w-full p-3 bg-muted/30 hover-elevate cursor-pointer"
                          data-testid={`button-cluster-${cluster.id}`}
                        >
                          <div 
                            className="flex items-center gap-2 flex-1"
                            onClick={() => {
                              setExpandedClusters(prev => 
                                prev.includes(cluster.id) 
                                  ? prev.filter(id => id !== cluster.id)
                                  : [...prev, cluster.id]
                              );
                            }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium text-sm">{cluster.name}</span>
                            {clusterSelectedCount > 0 && (
                              <Badge variant="default" className="text-xs">
                                {clusterSelectedCount}/{cluster.districts.length}
                              </Badge>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (allSelected) {
                                setSelectedDistricts(prev => prev.filter(id => !allClusterDistrictIds.includes(id)));
                              } else {
                                setSelectedDistricts(prev => {
                                  const newSelection = [...prev];
                                  allClusterDistrictIds.forEach(id => {
                                    if (!newSelection.includes(id)) {
                                      newSelection.push(id);
                                    }
                                  });
                                  return newSelection;
                                });
                              }
                            }}
                            className="text-xs text-primary hover:underline px-2"
                            data-testid={`button-select-all-${cluster.id}`}
                          >
                            {allSelected ? '取消全选' : '全选'}
                          </button>
                        </div>
                        
                        {/* 商圈列表 - checkbox list */}
                        {isExpanded && (
                          <div className="divide-y">
                            {cluster.districts.map(district => {
                              const isSelected = selectedDistricts.includes(district.id);
                              return (
                                <button
                                  key={district.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedDistricts(prev => prev.filter(id => id !== district.id));
                                    } else {
                                      setSelectedDistricts(prev => [...prev, district.id]);
                                    }
                                  }}
                                  className={`flex items-center gap-3 w-full p-3 pl-10 min-h-[44px] text-left transition-colors ${
                                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                                  }`}
                                  data-testid={`checkbox-district-${district.id}`}
                                >
                                  <div className={`h-5 w-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                    isSelected 
                                      ? 'bg-primary border-primary' 
                                      : 'border-muted-foreground/30'
                                  }`}>
                                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                  </div>
                                  <span className={`text-sm ${isSelected ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                    {district.name}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}

                {isDistrictsDataLoaded && hasActiveVenueDistricts && selectedDistricts.length < 2 && (
                  <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg mt-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm text-primary">
                      多选2-3个商圈，成局率提升42%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 分隔线 */}
            <div className="h-px bg-border mb-6" />

            {/* ========== STEP 2: 偏好设置 ========== */}
            <div className="mb-6 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-bold">偏好设置</h2>
                <Badge variant="secondary" className="text-xs">选填</Badge>
              </div>

              {/* 参与意图 */}
              <div>
                <div className="mb-3">
                  <h3 className="text-base font-semibold mb-1">参与这场活动的主要目的？</h3>
                  <p className="text-xs text-muted-foreground">帮助AI精准匹配</p>
                </div>

                {/* 灵活开放独立开关 */}
                <div className={`flex items-center justify-between p-3 rounded-lg mb-3 transition-all ${
                  isFlexibleMode 
                    ? 'bg-primary/10 border-2 border-primary' 
                    : 'bg-muted/30 border-2 border-transparent'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      isFlexibleMode ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <Shuffle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">灵活开放</div>
                      <div className="text-xs text-muted-foreground">
                        {isFlexibleMode ? '已交给AI智能匹配' : '让AI为你匹配最合适的同伴'}
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={isFlexibleMode}
                    onCheckedChange={toggleFlexibleMode}
                    data-testid="switch-flexible-mode"
                  />
                </div>

                {/* 具体目的多选 - 关闭灵活模式时显示 */}
                {!isFlexibleMode && (
                  <>
                    <MultiSelectGroup
                      label=""
                      hint=""
                      selectedCount={selectedIntent.filter(i => i !== "flexible").length}
                      showCounter={selectedIntent.filter(i => i !== "flexible").length > 0}
                    >
                      <div className="grid grid-cols-2 gap-2 w-full">
                        {[
                          { value: "networking", label: "拓展人脉", Icon: Briefcase },
                          { value: "friends", label: "交朋友", Icon: HandHeart },
                          { value: "discussion", label: "深度讨论", Icon: MessageCircle },
                          { value: "fun", label: "娱乐放松", Icon: PartyPopper },
                          { value: "romance", label: "浪漫社交", Icon: Heart },
                        ].map((option) => {
                          const isSelected = selectedIntent.includes(option.value);

                          return (
                            <MultiSelectButton
                              key={option.value}
                              selected={isSelected}
                              onClick={() => toggleIntent(option.value)}
                              icon={<option.Icon className="h-4 w-4" />}
                              data-testid={`button-intent-${option.value}`}
                            >
                              {option.label}
                            </MultiSelectButton>
                          );
                        })}
                      </div>
                    </MultiSelectGroup>
                    {selectedIntent.filter(i => i !== "flexible").length > 0 && (
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
                  </>
                )}
              </div>

              {/* C. 我的偏好 */}
              <div>
                <div className="mb-3">
                  <h3 className="text-base font-semibold mb-1">我的偏好（可多选）</h3>
                  <p className="text-xs text-muted-foreground">
                    {eventData.eventType === "酒局" 
                      ? "帮助AI更精准匹配酒吧和同伴" 
                      : "帮助AI更精准匹配餐厅和同伴"}
                  </p>
                </div>
                
                <div className="space-y-4">
                  {/* 语言偏好 - 两种活动类型共用 */}
                  <MultiSelectGroup
                    label="语言"
                    hint="多选可提升42%匹配率"
                    selectedCount={selectedLanguages.length}
                    showCounter={true}
                  >
                    <div className="grid grid-cols-3 gap-2 w-full">
                      {languageOptions.map((option) => (
                        <MultiSelectButton
                          key={option.value}
                          selected={selectedLanguages.includes(option.value)}
                          onClick={() => toggleLanguage(option.value)}
                          className="w-full justify-center text-xs whitespace-nowrap px-2"
                          data-testid={`button-language-${option.value}`}
                        >
                          {option.label}
                        </MultiSelectButton>
                      ))}
                    </div>
                  </MultiSelectGroup>

                  {/* 饭局偏好 - 仅饭局显示 */}
                  {eventData.eventType === "饭局" && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold mb-3">口味偏好（用于匹配餐厅）</h3>
                    
                      {/* 口味强度 */}
                      <MultiSelectGroup
                        label="口味强度"
                        selectedCount={selectedTasteIntensity.length}
                        showCounter={true}
                      >
                        <div className="grid grid-cols-2 gap-2 w-full">
                          {tasteIntensityOptions.map((option) => (
                            <MultiSelectButton
                              key={option.value}
                              selected={selectedTasteIntensity.includes(option.value)}
                              onClick={() => toggleTasteIntensity(option.value)}
                              className="w-full justify-center"
                              data-testid={`button-taste-${option.value}`}
                            >
                              {option.label}
                            </MultiSelectButton>
                          ))}
                        </div>
                      </MultiSelectGroup>

                      {/* 主流菜系 */}
                      <MultiSelectGroup
                        label="主流菜系"
                        hint="多选可提升42%匹配率"
                        selectedCount={selectedCuisines.length}
                        showCounter={true}
                      >
                        <div className="flex flex-wrap gap-2">
                          {cuisineOptions.map((option) => (
                            <MultiSelectButton
                              key={option.value}
                              selected={selectedCuisines.includes(option.value)}
                              onClick={() => toggleCuisine(option.value)}
                              className="min-w-[4.5rem] justify-center"
                              data-testid={`button-cuisine-${option.value}`}
                            >
                              {option.label}
                            </MultiSelectButton>
                          ))}
                        </div>
                      </MultiSelectGroup>
                    </div>
                  )}

                  {/* 酒局偏好 - 仅酒局显示 */}
                  {eventData.eventType === "酒局" && (
                    <div className="space-y-4">
                      <h3 className="text-base font-semibold mb-3">酒吧偏好（用于匹配场地）</h3>
                      
                      {/* 酒吧主题 - 多选 */}
                      <MultiSelectGroup
                        label="酒吧类型"
                        hint="多选可提升42%匹配率"
                        selectedCount={selectedBarThemes.length}
                        showCounter={true}
                      >
                        <div className="grid grid-cols-3 gap-2 w-full">
                          {barThemeOptions.map((option) => (
                            <MultiSelectButton
                              key={option.value}
                              selected={selectedBarThemes.includes(option.value)}
                              onClick={() => toggleBarTheme(option.value)}
                              className="w-full justify-center text-xs whitespace-nowrap px-2"
                              data-testid={`button-bar-theme-${option.value}`}
                            >
                              {option.label}
                            </MultiSelectButton>
                          ))}
                        </div>
                      </MultiSelectGroup>

                      {/* 饮酒程度 - 单选 */}
                      <div>
                        <div className="mb-3">
                          <h4 className="text-sm font-semibold">饮酒程度</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">请选一个</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 w-full">
                          {alcoholComfortOptions.map((option) => (
                            <SingleSelectButton
                              key={option.value}
                              selected={selectedAlcoholComfort.includes(option.value)}
                              onClick={() => toggleAlcoholComfort(option.value)}
                              className="w-full justify-center text-xs whitespace-nowrap px-2"
                              data-testid={`button-alcohol-${option.value}`}
                            >
                              {option.label}
                            </SingleSelectButton>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 一键清空 - 放在最后，样式弱化 */}
                  {(selectedLanguages.length > 0 || selectedTasteIntensity.length > 0 || selectedCuisines.length > 0 || selectedBarThemes.length > 0 || selectedAlcoholComfort.length > 0) && (
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
            </div>

            {/* 分隔线 */}
            <div className="h-px bg-border mb-6" />

            {/* ========== STEP 3: 组队邀请 ========== */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-bold">组队邀请</h2>
                <Badge variant="secondary" className="text-xs">选填</Badge>
              </div>

              <p className="text-sm text-muted-foreground mb-4">邀请1位朋友一起，优先匹配同局</p>

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
                              text: `我抢到 JoyJoin 神秘${eventData.eventType}名额，一起开盲盒？`,
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

            {/* 规则与保障 */}
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="flex items-start gap-2">
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
          </div>

          {/* 底部操作区 */}
          <div className="border-t p-4 space-y-2 flex-shrink-0 bg-background">
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleConfirm}
              disabled={!hasBudgetSelected}
              data-testid="button-confirm-join"
            >
              {getConfirmButtonText()}
            </Button>
            {!hasBudgetSelected && (
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
            <h3 className="text-sm font-semibold">
              预算{eventData.eventType === "酒局" ? "（每杯）" : ""}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(eventData.eventType === "饭局" ? budgetOptions : barBudgetOptions).map((option) => {
                const isSelected = eventData.eventType === "饭局" 
                  ? budgetPreference.includes(option.value)
                  : barBudgetPreference.includes(option.value);
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
                      {option.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. 我的偏好 */}
          {(selectedLanguages.length > 0 || selectedTasteIntensity.length > 0 || selectedCuisines.length > 0 || selectedBarThemes.length > 0 || selectedAlcoholComfort.length > 0) && (
            <div className="space-y-3 pb-4 border-b">
              <h3 className="text-sm font-semibold">我的偏好</h3>
              <div className="space-y-2 text-sm">
                {selectedLanguages.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">语言：</span>
                    <span className="font-medium ml-2">{selectedLanguages.join(' · ')}</span>
                  </div>
                )}
                {/* 饭局偏好 */}
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
                {/* 酒局偏好 */}
                {selectedBarThemes.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">酒吧主题：</span>
                    <span className="font-medium ml-2">{selectedBarThemes.join(' · ')}</span>
                  </div>
                )}
                {selectedAlcoholComfort.length > 0 && (
                  <div>
                    <span className="text-muted-foreground">饮酒程度：</span>
                    <span className="font-medium ml-2">{selectedAlcoholComfort.join(' · ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. 已选商圈 */}
          {selectedDistricts.length > 0 && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">已选商圈</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedDistricts.map(id => {
                  const district = getDistrictById(id);
                  return district ? (
                    <Badge key={id} variant="secondary">{district.name}</Badge>
                  ) : null;
                })}
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
