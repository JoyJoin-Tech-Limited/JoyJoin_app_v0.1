import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Sparkles, Users, Zap, Heart, Play, Shield, 
  Star, ChevronRight, Quote, Clock, MapPin,
  CheckCircle2, ArrowRight, Flower2, Target, Sun, TrendingUp
} from "lucide-react";
import { motion } from "framer-motion";
import type { PromotionBanner } from "@shared/schema";

interface EventPool {
  id: string;
  city: string;
  registrationCount: number;
}

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

const STATS = [
  { value: "2000+", label: "活跃用户", icon: Users },
  { value: "500+", label: "成功活动", icon: Sparkles },
  { value: "95%", label: "好评率", icon: Star },
  { value: "4.8", label: "平均评分", icon: Heart },
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
  {
    question: "目前在哪些城市有活动？",
    answer: "目前我们主要服务深圳和香港两地，重点区域包括南山、福田、中环、尖沙咀等热门商圈。更多城市正在筹备中！",
  },
];

const ACTIVITY_PHOTOS = [
  "https://images.unsplash.com/photo-1529543544277-750e8928e35d?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=400&h=300&fit=crop",
];

export default function LandingPage() {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const { data: heroBanners } = useQuery<PromotionBanner[]>({
    queryKey: ["/api/banners", { placement: "landing" }],
    queryFn: async () => {
      const response = await fetch("/api/banners?placement=landing");
      if (!response.ok) return [];
      return response.json();
    },
  });

  const { data: eventPools = [] } = useQuery<EventPool[]>({
    queryKey: ["/api/event-pools"],
  });

  const totalRegistrations = useMemo(() => {
    return eventPools.reduce((sum, pool) => sum + (pool.registrationCount || 0), 0);
  }, [eventPools]);

  const heroImage = heroBanners?.[0]?.imageUrl || 
    "https://images.unsplash.com/photo-1529543544277-750e8928e35d?w=1200&h=800&fit=crop";

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Section 1: Hero - 全屏活动实拍背景 */}
      <section 
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        data-testid="section-hero"
      >
        {/* 背景图片 */}
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="活动精彩瞬间"
            className="w-full h-full object-cover"
          />
          {/* 暗色渐变遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        {/* Hero 内容 */}
        <div className="relative z-10 text-center text-white px-6 max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>
            
            <h1 className="text-5xl sm:text-6xl font-display font-bold tracking-tight" data-testid="text-brand-name">
              悦聚·Joy
            </h1>
            <p className="text-xl sm:text-2xl font-light opacity-90">
              小局·好能量
            </p>
            <p className="text-lg sm:text-xl font-medium opacity-95 mt-2" data-testid="text-subtitle">
              AI精选4-6人局，告别尬聊
            </p>
            <p className="text-base sm:text-lg opacity-80 max-w-md mx-auto leading-relaxed">
              在香港和深圳，AI帮你找到真正合拍的朋友。<br/>
              每一场微型聚会，都是精心策划的相遇。
            </p>
            
            {totalRegistrations > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center justify-center gap-2 text-sm bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 mx-auto w-fit"
                data-testid="text-registration-count"
              >
                <TrendingUp className="h-4 w-4" />
                <span>本周已有 <strong className="text-white">{totalRegistrations}</strong> 人报名活动</span>
              </motion.div>
            )}

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                className="text-lg px-8 py-6 bg-white text-primary hover:bg-white/90"
                onClick={handleLogin}
                data-testid="button-hero-login"
              >
                立即加入
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2 text-sm opacity-80">
                <Shield className="h-4 w-4" />
                <span>用户隐私安全保障</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 向下滚动提示 */}
        <motion.div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <ChevronRight className="h-8 w-8 text-white/60 rotate-90" />
        </motion.div>
      </section>

      {/* Section 2: 创始人故事区 */}
      <section className="py-16 px-6 bg-muted/30" data-testid="section-founder">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-4">品牌故事</Badge>
            <h2 className="text-3xl font-bold mb-4">为什么创建悦聚？</h2>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {/* 视频占位区 */}
              <div 
                className="relative aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center cursor-pointer group"
                onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                data-testid="video-founder"
              >
                {!isVideoPlaying ? (
                  <>
                    <img
                      src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=450&fit=crop"
                      alt="创始人故事"
                      className="absolute inset-0 w-full h-full object-cover opacity-60"
                    />
                    <div className="relative z-10 flex flex-col items-center gap-4">
                      <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                        <Play className="h-8 w-8 text-primary ml-1" />
                      </div>
                      <span className="text-white font-medium text-lg">观看创始人视频</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <p>视频内容将由Admin上传后显示</p>
                  </div>
                )}
              </div>

              {/* 文字介绍 */}
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Quote className="h-8 w-8 text-primary/30 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-muted-foreground leading-relaxed">
                      "三年前搬来深圳，虽然工作顺利，但总觉得缺少真正懂我的朋友。参加过很多社交活动，人太多太杂，聊不到一块去。我想，一定有很多人和我有同样的困扰——<span className="text-foreground font-medium">不是不想社交，而是找不到合适的人。</span>"
                    </p>
                    <p className="text-muted-foreground leading-relaxed mt-4">
                      "所以我创建了悦聚，用AI的力量帮每个人找到真正聊得来的朋友。小悦不只是匹配兴趣，更是匹配性格、能量和社交风格。在这里，每一场聚会都是精心策划的相遇。"
                    </p>
                    <div className="mt-4 text-sm text-muted-foreground">
                      —— 悦聚创始人
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 品牌理念 */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[
              { icon: Users, title: "小而美", desc: "5-10人精致小局" },
              { icon: Zap, title: "AI驱动", desc: "性格匹配算法" },
              { icon: Heart, title: "真连接", desc: "建立真实友谊" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="font-medium text-sm">{item.title}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: 社会证明区 - 数据 + 用户评价 */}
      <section className="py-16 px-6" data-testid="section-social-proof">
        <div className="max-w-3xl mx-auto">
          {/* 数据展示 */}
          <div className="grid grid-cols-4 gap-4 mb-12">
            {STATS.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="text-2xl sm:text-3xl font-bold text-primary" data-testid={`stat-${i}`}>
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* 用户评价 */}
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4">用户心声</Badge>
            <h2 className="text-2xl font-bold">他们在悦聚找到了</h2>
          </div>

          <div className="space-y-4">
            {TESTIMONIALS.map((testimonial, i) => (
              <motion.div
                key={testimonial.id}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Card data-testid={`testimonial-${testimonial.id}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <testimonial.AvatarIcon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">{testimonial.name}</span>
                          <span className="text-sm text-muted-foreground">{testimonial.age}岁</span>
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            {testimonial.city}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">{testimonial.archetype}</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          "{testimonial.quote}"
                        </p>
                        <div className="flex items-center gap-0.5 mt-2">
                          {Array.from({ length: testimonial.rating }).map((_, j) => (
                            <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
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

      {/* Section 4: 活动精选区 - 照片墙 */}
      <section className="py-16 px-6 bg-muted/30" data-testid="section-gallery">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-4">精彩瞬间</Badge>
            <h2 className="text-2xl font-bold mb-2">记录每一次相遇</h2>
            <p className="text-muted-foreground">悦聚活动现场的真实瞬间</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ACTIVITY_PHOTOS.map((photo, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                viewport={{ once: true }}
                className="aspect-[4/3] rounded-xl overflow-hidden"
                data-testid={`gallery-photo-${i}`}
              >
                <img
                  src={photo}
                  alt={`活动照片 ${i + 1}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button variant="outline" onClick={handleLogin} data-testid="button-gallery-cta">
              加入我们，创造你的故事
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Section 5: FAQ区 */}
      <section className="py-16 px-6" data-testid="section-faq">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-4">常见问题</Badge>
            <h2 className="text-2xl font-bold mb-2">你可能想知道</h2>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem 
                key={i} 
                value={`item-${i}`}
                className="border rounded-lg px-4 data-[state=open]:bg-muted/50"
                data-testid={`faq-item-${i}`}
              >
                <AccordionTrigger className="text-left hover:no-underline py-4">
                  <span className="font-medium">{item.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-4">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Section 6: 底部CTA区 */}
      <section className="py-20 px-6 bg-gradient-to-b from-primary/10 to-primary/5" data-testid="section-cta">
        <div className="max-w-2xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <h2 className="text-3xl font-bold">
              准备好遇见有趣的灵魂了吗？
            </h2>
            <p className="text-muted-foreground">
              加入2000+小伙伴，开启你的高质量社交之旅
            </p>

            <div className="flex flex-col items-center gap-4 pt-4">
              <Button 
                size="lg" 
                className="text-lg px-10 py-6"
                onClick={handleLogin}
                data-testid="button-footer-login"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                立即开始
              </Button>
              
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>免费注册</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>隐私保护</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>随时退出</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t bg-background">
        <div className="max-w-2xl mx-auto text-center text-sm text-muted-foreground">
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
