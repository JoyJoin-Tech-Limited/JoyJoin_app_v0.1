import { Drawer } from "vaul";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Sparkles, ChevronDown, Users, HelpCircle, DollarSign, Send, Clock, Bell, PartyPopper } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getCurrencySymbol } from "@/lib/currency";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import xiaoyueAvatar from "@assets/generated_images/final_fox_with_collar_sunglasses.png";

interface BlindBoxInfoSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventData: {
    date: string;
    time: string;
    eventType: "饭局" | "酒局";
    area: string;
    priceTier?: string;
    isAA?: boolean;
    city?: "香港" | "深圳";
  };
}

export default function BlindBoxInfoSheet({ 
  open, 
  onOpenChange, 
  eventData 
}: BlindBoxInfoSheetProps) {
  const [faqOpen, setFaqOpen] = useState<{ [key: string]: boolean }>({});

  const toggleFaq = (index: string) => {
    setFaqOpen(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const faqs = [
    {
      q: "我能带朋友吗？",
      a: "可在报名后添加 1–2 位同行，统一匹配。"
    },
    {
      q: "临时有事？",
      a: "成局后按活动退改规则处理。"
    },
    {
      q: "匹配多久？",
      a: "通常 2–6 小时，繁忙时段更快。"
    }
  ];

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Drawer.Content 
          className="bg-background flex flex-col rounded-t-[10px] h-[70vh] mt-24 fixed bottom-0 left-0 right-0 z-50 outline-none"
          data-testid="drawer-blindbox-info"
        >
          {/* 拖拽指示器 */}
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-4 mb-4" />
          
          {/* 可滚动内容 */}
          <div className="overflow-y-auto flex-1 px-4 pb-6">
            {/* 小悦介绍区 - 优化后的布局 */}
            <div className="mb-6 relative">
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <Avatar className="h-14 w-14 border-2 border-primary/30 shadow-lg">
                    <AvatarImage src={xiaoyueAvatar} alt="小悦" />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                      小悦
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
                    <span className="text-[10px] text-white">AI</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Drawer.Title className="text-lg font-bold" data-testid="text-sheet-title">
                      小悦
                    </Drawer.Title>
                    <Badge className="text-xs bg-gradient-to-r from-primary to-primary/80">
                      悦聚助手
                    </Badge>
                  </div>
                  <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl rounded-tl-none p-3 border border-primary/10">
                    <p className="text-sm leading-relaxed">
                      嗨～我是小悦！让我来告诉你<span className="font-semibold text-primary">盲盒模式</span>是怎么玩的吧～
                    </p>
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      详情在成局后解锁哦
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 1. 顶部摘要条 */}
            <div className="mb-6 p-4 bg-muted/50 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">{eventData.date} {eventData.time}</span>
                <Badge variant="secondary" className="text-xs">
                  {eventData.eventType}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{eventData.area}</span>
              </div>
              {(eventData.priceTier || eventData.isAA) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>
                    {eventData.priceTier && `${getCurrencySymbol(eventData.city || "深圳")}${eventData.priceTier}`}
                    {eventData.isAA && ` · AA制`}
                  </span>
                </div>
              )}
            </div>

            {/* 2. 盲盒怎么玩 - 4步流程卡片式布局 */}
            <div className="mb-6">
              <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                盲盒怎么玩
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {/* 步骤1 */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border border-blue-200/50 dark:border-blue-800/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                      <Send className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">STEP 1</span>
                  </div>
                  <p className="text-sm font-semibold mb-1">报名参加</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    选择时间、片区，提交报名
                  </p>
                </div>
                
                {/* 步骤2 */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border border-purple-200/50 dark:border-purple-800/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400">STEP 2</span>
                  </div>
                  <p className="text-sm font-semibold mb-1">等待匹配</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    AI按兴趣智能配对中
                  </p>
                </div>
                
                {/* 步骤3 */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20 border border-orange-200/50 dark:border-orange-800/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center">
                      <Bell className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">STEP 3</span>
                  </div>
                  <p className="text-sm font-semibold mb-1">成局通知</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    解锁地点、加入群聊
                  </p>
                </div>
                
                {/* 步骤4 */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border border-green-200/50 dark:border-green-800/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center">
                      <PartyPopper className="h-3.5 w-3.5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-green-600 dark:text-green-400">STEP 4</span>
                  </div>
                  <p className="text-sm font-semibold mb-1">开启派对</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    见面、社交、享受！
                  </p>
                </div>
              </div>
              
              {/* 为什么是盲盒提示 */}
              <div className="mt-3 p-2.5 rounded-lg bg-muted/50 border border-dashed">
                <p className="text-xs text-muted-foreground text-center">
                  <HelpCircle className="h-3 w-3 inline mr-1" />
                  为什么是"盲盒"？成局前地点保密，增加惊喜感～
                </p>
              </div>
            </div>

            {/* 3. 成局与退款 */}
            <div className="mb-6">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                成局与退款
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <p><span className="font-medium">成局条件：</span>满足最低4人即成局，6人封顶</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <p><span className="font-medium">未成局：</span>自动取消并原路退款</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <p><span className="font-medium">超时保护：</span>活动前48小时未成局，系统自动退款</p>
                </div>
              </div>
            </div>

            {/* 4. 常见问题 */}
            <div className="mb-6">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                常见问题
              </h3>
              <div className="space-y-2">
                {faqs.map((faq, index) => (
                  <Collapsible
                    key={index}
                    open={faqOpen[index.toString()]}
                    onOpenChange={() => toggleFaq(index.toString())}
                  >
                    <CollapsibleTrigger 
                      className="flex items-center justify-between w-full text-left p-3 rounded-md hover-elevate active-elevate-2 border"
                      data-testid={`button-faq-${index}`}
                    >
                      <span className="text-sm font-medium">{faq.q}</span>
                      <ChevronDown 
                        className={`h-4 w-4 transition-transform ${
                          faqOpen[index.toString()] ? 'transform rotate-180' : ''
                        }`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pt-2 pb-3">
                      <p className="text-sm text-muted-foreground">{faq.a}</p>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
