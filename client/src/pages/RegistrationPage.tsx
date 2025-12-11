import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { registerUserSchema, type RegisterUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, ChevronDown, Check, Shield, Sparkles, User, Briefcase, Heart, MapPin, Loader2 } from "lucide-react";
import { getCurrentLocation } from "@/lib/gpsUtils";
import { intentOptions } from "@/lib/userFieldMappings";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import RegistrationProgress from "@/components/RegistrationProgress";
import { chinaRegions, getCitiesByProvince, formatHometown } from "@/data/chinaRegions";
import CelebrationConfetti from "@/components/CelebrationConfetti";
import { OccupationSelector } from "@/components/OccupationSelector";
import { getOccupationById } from "@shared/occupations";
import type { WorkMode } from "@shared/constants";

const stepNames = ["基本信息", "背景信息", "偏好设置"];

const stepGuidance = [
  {
    icon: User,
    title: "先让我们认识一下你",
    subtitle: "填写基本信息，帮助我们更好地匹配志同道合的朋友",
  },
  {
    icon: Briefcase,
    title: "聊聊你的经历",
    subtitle: "不同背景的人碰撞出更有趣的对话",
  },
  {
    icon: Heart,
    title: "最后一步啦",
    subtitle: "告诉我们你期待什么样的社交体验",
  },
];

const slideVariants = {
  enterFromRight: {
    x: 100,
    opacity: 0,
  },
  enterFromLeft: {
    x: -100,
    opacity: 0,
  },
  center: {
    x: 0,
    opacity: 1,
  },
  exitToLeft: {
    x: -100,
    opacity: 0,
  },
  exitToRight: {
    x: 100,
    opacity: 0,
  },
};

export default function RegistrationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);
  const totalSteps = 3;

  const handleGpsLocate = async () => {
    setIsLocating(true);
    setGpsMessage(null);
    try {
      const result = await getCurrentLocation();
      if (result.success && result.city) {
        form.setValue("currentCity", result.city);
        setGpsMessage(`定位成功: ${result.city}`);
        toast({
          title: "定位成功",
          description: `已为你选择: ${result.city}`,
        });
      } else {
        setGpsMessage(result.error || "定位失败");
        toast({
          title: "定位失败",
          description: result.error || "请手动选择城市",
          variant: "destructive",
        });
      }
    } catch {
      setGpsMessage("定位出错");
      toast({
        title: "定位出错",
        description: "请手动选择城市",
        variant: "destructive",
      });
    } finally {
      setIsLocating(false);
    }
  };

  const form = useForm<RegisterUser>({
    resolver: zodResolver(registerUserSchema),
    defaultValues: {
      displayName: "",
      birthdate: "",
      ageVisibility: "hide_all",
      gender: undefined,
      pronouns: undefined,
      relationshipStatus: undefined,
      children: undefined,
      educationLevel: undefined,
      studyLocale: undefined,
      overseasRegions: [],
      fieldOfStudy: "",
      occupationId: "",
      workMode: undefined,
      industry: "",
      roleTitleShort: "",
      seniority: undefined,
      intent: [],
      hometownCountry: "",
      hometownRegionCity: "",
      languagesComfort: [],
      accessibilityNeeds: "",
      safetyNoteHost: "",
      wechatId: "",
      currentCity: "",
      hasPets: undefined,
      hasSiblings: undefined,
    },
  });

  const relationshipStatus = form.watch("relationshipStatus");
  const showChildrenField = relationshipStatus && relationshipStatus !== "单身";
  
  const workMode = form.watch("workMode");
  const isStudent = workMode === "student";
  const showWorkFields = !isStudent;

  const [birthYear, setBirthYear] = useState<string>("");
  const [birthMonth, setBirthMonth] = useState<string>("");
  const [birthDay, setBirthDay] = useState<string>("");
  
  // 省市联动选择器状态
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const availableCities = selectedProvince ? getCitiesByProvince(selectedProvince) : [];

  // 年份倒序：从2000年开始往前，更符合25-35岁用户的使用习惯
  const years = Array.from({ length: 41 }, (_, i) => 2000 - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const getDaysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();
  const days = birthYear && birthMonth 
    ? Array.from({ length: getDaysInMonth(parseInt(birthYear), parseInt(birthMonth)) }, (_, i) => i + 1)
    : Array.from({ length: 31 }, (_, i) => i + 1);

  useEffect(() => {
    if (birthYear && birthMonth && birthDay) {
      const dateStr = `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`;
      form.setValue("birthdate", dateStr);
    }
  }, [birthYear, birthMonth, birthDay, form]);

  // 省市选择联动更新表单
  useEffect(() => {
    if (selectedProvince) {
      form.setValue("hometownCountry", "中国");
      const formattedHometown = formatHometown(selectedProvince, selectedCity);
      form.setValue("hometownRegionCity", formattedHometown);
    }
  }, [selectedProvince, selectedCity, form]);

  // 从 localStorage 检查并恢复注册进度
  useEffect(() => {
    const savedProgress = localStorage.getItem('registration_progress');
    if (savedProgress) {
      try {
        const { step: savedStep, formData, birthYear: savedBY, birthMonth: savedBM, birthDay: savedBD, province, city, timestamp } = JSON.parse(savedProgress);
        
        // 只恢复7天内的进度
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (timestamp && timestamp < sevenDaysAgo) {
          localStorage.removeItem('registration_progress');
          return;
        }
        
        // 保存数据到待恢复状态，展示对话框让用户选择
        if (savedStep && savedStep > 1 && savedStep <= totalSteps) {
          setPendingRestoreData({ savedStep, formData, savedBY, savedBM, savedBD, province, city });
          setShowRestoreDialog(true);
        }
      } catch (e) {
        console.error('恢复注册进度失败:', e);
      }
    }
  }, []);

  // 处理恢复对话框的确认
  const handleRestoreConfirm = () => {
    if (pendingRestoreData) {
      const { savedStep, formData, savedBY, savedBM, savedBD, province, city } = pendingRestoreData;
      
      setStep(savedStep);
      if (formData) {
        Object.keys(formData).forEach((key) => {
          const value = formData[key];
          if (value !== undefined && value !== '' && value !== null) {
            form.setValue(key as keyof RegisterUser, value);
          }
        });
      }
      if (savedBY) setBirthYear(savedBY);
      if (savedBM) setBirthMonth(savedBM);
      if (savedBD) setBirthDay(savedBD);
      if (province) setSelectedProvince(province);
      if (city) setSelectedCity(city);
      
      toast({
        title: "已恢复上次进度",
        description: "继续完成注册",
      });
    }
    setShowRestoreDialog(false);
    setPendingRestoreData(null);
  };

  // 处理恢复对话框的取消
  const handleRestoreCancel = () => {
    localStorage.removeItem('registration_progress');
    setShowRestoreDialog(false);
    setPendingRestoreData(null);
  };

  // 保存注册进度到 localStorage
  useEffect(() => {
    const formData = form.getValues();
    const progress = {
      step,
      formData,
      birthYear,
      birthMonth,
      birthDay,
      province: selectedProvince,
      city: selectedCity,
      timestamp: Date.now(),
    };
    localStorage.setItem('registration_progress', JSON.stringify(progress));
  }, [step, form.watch(), birthYear, birthMonth, birthDay, selectedProvince, selectedCity]);

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterUser) => {
      console.log("[Frontend] Sending registration data:", data);
      return await apiRequest("POST", "/api/user/register", data);
    },
    onSuccess: async () => {
      localStorage.removeItem('registration_progress');
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      
      toast({
        title: "注册成功！",
        description: "现在让我们了解你的兴趣和话题偏好",
      });
      
      setLocation("/interests-topics");
    },
    onError: (error: Error) => {
      toast({
        title: "注册失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNext = async () => {
    const fieldsToValidate = getFieldsForStep(step);
    const isValid = await form.trigger(fieldsToValidate as any);
    
    if (isValid) {
      if (step < totalSteps) {
        setShowCelebration(true);
        setDirection("forward");
        setTimeout(() => {
          setStep(step + 1);
          setShowCelebration(false);
        }, 400);
      } else {
        form.handleSubmit((data) => registerMutation.mutate(data))();
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setDirection("backward");
      setStep(step - 1);
    }
  };

  const getFieldsForStep = (currentStep: number) => {
    switch (currentStep) {
      case 1:
        // Step 1: 基本信息 (Basic + Personal Status)
        const step1Fields: string[] = ["displayName", "birthdate", "gender", "relationshipStatus"];
        if (showChildrenField) {
          step1Fields.push("children");
        }
        return step1Fields;
      case 2:
        // Step 2: 背景信息 (Education + Work)
        const step2Fields: string[] = ["educationLevel", "studyLocale", "fieldOfStudy", "occupationId", "workMode"];
        return step2Fields;
      case 3:
        // Step 3: 偏好设置 (Intent + Location + Language)
        return ["intent", "hometownRegionCity", "languagesComfort"];
      default:
        return [];
    }
  };

  const progress = (step / totalSteps) * 100;

  const languageOptions = [
    "普通话",
    "粤语",
    "英语",
    "四川话",
    "东北话",
    "河南话",
    "山东话",
    "湖北话",
    "湖南话",
    "闽南话",
    "上海话",
    "客家话",
    "潮汕话",
    "温州话",
    "日语",
    "韩语",
    "法语",
    "德语",
    "西班牙语",
  ];

  const overseasRegionOptions = [
    "美国",
    "英国",
    "加拿大",
    "澳大利亚",
    "新西兰",
    "新加坡",
    "香港",
    "日本",
    "韩国",
    "德国",
    "法国",
    "其他",
  ];

  // Legacy industry options removed - now using OccupationSelector with shared/occupations.ts

  const toggleLanguage = (lang: string) => {
    const current = form.watch("languagesComfort") || [];
    if (current.includes(lang)) {
      form.setValue("languagesComfort", current.filter(l => l !== lang));
    } else {
      form.setValue("languagesComfort", [...current, lang]);
    }
  };

  const toggleOverseasRegion = (region: string) => {
    const current = form.watch("overseasRegions") || [];
    if (current.includes(region)) {
      form.setValue("overseasRegions", current.filter(r => r !== region));
    } else {
      form.setValue("overseasRegions", [...current, region]);
    }
  };

  const handleSkipRegistration = () => {
    const birthdate = new Date();
    birthdate.setFullYear(birthdate.getFullYear() - 28);
    const birthdateStr = birthdate.toISOString().split('T')[0];

    form.setValue("displayName", "测试用户");
    form.setValue("birthdate", birthdateStr);
    form.setValue("gender", "女性");
    form.setValue("relationshipStatus", "单身");
    form.setValue("educationLevel", "硕士");
    form.setValue("studyLocale", "海外");
    form.setValue("overseasRegions", ["美国"]);
    form.setValue("occupationId", "product_manager");
    form.setValue("workMode", "employed");
    form.setValue("industry", "tech");
    form.setValue("roleTitleShort", "产品经理");
    form.setValue("intent", ["friends"]);
    form.setValue("languagesComfort", ["普通话", "英语"]);
    
    registerMutation.mutate(form.getValues());
  };

  const toggleIntent = (intentValue: "networking" | "friends" | "discussion" | "fun" | "romance" | "flexible") => {
    const current = form.watch("intent") || [];
    
    if (intentValue === "flexible") {
      if (current.includes("flexible")) {
        form.setValue("intent", []);
      } else {
        // 选择"随缘都可以"时清空其他选项
        if (current.length > 0) {
          toast({
            title: "已切换为「随缘都可以」",
            description: "此选项将替代之前选择的意图",
            duration: 2000,
          });
        }
        form.setValue("intent", ["flexible"]);
      }
    } else {
      if (current.includes(intentValue)) {
        form.setValue("intent", current.filter(i => i !== intentValue) as typeof current);
      } else {
        // 选择具体意图时，如果之前是"随缘都可以"，给出提示
        const wasFlexible = current.includes("flexible");
        const newIntents = current.filter(i => i !== "flexible");
        form.setValue("intent", [...newIntents, intentValue] as typeof current);
        if (wasFlexible) {
          toast({
            title: "已切换为具体意图",
            description: "可以继续选择多个意图",
            duration: 2000,
          });
        }
      }
    }
  };

  const isDevelopment = import.meta.env.DEV;

  const renderOptionButton = (
    value: string,
    label: string,
    isSelected: boolean,
    onClick: () => void,
    testId: string,
    disabled = false
  ) => (
    <button
      key={value}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full px-5 py-4 text-left rounded-lg transition-all text-base flex items-center gap-3
        ${isSelected
          ? 'border-2 border-primary bg-primary/5 text-primary' 
          : disabled
          ? 'border border-border bg-muted/30 text-muted-foreground cursor-not-allowed'
          : 'border border-border hover-elevate active-elevate-2'
        }
      `}
      data-testid={testId}
    >
      {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
      <span>{label}</span>
    </button>
  );

  const renderGridOptionButton = (
    value: string,
    label: string,
    isSelected: boolean,
    onClick: () => void,
    testId: string
  ) => (
    <button
      key={value}
      type="button"
      onClick={onClick}
      className={`
        px-5 py-4 rounded-lg transition-all text-left text-base flex items-center gap-2
        ${isSelected 
          ? 'border-2 border-primary bg-primary/5 text-primary' 
          : 'border border-border hover-elevate active-elevate-2'
        }
      `}
      data-testid={testId}
    >
      {isSelected && <Check className="h-4 w-4 flex-shrink-0" />}
      <span>{label}</span>
    </button>
  );

  const currentGuidance = stepGuidance[step - 1];
  const GuidanceIcon = currentGuidance.icon;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RegistrationProgress 
        currentStage="basic" 
        currentStep={step}
        totalSteps={totalSteps}
      />

      <CelebrationConfetti show={showCelebration} type="step" />

      <div className="p-4 bg-background">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 rounded-full bg-primary/10">
              <GuidanceIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold">{currentGuidance.title}</h1>
              <p className="text-sm text-muted-foreground">{currentGuidance.subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>约2分钟完成</span>
            <div className="flex items-center gap-1" data-testid="badge-privacy">
              <Shield className="h-3 w-3" />
              <span>信息加密保护</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto overflow-x-hidden">
        <form className="max-w-md mx-auto space-y-6 pb-20">
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 && (
              <motion.div
                key="step1"
                initial={direction === "forward" ? "enterFromRight" : "enterFromLeft"}
                animate="center"
                exit={direction === "forward" ? "exitToLeft" : "exitToRight"}
                variants={slideVariants}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="displayName">昵称 *</Label>
                    <p className="text-xs text-muted-foreground mb-2">在活动中显示的名字</p>
                    <Input
                      id="displayName"
                      {...form.register("displayName")}
                      placeholder="2-12字，支持中英文和表情"
                      data-testid="input-display-name"
                    />
                    {form.formState.errors.displayName && (
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        请输入有效的昵称
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>出生日期 *</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <Select value={birthYear} onValueChange={setBirthYear}>
                        <SelectTrigger data-testid="select-birth-year">
                          <SelectValue placeholder="年" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {years.map(y => <SelectItem key={y} value={String(y)}>{y}年</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={birthMonth} onValueChange={setBirthMonth}>
                        <SelectTrigger data-testid="select-birth-month">
                          <SelectValue placeholder="月" />
                        </SelectTrigger>
                        <SelectContent>
                          {months.map(m => <SelectItem key={m} value={String(m)}>{m}月</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={birthDay} onValueChange={setBirthDay}>
                        <SelectTrigger data-testid="select-birth-day">
                          <SelectValue placeholder="日" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {days.map(d => <SelectItem key={d} value={String(d)}>{d}日</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.formState.errors.birthdate && (
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        请选择出生日期
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>年龄显示设置</Label>
                    <Select
                      value={form.watch("ageVisibility")}
                      onValueChange={(value: any) => form.setValue("ageVisibility", value)}
                    >
                      <SelectTrigger data-testid="select-age-visibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hide_all">完全隐藏</SelectItem>
                        <SelectItem value="show_generation">显示年代（如90后）</SelectItem>
                        <SelectItem value="show_age_range">显示年龄段（如25-30）</SelectItem>
                        <SelectItem value="show_exact_age">显示精确年龄</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      控制其他人能看到你的年龄信息
                    </p>
                  </div>

                  <div>
                    <Label>性别 *</Label>
                    <div className="space-y-3 mt-2">
                      {[
                        { value: "女性", label: "女性" },
                        { value: "男性", label: "男性" },
                      ].map((option) => 
                        renderOptionButton(
                          option.value,
                          option.label,
                          form.watch("gender") === option.value,
                          () => form.setValue("gender", option.value as any),
                          `button-gender-${option.value}`
                        )
                      )}
                    </div>
                    {form.formState.errors.gender && (
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        请选择一项
                      </p>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <Label>关系状态 *</Label>
                    <div className="space-y-3 mt-2">
                      {[
                        { value: "单身", label: "单身" },
                        { value: "恋爱中", label: "恋爱中" },
                        { value: "已婚/伴侣", label: "已婚/伴侣" },
                        { value: "离异", label: "离异" },
                        { value: "丧偶", label: "丧偶" },
                        { value: "不透露", label: "不透露" },
                      ].map((option) => 
                        renderOptionButton(
                          option.value,
                          option.label,
                          form.watch("relationshipStatus") === option.value,
                          () => form.setValue("relationshipStatus", option.value as any),
                          `button-relationship-${option.value}`
                        )
                      )}
                    </div>
                    {form.watch("relationshipStatus") === "不透露" && (
                      <p className="text-xs text-muted-foreground mt-2" data-testid="text-relationship-privacy">
                        我们尊重您的隐私选择，这不会影响您参加活动或匹配效果
                      </p>
                    )}
                    {form.formState.errors.relationshipStatus && (
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        请选择一项
                      </p>
                    )}
                  </div>

                  {showChildrenField && (
                    <div>
                      <Label>孩子状况 *</Label>
                      <div className="space-y-3 mt-2">
                        {[
                          { value: "无孩子", label: "无孩子" },
                          { value: "期待中", label: "期待中" },
                          { value: "0-5岁", label: "0-5岁" },
                          { value: "6-12岁", label: "6-12岁" },
                          { value: "13-18岁", label: "13-18岁" },
                          { value: "成年", label: "成年" },
                        ].map((option) => 
                          renderOptionButton(
                            option.value,
                            option.label,
                            form.watch("children") === option.value,
                            () => form.setValue("children", option.value as any),
                            `button-children-${option.value}`
                          )
                        )}
                      </div>
                    </div>
                  )}

                  <Separator className="my-4" />

                  <div>
                    <Label>有毛孩子吗</Label>
                    <p className="text-xs text-muted-foreground mb-2">帮你找到同为铲屎官的朋友</p>
                    <div className="flex gap-3 mt-2">
                      {[
                        { value: true, label: "有" },
                        { value: false, label: "没有" },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          onClick={() => form.setValue("hasPets", option.value)}
                          className={`flex-1 py-3 px-4 rounded-lg border text-center transition-colors ${
                            form.watch("hasPets") === option.value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-border"
                          }`}
                          data-testid={`button-pets-${option.value}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>有亲兄弟姐妹吗</Label>
                    <p className="text-xs text-muted-foreground mb-2">独生子女的默契懂的都懂</p>
                    <div className="flex gap-3 mt-2">
                      {[
                        { value: true, label: "有" },
                        { value: false, label: "独生子女" },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          onClick={() => form.setValue("hasSiblings", option.value)}
                          className={`flex-1 py-3 px-4 rounded-lg border text-center transition-colors ${
                            form.watch("hasSiblings") === option.value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-border"
                          }`}
                          data-testid={`button-siblings-${option.value}`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={direction === "forward" ? "enterFromRight" : "enterFromLeft"}
                animate="center"
                exit={direction === "forward" ? "exitToLeft" : "exitToRight"}
                variants={slideVariants}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <div>
                    <Label>教育水平 *</Label>
                    <div className="space-y-3 mt-2">
                      {[
                        { value: "高中及以下", label: "高中及以下" },
                        { value: "大专", label: "大专" },
                        { value: "本科", label: "本科" },
                        { value: "硕士", label: "硕士" },
                        { value: "博士", label: "博士" },
                        { value: "职业培训", label: "职业培训" },
                      ].map((option) => 
                        renderOptionButton(
                          option.value,
                          option.label,
                          form.watch("educationLevel") === option.value,
                          () => form.setValue("educationLevel", option.value as any),
                          `button-education-${option.value}`
                        )
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>学习地点 *</Label>
                    <div className="space-y-3 mt-2">
                      {[
                        { value: "本地", label: "本地" },
                        { value: "海外", label: "海外" },
                        { value: "都有", label: "都有" },
                      ].map((option) => 
                        renderOptionButton(
                          option.value,
                          option.label,
                          form.watch("studyLocale") === option.value,
                          () => form.setValue("studyLocale", option.value as any),
                          `button-study-locale-${option.value}`
                        )
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {(form.watch("studyLocale") === "海外" || form.watch("studyLocale") === "都有") && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Label>海外地区（可选）</Label>
                          {(form.watch("overseasRegions") || []).length > 0 && (
                            <span className="text-xs text-primary font-medium" data-testid="text-overseas-count">
                              已选 {(form.watch("overseasRegions") || []).length} 个
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">
                          选择你在海外学习的地区（可多选）
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {overseasRegionOptions.map((region) => {
                            const isSelected = (form.watch("overseasRegions") || []).includes(region);
                            return renderGridOptionButton(
                              region,
                              region,
                              isSelected,
                              () => toggleOverseasRegion(region),
                              `button-region-${region}`
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <Label htmlFor="fieldOfStudy">专业领域 *</Label>
                    <Input
                      id="fieldOfStudy"
                      {...form.register("fieldOfStudy")}
                      placeholder="例如：计算机科学、金融学、心理学"
                      data-testid="input-field-of-study"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      {["计算机", "金融", "商业管理", "法律", "医学", "生物医药", "设计", "传媒", "心理学", "教育", "建筑", "公共管理"].map(field => (
                        <button
                          key={field}
                          type="button"
                          onClick={() => form.setValue("fieldOfStudy", field)}
                          className="px-3 py-1 text-xs rounded-full bg-muted hover-elevate"
                          data-testid={`chip-field-${field}`}
                        >
                          {field}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>

                <Separator className="my-4" />

                <div className="space-y-4">
                  <OccupationSelector
                    selectedOccupationId={form.watch("occupationId") || null}
                    selectedWorkMode={(form.watch("workMode") as WorkMode) || null}
                    socialIntent={form.watch("intent")?.[0] || null}
                    onOccupationChange={(occupationId, industryId) => {
                      form.setValue("occupationId", occupationId);
                      form.setValue("industry", industryId);
                      const occupation = getOccupationById(occupationId);
                      if (occupation) {
                        form.setValue("roleTitleShort", occupation.displayName);
                      }
                    }}
                    onWorkModeChange={(workMode) => {
                      form.setValue("workMode", workMode);
                    }}
                  />
                  {(form.formState.errors.occupationId || form.formState.errors.workMode) && (
                    <p className="text-sm text-orange-600 dark:text-orange-400">
                      {form.formState.errors.occupationId?.message || form.formState.errors.workMode?.message}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={direction === "forward" ? "enterFromRight" : "enterFromLeft"}
                animate="center"
                exit={direction === "forward" ? "exitToLeft" : "exitToRight"}
                variants={slideVariants}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-6"
              >

                <div className="space-y-4">
                  <div>
                    <Label>默认活动意图 *</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      这是你的默认偏好，加入活动时可以调整
                    </p>
                    <div className="space-y-3 mt-2">
                      {intentOptions.map((option) => {
                        const currentIntents = form.watch("intent") || [];
                        const isSelected = currentIntents.includes(option.value);
                        const isFlexible = option.value === "flexible";
                        const hasFlexible = currentIntents.includes("flexible");
                        const isDisabled = !isFlexible && hasFlexible;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => toggleIntent(option.value)}
                            disabled={isDisabled}
                            className={`
                              w-full px-5 py-4 text-left rounded-lg transition-all
                              ${isSelected
                                ? 'border-2 border-primary bg-primary/5 text-primary' 
                                : isDisabled
                                ? 'border border-border bg-muted/30 text-muted-foreground cursor-not-allowed'
                                : 'border border-border hover-elevate active-elevate-2'
                              }
                            `}
                            data-testid={`button-intent-${option.value}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`
                                mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center
                                ${isSelected 
                                  ? 'bg-primary border-primary' 
                                  : 'border-border'
                                }
                              `}>
                                {isSelected && (
                                  <Check className="w-3 h-3 text-primary-foreground" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-base">{option.label}</div>
                                <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {form.formState.errors.intent && (
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        请至少选择一项
                      </p>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-3">
                    <Label>家乡 *</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={selectedProvince}
                        onValueChange={(value) => {
                          setSelectedProvince(value);
                          setSelectedCity("");
                        }}
                      >
                        <SelectTrigger data-testid="select-hometown-province">
                          <SelectValue placeholder="选择省份" />
                        </SelectTrigger>
                        <SelectContent>
                          {chinaRegions.map((province) => (
                            <SelectItem key={province.code} value={province.name}>
                              {province.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      <Select
                        value={selectedCity}
                        onValueChange={setSelectedCity}
                        disabled={!selectedProvince || availableCities.length <= 1}
                      >
                        <SelectTrigger data-testid="select-hometown-city">
                          <SelectValue placeholder={availableCities.length <= 1 ? "—" : "选择城市"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableCities.map((city) => (
                            <SelectItem key={city.code} value={city.name}>
                              {city.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedProvince && (
                      <p className="text-xs text-muted-foreground">
                        已选择：{formatHometown(selectedProvince, selectedCity)}
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <Label>现居城市 *</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleGpsLocate}
                        disabled={isLocating}
                        className="gap-1"
                        data-testid="button-gps-locate"
                      >
                        {isLocating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <MapPin className="h-3 w-3" />
                        )}
                        {isLocating ? "定位中..." : "自动定位"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">帮你找到同城小伙伴</p>
                    {gpsMessage && (
                      <p className={`text-xs mb-2 ${gpsMessage.includes("成功") ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`}>
                        {gpsMessage}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {["香港", "深圳", "广州", "东莞", "珠海", "澳门", "其他"].map((city) => {
                        const isSelected = form.watch("currentCity") === city;
                        return (
                          <button
                            key={city}
                            type="button"
                            onClick={() => form.setValue("currentCity", city)}
                            className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background hover:bg-muted border-border"
                            }`}
                            data-testid={`button-current-city-${city}`}
                          >
                            {city}
                          </button>
                        );
                      })}
                    </div>
                    {form.formState.errors.currentCity && (
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                        请选择现居城市
                      </p>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div>
                    <Label>语言舒适度 *</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      选择你可以舒适交流的语言
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {languageOptions.map((lang) => {
                        const isSelected = (form.watch("languagesComfort") || []).includes(lang);
                        return renderGridOptionButton(
                          lang,
                          lang,
                          isSelected,
                          () => toggleLanguage(lang),
                          `button-lang-${lang}`
                        );
                      })}
                    </div>
                    {form.formState.errors.languagesComfort && (
                      <p className="text-sm text-orange-600 dark:text-orange-400 mt-2">
                        请至少选择一种语言
                      </p>
                    )}
                  </div>

                  <Separator className="my-4" />

                  <div className="rounded-lg border p-4 bg-muted/30" data-testid="profile-preview-card">
                    <h3 className="font-medium mb-3 text-sm">个人资料预览</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">昵称</span>
                        <span>{form.watch("displayName") || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">性别</span>
                        <span>{form.watch("gender") === "女性" ? "女性" : form.watch("gender") === "男性" ? "男性" : "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">关系状态</span>
                        <span>{form.watch("relationshipStatus") || "-"}</span>
                      </div>
                      {form.watch("educationLevel") && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">学历</span>
                          <span>{form.watch("educationLevel")}</span>
                        </div>
                      )}
                      {form.watch("fieldOfStudy") && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">专业</span>
                          <span>{form.watch("fieldOfStudy")}</span>
                        </div>
                      )}
                      {form.watch("industry") && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">行业</span>
                          <span>{form.watch("industry")}</span>
                        </div>
                      )}
                      {form.watch("currentCity") && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">现居</span>
                          <span>{form.watch("currentCity")}</span>
                        </div>
                      )}
                      {(form.watch("languagesComfort") || []).length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">语言</span>
                          <span>{(form.watch("languagesComfort") || []).join(", ")}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>

      <div className="border-t p-4 bg-background sticky bottom-0">
        <div className="max-w-md mx-auto space-y-3">
          <div className="flex gap-3">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1"
                data-testid="button-back"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                上一步
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="flex-1"
              disabled={registerMutation.isPending}
              data-testid="button-next"
            >
              {step === totalSteps ? (
                registerMutation.isPending ? "提交中..." : "完成注册"
              ) : (
                <>
                  下一步
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
          
          {isDevelopment && (
            <Button
              variant="ghost"
              onClick={handleSkipRegistration}
              className="w-full text-xs"
              disabled={registerMutation.isPending}
              data-testid="button-skip-registration"
            >
              跳过注册（测试）
            </Button>
          )}
        </div>
      </div>

      {showRestoreDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-background rounded-lg shadow-lg max-w-sm w-full p-6 space-y-4"
          >
            <h3 className="text-lg font-bold">恢复上次进度？</h3>
            <p className="text-sm text-muted-foreground">
              我们发现了你之前的注册进度。是否继续填写？
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleRestoreCancel}
                className="flex-1"
                data-testid="button-restore-cancel"
              >
                重新开始
              </Button>
              <Button
                onClick={handleRestoreConfirm}
                className="flex-1"
                data-testid="button-restore-confirm"
              >
                继续上次
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
