import { Drawer } from "vaul";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Sparkles, ChevronDown, Users, HelpCircle, DollarSign } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getCurrencySymbol } from "@/lib/currency";

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
            {/* 标题 */}
            <div className="mb-6">
              <Drawer.Title className="text-xl font-bold mb-2" data-testid="text-sheet-title">
                什么是盲盒模式？
              </Drawer.Title>
              <p className="text-sm text-muted-foreground">
                详情在成局后解锁
              </p>
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

            {/* 2. 盲盒怎么玩 */}
            <div className="mb-6">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                盲盒怎么玩
              </h3>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    1
                  </div>
                  <div>
                    <p className="text-sm font-medium">先报名，再揭晓</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      选择时间与类型，提交后进入匹配
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    2
                  </div>
                  <div>
                    <p className="text-sm font-medium">智能配对</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      按兴趣、距离与人数自动成局
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    3
                  </div>
                  <div>
                    <p className="text-sm font-medium">成局即通知</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      解锁活动名称、具体地点与群聊
                    </p>
                  </div>
                </div>
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
