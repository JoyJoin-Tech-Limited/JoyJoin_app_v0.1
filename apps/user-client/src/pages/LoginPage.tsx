import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Users, Gift, Sparkles, Star, Heart, 
  Shield, Quote, MapPin, CheckCircle2, ArrowRight,
  Flower2, Target, Sun, Play, Volume2, VolumeX, Loader2
} from "lucide-react";
import joyJoinLogo from "@/assets/box_logo_archetypes.png";
import heroVideo from "@/assets/generated_videos/dusk_skyline_fades_to_cozy_dinner.mp4";
import heroPoster from "@/assets/stock_images/shenzhen_city_roofto_e7cea581.jpg";

import xiaoyueFoxAvatar from "@/assets/xiaoyue_default.png";
import { SiWechat } from "react-icons/si";

import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { nextStepToRoute, resolveOnboardingRoute } from "@/hooks/useOnboardingRoute";
import type { AuthUser } from "@/hooks/useAuth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { PromotionBannerCarousel } from "@/components/PromotionBannerCarousel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AREA_CODES = [
  { code: "+86", country: "中国大陆", flag: "🇨🇳" },
  { code: "+852", country: "中国香港", flag: "🇭🇰" },
];

const TESTIMONIALS = [
  {
    id: 1,
    name: "小雨",
    age: 28,
    city: "深圳",
    AvatarIcon: Flower2,
    archetype: "暖心熊",
    quote: "第一次参加就认识了几个聊得来的朋友，AI匹配真的很准！现在我们每周都约着一起打球。",
    rating: 5,
  },
  {
    id: 2,
    name: "Alex",
    age: 31,
    city: "香港",
    AvatarIcon: Target,
    archetype: "机智狐",
    quote: "作为社恐，小局的氛围让我很放松。4-6个人刚刚好，不会有那种大场合的压力。",
    rating: 5,
  },
  {
    id: 3,
    name: "晓峰",
    age: 26,
    city: "深圳",
    AvatarIcon: Sun,
    archetype: "开心柯基",
    quote: "来深圳三年终于找到一群志同道合的朋友了，悦聚的匹配算法真的懂我！",
    rating: 5,
  },
];

const FAQ_ITEMS = [
  {
    question: "悦聚是什么？怎么玩？",
    answer: "悦聚是一个AI驱动的小型社交活动平台，专注于4-6人的精致饭局和酒局。你只需完成简单的性格测评，选择感兴趣的活动报名，AI会帮你匹配到合适的小伙伴。活动当天，你会收到匹配结果和破冰话题。",
  },
  {
    question: "活动费用是多少？",
    answer: "单次活动票价¥88，我们也提供更划算的套餐：3次卡¥211（8折）、6次卡¥370（7折）。开通权益方案¥128/月，享受无限活动+专享特权。活动当天的餐饮费用AA制，人均100-200元。",
  },
  {
    question: "如果临时有事能退款吗？",
    answer: "活动开始前24小时可免费取消，已开通权益的用户可免费改期。超过时限的取消，积分会转为下次使用的优惠券。",
  },
  {
    question: "会不会遇到奇怪的人？",
    answer: "我们有严格的用户审核和评分机制。每位用户都需要完成手机验证和性格测评。活动后的双向匿名评分帮助我们筛选优质用户，多次低评分的用户会被限制参与活动。",
  },
  {
    question: "一个人去会不会尴尬？",
    answer: "完全不会！90%的参与者都是独自报名。我们的AI匹配会根据你的性格和兴趣为你安排合适的同桌。小悦还会提供专属破冰话题，帮你轻松打开话匣子。",
  },
];

// 小悦对话消息序列
const XIAOYUE_MESSAGES = [
  "嗨～我是小悦，你的社交配局师！",
  "我帮500+朋友找到了chemistry对的饭搭子",
  "每桌4-6人，都是我精挑细选的组合哦~",
];

// 小悦风格的功能标签 - 精简版4大卖点
const XIAOYUE_FEATURES = [
  { text: "4-6人精品小局", icon: Users },
  { text: "AI智能配对", icon: Sparkles },
  { text: "破冰工具箱", icon: Gift },
  { text: "不满意全退", icon: Heart },
];

interface PublicStats {
  totalUsers: number;
  totalEvents: number;
  satisfactionRate: number;
  avgRating: number;
}

function detectDefaultAreaCode(): string {
  const lang = navigator.language?.toLowerCase() || "";
  const languages = navigator.languages?.map(l => l.toLowerCase()) || [];
  
  if (lang.includes("zh-hk") || languages.some(l => l.includes("zh-hk"))) {
    return "+852";
  }
  
  return "+86";
}

export default function LoginPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [areaCode, setAreaCode] = useState("+86");
  const [phoneNumber, setPhoneNumber] = useState("");
  // 暂时注释：短信验证码相关状态
  // const [verificationCode, setVerificationCode] = useState("");
  // const [codeSent, setCodeSent] = useState(false);
  // const [countdown, setCountdown] = useState(0);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isDevelopment = import.meta.env.DEV;

  // Test shortcut: press 't' to go to registration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        setLocation('/registration/method');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setLocation]);

  useEffect(() => {
    const detectedCode = detectDefaultAreaCode();
    setAreaCode(detectedCode);
  }, []);

  // Fetch public stats for social proof
  const { data: stats } = useQuery<PublicStats>({
    queryKey: ["/api/public/stats"],
    retry: false,
  });

  // 暂时注释：发送短信验证码的mutation
  // const sendCodeMutation = useMutation({
  //   mutationFn: async (phone: string) => {
  //     return await apiRequest("POST", "/api/auth/send-code", { phoneNumber: phone });
  //   },
  //   onSuccess: () => {
  //     setCodeSent(true);
  //     setCountdown(60);
  //     const timer = setInterval(() => {
  //       setCountdown((prev) => {
  //         if (prev <= 1) {
  //           clearInterval(timer);
  //           return 0;
  //         }
  //         return prev - 1;
  //       });
  //     }, 1000);
  //     
  //     toast({
  //       title: "验证码已发送",
  //       description: "请查收短信验证码",
  //     });
  //   },
  //   onError: (error: Error) => {
  //     toast({
  //       title: "发送失败",
  //       description: error.message,
  //       variant: "destructive",
  //     });
  //   },
  // });

  const loginMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; code: string; referralCode?: string }) => {
      const response = await apiRequest("POST", "/api/auth/phone-login", data);
      return await response.json();
    },
    onSuccess: async (userData) => {
      // 清除上一个用户的对话注册状态，防止跨用户数据泄露
      try {
        localStorage.removeItem('joyjoin_chat_registration_state');
        localStorage.removeItem('registration_progress');
      } catch (e) {
        console.warn('Failed to clear old registration state:', e);
      }
      
      // Clear referral code after successful registration
      try {
        localStorage.removeItem('referral_code');
      } catch (e) {
        console.warn('Failed to clear referral code:', e);
      }
      
      try {
        await apiRequest("POST", "/api/demo/seed-events", {});
        console.log("Demo events seeded");
      } catch (error) {
        console.log("Demo events may already exist:", error);
      }
      
      const pendingInviteCode = localStorage.getItem('pending_invitation_code');
      if (pendingInviteCode) {
        toast({
          title: "登录成功",
          description: "正在处理邀请...",
        });
        await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        window.location.href = `/invite/${pendingInviteCode}`;
        return;
      }
      
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      const updatedUser = await queryClient.fetchQuery<AuthUser | null>({ queryKey: ["/api/auth/user"] });
      const nextRoute = resolveOnboardingRoute(updatedUser);

      if (nextRoute !== "/discover") {
        toast({
          title: "欢迎加入悦聚！",
          description: "让我们开始认识你吧~",
        });
        setTimeout(() => setLocation(nextRoute), 500);
      } else {
        toast({
          title: "登录成功",
          description: "欢迎回来！",
        });
        setTimeout(() => setLocation("/"), 500);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "登录失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getPhoneLength = () => {
    if (areaCode === "+86") return 11;
    if (areaCode === "+852" || areaCode === "+853") return 8;
    if (areaCode === "+886") return 10;
    return 11;
  };

  // 暂时注释：发送验证码的处理函数
  // const handleSendCode = () => {
  //   const expectedLength = getPhoneLength();
  //   if (!phoneNumber || phoneNumber.length !== expectedLength) {
  //     toast({
  //       title: "手机号格式错误",
  //       description: `请输入${expectedLength}位手机号`,
  //       variant: "destructive",
  //     });
  //     return;
  //   }
  //   const fullPhone = `${areaCode}${phoneNumber}`;
  //   sendCodeMutation.mutate(fullPhone);
  // };

  const handleLogin = () => {
    console.log("🔧 [DEBUG] handleLogin called, phoneNumber:", phoneNumber, "areaCode:", areaCode);
    // 修改为只需要手机号即可登录，使用固定的DEMO验证码
    const expectedLength = getPhoneLength();
    console.log("🔧 [DEBUG] expectedLength:", expectedLength, "actual:", phoneNumber.length);
    if (!phoneNumber || phoneNumber.length !== expectedLength) {
      console.log("🔧 [DEBUG] Phone validation failed");
      toast({
        title: "手机号格式错误",
        description: `请输入${expectedLength}位手机号`,
        variant: "destructive",
      });
      return;
    }
    const fullPhone = `${areaCode}${phoneNumber}`;
    console.log("🔧 [DEBUG] Calling loginMutation with fullPhone:", fullPhone);
    
    // Check for referral code in localStorage
    const referralCode = localStorage.getItem('referral_code');
    if (referralCode) {
      console.log("🎁 [REFERRAL] Found referral code in localStorage:", referralCode);
    }
    
    // 使用固定的DEMO验证码，暂时不需要用户输入验证码
    loginMutation.mutate({ 
      phoneNumber: fullPhone, 
      code: "666666",
      ...(referralCode && { referralCode })
    });
  };

  const handleWeChatLogin = async () => {
    try {
      let code: string;
      if (typeof wx !== 'undefined' && wx.login) {
        const loginResult = await new Promise<any>((resolve, reject) => {
          wx.login({ success: resolve, fail: (err: any) => reject(new Error(err.errMsg || 'wx.login failed')) });
        });
        code = loginResult.code;
      } else {
        code = `wechat_test_${crypto.randomUUID()}`;
      }

      const response = await apiRequest("POST", "/api/auth/wechat/login-with-test", {
        code,
        testAnswers: [],
      });
      const data = await response.json();

      if (data.success) {
        await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
        const updatedUser = await queryClient.fetchQuery<AuthUser | null>({ queryKey: ["/api/auth/user"] });
        const nextPath = updatedUser?.nextStep
          ? nextStepToRoute(updatedUser.nextStep)
          : resolveOnboardingRoute(updatedUser);
        setLocation(nextPath);
      }
    } catch (err) {
      toast({
        title: "登录失败",
        description: err instanceof Error ? err.message : "登录失败，请检查网络连接后重试",
        variant: "destructive",
      });
    }
  };

  // Stats display with fallback values
  const displayStats = [
    { 
      value: stats?.totalUsers ? `${stats.totalUsers.toLocaleString()}+` : "2000+", 
      label: "活跃用户", 
      icon: Users 
    },
    { 
      value: stats?.totalEvents ? `${stats.totalEvents}+` : "500+", 
      label: "成功活动", 
      icon: Sparkles 
    },
    { 
      value: stats?.satisfactionRate ? `${stats.satisfactionRate}%` : "95%", 
      label: "好评率", 
      icon: Star 
    },
    { 
      value: stats?.avgRating?.toFixed(1) || "4.8", 
      label: "平均评分", 
      icon: Heart 
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Section 1: Hero with Video Background */}
      <section 
        className="relative min-h-[70vh] flex items-center justify-center overflow-hidden"
        data-testid="section-hero"
      >
        {/* Video Background Layer */}
        <div className="absolute inset-0 z-0">
          {/* Video Background with poster for fast loading */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted={isVideoMuted}
            playsInline
            poster={heroPoster}
          >
            <source src={heroVideo} type="video/mp4" />
          </video>
          
          {/* Dark wash overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/30 to-black/50" />
        </div>

        {/* Content Layer */}
        <div className="relative z-10 max-w-lg mx-auto text-center space-y-6 px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div 
              key={`logo-${Date.now()}`}
              className="flex justify-center mb-6"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 12, duration: 0.8 }}
            >
              <img 
                src={joyJoinLogo} 
                alt="悦聚 JoyJoin Logo" 
                className="h-44 w-auto drop-shadow-xl"
                data-testid="img-logo"
              />
            </motion.div>
            
            <h1 className="text-4xl font-jiangdou text-white drop-shadow-lg" data-testid="text-brand-name">
              悦聚·JoyJoin
            </h1>
            
            <p className="text-2xl font-jiangdou text-white/90 mt-2 drop-shadow-md">
              小局·好能量
            </p>
            
            <p className="text-white/80 mt-4 leading-relaxed max-w-md mx-auto drop-shadow-sm">
              在香港和深圳，AI帮你找到真正合拍的朋友。<br/>
              每一场4-6人小聚，都是精心策划的相遇。
            </p>
          </motion.div>

          {/* CTA Button - P0 优化：渐变+发光+脉冲动画 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="inline-flex"
          >
            <motion.div
              animate={{ 
                boxShadow: [
                  "0 0 15px rgba(168, 85, 247, 0.4), 0 0 30px rgba(168, 85, 247, 0.2)",
                  "0 0 25px rgba(168, 85, 247, 0.6), 0 0 50px rgba(168, 85, 247, 0.3)",
                  "0 0 15px rgba(168, 85, 247, 0.4), 0 0 30px rgba(168, 85, 247, 0.2)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex rounded-md"
            >
              <Button
                size="lg"
                className="min-h-[52px] px-10 text-lg font-bold bg-gradient-to-r from-purple-500 via-primary to-pink-500 hover:from-purple-600 hover:via-primary/90 hover:to-pink-600 text-white border-0 shadow-xl transition-all duration-300 hover:scale-[1.02]"
                onClick={() => setLocation("/onboarding")}
                data-testid="button-hero-cta"
              >
                立即体验
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </motion.div>
          </motion.div>

          {/* Safety Badges - P0 优化 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex items-center justify-center gap-4 flex-wrap"
          >
            <div className="flex items-center gap-1.5 text-white/80 text-sm">
              <Shield className="h-4 w-4" />
              <span>实名认证</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/80 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>不满意全退</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/80 text-sm">
              <Users className="h-4 w-4" />
              <span>4-6人小局</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Section 2: Promotion Banner Carousel */}
      <div className="py-4 px-4" data-testid="section-banners">
        <PromotionBannerCarousel 
          placement="landing" 
          className="px-0"
        />
      </div>

      {/* P1-1: FAQ Quick Entry - 社恐安心提示 */}
      <div className="px-4 pb-4" data-testid="section-faq-quick">
        <a href="#faq-section"
          className="block max-w-lg mx-auto"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
          data-testid="link-faq-reassurance"
        >
          <div className="flex items-center justify-center gap-2 min-h-[44px] px-4 bg-primary/10 hover:bg-primary/15 rounded-lg transition-colors">
            <Heart className="h-5 w-5 text-primary" />
            <span className="text-base text-foreground">一个人去会不会尴尬？</span>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </a>
      </div>

      {/* Section 3: 小悦介绍区 - 卡片式全身展示 */}
      <section className="py-4 px-4" data-testid="section-features">
        <div className="max-w-lg mx-auto">
          <Card className="overflow-hidden border-0 shadow-sm bg-white dark:bg-card">
            <CardContent className="p-0">
              <div className="flex">
                {/* 小悦全身图 - 左侧 */}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  whileInView={{ x: 0, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="flex-shrink-0 w-28"
                >
                  <img 
                    src={xiaoyueFoxAvatar} 
                    alt="小悦" 
                    className="w-full h-48 object-contain object-center"
                    data-testid="img-xiaoyue-avatar"
                  />
                </motion.div>

                {/* 右侧信息区 */}
                <div className="flex-1 py-3 pr-4 flex flex-col justify-center">
                  {/* 名字和标识 */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-foreground">小悦</h3>
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">AI社交建筑师</span>
                    </div>
                    <p className="text-sm text-foreground mt-1" data-testid="text-xiaoyue-message-0">
                      帮 <span className="font-bold text-primary">500+</span> 朋友配到chemistry对的饭搭子
                    </p>
                  </motion.div>
                  
                  {/* 4大卖点 - 2x2网格 */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 gap-1.5"
                  >
                    {XIAOYUE_FEATURES.map((feature, index) => (
                      <div
                        key={feature.text}
                        className="flex items-center gap-1 text-xs text-muted-foreground"
                        data-testid={`tag-feature-${index}`}
                      >
                        <feature.icon className="w-3 h-3 text-primary flex-shrink-0" />
                        <span>{feature.text}</span>
                      </div>
                    ))}
                  </motion.div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 5: Login Form */}
      <section id="login-section" className="py-6 px-6" data-testid="section-login">
        <div className="max-w-md mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-6"
          >
            <Badge variant="secondary" className="mb-3">立即开始</Badge>
            <h2 className="text-xl font-bold">加入悦聚大家庭</h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card className="border shadow-lg">
              <CardContent className="p-6 space-y-5">
                {/* WeChat Login */}
                <Button
                  size="lg"
                  className="w-full bg-[#07C160] hover:bg-[#06AD56] text-white border-0"
                  onClick={handleWeChatLogin}
                  data-testid="button-wechat-login"
                >
                  <SiWechat className="h-5 w-5 mr-2" />
                  微信一键登录
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-3 text-muted-foreground">或使用手机号登录</span>
                  </div>
                </div>

                {/* DEV ONLY: Quick tester bypass */}
                {isDevelopment && (
                  <div className="space-y-2">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-amber-200"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-card px-3 text-amber-500 font-medium">🧪 测试快捷入口 (DEV ONLY)</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full border-amber-400 text-amber-600 hover:bg-amber-50"
                      data-testid="button-dev-quick-login"
                      disabled={loginMutation.isPending}
                      onClick={() => loginMutation.mutate({ phoneNumber: "+8613800000001", code: "666666" })}
                    >
                      {loginMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          登录中...
                        </>
                      ) : (
                        "⚡ 测试账号一键登录"
                      )}
                    </Button>
                  </div>
                )}

                {/* Phone Number Login */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">手机号</Label>
                    <div className="flex gap-2">
                      <Select value={areaCode} onValueChange={setAreaCode}>
                        <SelectTrigger className="w-[110px] h-11" data-testid="select-area-code">
                          <span className="flex items-center gap-1">
                            <span>{AREA_CODES.find(a => a.code === areaCode)?.flag}</span>
                            <span>{areaCode}</span>
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {AREA_CODES.map((area) => (
                            <SelectItem key={area.code} value={area.code}>
                              <span className="flex items-center gap-2">
                                <span>{area.flag}</span>
                                <span>{area.code}</span>
                                <span className="text-muted-foreground text-xs">{area.country}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder={`请输入${getPhoneLength()}位手机号`}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, getPhoneLength()))}
                        maxLength={getPhoneLength()}
                        className="h-11 flex-1"
                        data-testid="input-phone"
                      />
                    </div>
                  </div>

                  {/* 暂时注释：验证码输入框和发送验证码按钮 */}
                  {/* <div className="space-y-2">
                    <Label htmlFor="code" className="text-sm font-medium">验证码</Label>
                    <div className="flex gap-2">
                      <Input
                        id="code"
                        type="text"
                        placeholder="请输入验证码"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        className="h-11"
                        data-testid="input-code"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSendCode}
                        disabled={countdown > 0 || sendCodeMutation.isPending}
                        className="min-w-[100px] h-11"
                        data-testid="button-send-code"
                      >
                        {countdown > 0 ? `${countdown}秒` : codeSent ? "重新发送" : "发送验证码"}
                      </Button>
                    </div>
                  </div> */}

                  <Button
                    size="lg"
                    className="w-full h-11"
                    onClick={handleLogin}
                    disabled={loginMutation.isPending}
                    data-testid="button-login"
                  >
                    {loginMutation.isPending ? "登录中..." : "登录 / 注册"}
                  </Button>
                </div>

                {/* Safety Badges */}
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
                  <div className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-green-500" />
                    <span>隐私保护</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    <span>免费注册</span>
                  </div>
                </div>

                {/* Terms */}
                <p className="text-xs text-center text-muted-foreground leading-relaxed">
                  登录即表示同意
                  <a href="#" className="text-primary hover:underline ml-1">《用户协议》</a>
                  和
                  <a href="#" className="text-primary hover:underline">《隐私政策》</a>
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Section 6: Testimonials */}
      <section className="py-12 px-6 bg-muted/30" data-testid="section-testimonials">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <Badge variant="secondary" className="mb-3">用户心声</Badge>
            <h2 className="text-xl font-bold">他们在悦聚找到了</h2>
          </motion.div>

          <div className="space-y-4">
            {TESTIMONIALS.map((testimonial, i) => (
              <motion.div
                key={testimonial.id}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Card data-testid={`testimonial-${testimonial.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <testimonial.AvatarIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <span className="font-medium text-sm">{testimonial.name}</span>
                          <span className="text-xs text-muted-foreground">{testimonial.age}岁</span>
                          <Badge variant="outline" className="text-xs py-0">
                            <MapPin className="h-3 w-3 mr-1" />
                            {testimonial.city}
                          </Badge>
                          <Badge variant="secondary" className="text-xs py-0">{testimonial.archetype}</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          <Quote className="h-3 w-3 inline mr-1 text-primary/40" />
                          {testimonial.quote}
                        </p>
                        <div className="flex items-center gap-0.5 mt-2">
                          {Array.from({ length: testimonial.rating }).map((_, j) => (
                            <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 7: FAQ */}
      <section id="faq-section" className="py-12 px-6" data-testid="section-faq">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <Badge variant="secondary" className="mb-3">常见问题</Badge>
            <h2 className="text-xl font-bold">你可能想知道</h2>
          </motion.div>

          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem 
                key={i} 
                value={`item-${i}`}
                className="border rounded-lg px-4 data-[state=open]:bg-muted/50"
                data-testid={`faq-item-${i}`}
              >
                <AccordionTrigger className="text-left hover:no-underline py-3 text-sm">
                  <span className="font-medium">{item.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm pb-4">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Section 8: Final CTA */}
      <section className="py-16 px-6 bg-gradient-to-b from-primary/10 to-primary/5" data-testid="section-cta">
        <div className="max-w-lg mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-4"
          >
            <h2 className="text-2xl font-bold">
              准备好遇见有趣的灵魂了吗？
            </h2>
            <p className="text-muted-foreground">
              加入{stats?.totalUsers?.toLocaleString() || "2000"}+小伙伴，开启高质量社交之旅
            </p>

            <Button 
              size="lg" 
              className="px-8"
              onClick={() => document.getElementById('phone')?.focus()}
              data-testid="button-cta"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              立即开始
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t bg-background">
        <div className="max-w-lg mx-auto text-center text-sm text-muted-foreground">
          <p>© 2024 悦聚·JoyJoin. 专注香港和深圳本地社交</p>
          <p className="mt-2">
            <a href="#" className="hover:text-foreground">服务条款</a>
            <span className="mx-2">·</span>
            <a href="#" className="hover:text-foreground">隐私政策</a>
            <span className="mx-2">·</span>
            <a href="#" className="hover:text-foreground">联系我们</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
