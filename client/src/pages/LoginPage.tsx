import { useState, useEffect, useRef } from "react";
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
  Users, Brain, Gift, Smile, Sparkles, Star, Heart, 
  Shield, Quote, MapPin, CheckCircle2, ArrowRight,
  Flower2, Target, Sun, Play, Volume2, VolumeX
} from "lucide-react";
import joyJoinLogo from "@assets/JoyJoinapp_logo_chi_Fuludouti_1765444760154.png";
import { SiWechat } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  { code: "+852", country: "香港", flag: "🇭🇰" },
  { code: "+853", country: "澳门", flag: "🇲🇴" },
  { code: "+886", country: "台湾", flag: "🇹🇼" },
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
    answer: "单次活动票价¥88，我们也提供更划算的套餐：3次卡¥211（8折）、6次卡¥370（7折）。VIP会员¥128/月享受无限活动+专属特权。活动当天的餐饮费用AA制，人均100-200元。",
  },
  {
    question: "如果临时有事能退款吗？",
    answer: "活动开始前24小时可免费取消，VIP会员可免费改期。超过时限的取消，积分会转为下次使用的优惠券。",
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

const FEATURES = [
  {
    icon: Users,
    title: "4-6人精品小局",
    subtitle: "神秘饭局 · 深度社交 · 小而美的聚会",
    color: "from-purple-500 to-purple-600",
  },
  {
    icon: Brain,
    title: "AI智能匹配",
    subtitle: "8维画像 · 精准连接 · 志趣相投",
    color: "from-blue-500 to-blue-600",
  },
  {
    icon: Gift,
    title: "神秘盲盒体验",
    subtitle: "翻卡解锁 · 惊喜相遇 · 每次都是新冒险",
    color: "from-pink-500 to-pink-600",
  },
  {
    icon: Smile,
    title: "包开心有趣",
    subtitle: "轻松氛围 · 愉悦体验 · 笑声不断",
    color: "from-orange-500 to-orange-600",
  },
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
  
  if (lang.includes("zh-tw") || languages.some(l => l.includes("zh-tw"))) {
    return "+886";
  }
  
  if (lang.includes("zh-hk") || languages.some(l => l.includes("zh-hk"))) {
    return "+852";
  }
  
  if (lang.includes("zh-mo") || languages.some(l => l.includes("zh-mo"))) {
    return "+853";
  }
  
  return "+86";
}

export default function LoginPage() {
  const { toast } = useToast();
  const [areaCode, setAreaCode] = useState("+86");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isVideoMuted, setIsVideoMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const detectedCode = detectDefaultAreaCode();
    setAreaCode(detectedCode);
  }, []);

  // Fetch public stats for social proof
  const { data: stats } = useQuery<PublicStats>({
    queryKey: ["/api/public/stats"],
    retry: false,
  });

  const sendCodeMutation = useMutation({
    mutationFn: async (phone: string) => {
      return await apiRequest("POST", "/api/auth/send-code", { phoneNumber: phone });
    },
    onSuccess: () => {
      setCodeSent(true);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      toast({
        title: "验证码已发送",
        description: "请查收短信验证码",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "发送失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; code: string }) => {
      return await apiRequest("POST", "/api/auth/phone-login", data);
    },
    onSuccess: async () => {
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
      
      toast({
        title: "登录成功",
        description: "欢迎回来！",
      });
      
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
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

  const handleSendCode = () => {
    const expectedLength = getPhoneLength();
    if (!phoneNumber || phoneNumber.length !== expectedLength) {
      toast({
        title: "手机号格式错误",
        description: `请输入${expectedLength}位手机号`,
        variant: "destructive",
      });
      return;
    }
    const fullPhone = `${areaCode}${phoneNumber}`;
    sendCodeMutation.mutate(fullPhone);
  };

  const handleLogin = () => {
    if (!phoneNumber || !verificationCode) {
      toast({
        title: "信息不完整",
        description: "请输入手机号和验证码",
        variant: "destructive",
      });
      return;
    }
    const fullPhone = `${areaCode}${phoneNumber}`;
    loginMutation.mutate({ phoneNumber: fullPhone, code: verificationCode });
  };

  const handleWeChatLogin = () => {
    toast({
      title: "微信登录",
      description: "微信授权登录功能开发中，敬请期待",
    });
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
      {/* Section 1: Hero */}
      <section 
        className="relative py-16 px-6 bg-gradient-to-b from-primary/10 via-primary/5 to-background"
        data-testid="section-hero"
      >
        <div className="max-w-lg mx-auto text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex justify-center mb-6">
              <img 
                src={joyJoinLogo} 
                alt="悦聚 JoyJoin Logo" 
                className="h-28 w-auto"
                data-testid="img-logo"
              />
            </div>
            
            <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent" data-testid="text-brand-name">
              悦聚·Joy
            </h1>
            
            <p className="text-xl font-medium text-primary mt-2">
              小局·好能量
            </p>
            
            <p className="text-muted-foreground mt-4 leading-relaxed max-w-md mx-auto">
              在香港和深圳，AI帮你找到真正合拍的朋友。<br/>
              每一场4-6人小聚，都是精心策划的相遇。
            </p>
          </motion.div>
        </div>
      </section>

      {/* Section 2: Promo Video */}
      <section className="py-8 px-6" data-testid="section-promo-video">
        <div className="max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative rounded-2xl overflow-hidden shadow-xl bg-muted aspect-video"
          >
            {/* Video placeholder - replace src with actual video file when ready */}
            {/* To add your video: upload .mp4 file to attached_assets and import it */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <div className="h-16 w-16 rounded-full bg-primary/90 flex items-center justify-center mb-4 shadow-lg">
                <Play className="h-8 w-8 text-primary-foreground ml-1" />
              </div>
              <p className="text-muted-foreground text-sm">宣传视频即将上线</p>
              <p className="text-muted-foreground/60 text-xs mt-1">30秒精彩预览</p>
            </div>
            
            {/* Uncomment below when video is ready:
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted={isVideoMuted}
              playsInline
              poster="/video-poster.jpg"
            >
              <source src={promoVideo} type="video/mp4" />
              您的浏览器不支持视频播放
            </video>
            
            <Button
              size="icon"
              variant="secondary"
              className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70"
              onClick={() => setIsVideoMuted(!isVideoMuted)}
              data-testid="button-video-mute"
            >
              {isVideoMuted ? (
                <VolumeX className="h-4 w-4 text-white" />
              ) : (
                <Volume2 className="h-4 w-4 text-white" />
              )}
            </Button>
            */}
          </motion.div>
        </div>
      </section>

      {/* Section 3: Promotion Banner Carousel */}
      <PromotionBannerCarousel 
        placement="landing" 
        className="px-4"
      />

      {/* Section 4: Features */}
      <section className="py-12 px-6" data-testid="section-features">
        <div className="max-w-lg mx-auto space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-6"
          >
            <Badge variant="secondary" className="mb-3">核心特色</Badge>
            <h2 className="text-xl font-bold">为什么选择悦聚</h2>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full hover-elevate transition-all">
                  <CardContent className="p-4 text-center">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-white mx-auto mb-3`}>
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feature.subtitle}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Social Proof Stats */}
      <section className="py-10 px-6 bg-muted/30" data-testid="section-stats">
        <div className="max-w-lg mx-auto">
          <div className="grid grid-cols-4 gap-3">
            {displayStats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-xl sm:text-2xl font-bold text-primary" data-testid={`stat-${i}`}>
                  {stat.value}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: Login Form */}
      <section className="py-12 px-6" data-testid="section-login">
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

                {/* Phone Number Login */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium">手机号</Label>
                    <div className="flex gap-2">
                      <Select value={areaCode} onValueChange={setAreaCode}>
                        <SelectTrigger className="w-[110px] h-11" data-testid="select-area-code">
                          <SelectValue>
                            {AREA_CODES.find(a => a.code === areaCode)?.flag} {areaCode}
                          </SelectValue>
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

                  <div className="space-y-2">
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
                  </div>

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
      <section className="py-12 px-6" data-testid="section-faq">
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
