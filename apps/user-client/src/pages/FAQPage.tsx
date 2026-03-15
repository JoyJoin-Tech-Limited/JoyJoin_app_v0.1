import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  HelpCircle,
  RefreshCcw,
  MapPin,
  ListOrdered,
  ShieldCheck,
  Box,
  UserCheck,
} from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import WechatServiceQRCard from "@/components/WechatServiceQRCard";

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

interface FAQItem {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    id: "faq-refund",
    icon: RefreshCcw,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    question: "活动取消与退款政策",
    answer:
      "活动开始前 48 小时以上取消，可全额退款。活动前 24 至 48 小时取消，退款 50%。活动当天取消或未出席，不予退款。如悦聚方取消活动，将全额退款并额外赠送悦币补偿。",
  },
  {
    id: "faq-matching",
    icon: UserCheck,
    iconColor: "text-purple-500",
    iconBg: "bg-purple-500/10",
    question: "匹配逻辑是什么？",
    answer:
      "悦聚采用 7 维度兼容性算法，综合考量性格类型、兴趣标签、语言偏好、生活方式、价值观取向、年龄区间以及活动参与历史。每场活动将把高兼容度的参与者安排在同一桌，最大化破冰的自然感。",
  },
  {
    id: "faq-venue",
    icon: MapPin,
    iconColor: "text-green-500",
    iconBg: "bg-green-500/10",
    question: "活动地点是哪里？",
    answer:
      "悦聚与城内精选合作餐厅及酒吧合作举办活动，场地以环境舒适、私密性佳为首要条件。具体地点将在活动开始前 24 小时通过 App 推送及微信通知公布，请保持通知开启。",
  },
  {
    id: "faq-flow",
    icon: ListOrdered,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    question: "活动流程是什么？",
    answer:
      "① 各自独立到达场地（避免尴尬的同行等待）\n② 工作人员引导入座，开始破冰游戏环节\n③ 共进晚餐或享用饮品，轻松自然地交流\n④ 活动结束后，可选择加入当晚的 After Party\n⑤ 次日通过 App 查看互选结果，建立连接",
  },
  {
    id: "faq-privacy",
    icon: ShieldCheck,
    iconColor: "text-rose-500",
    iconBg: "bg-rose-500/10",
    question: "如何保护个人隐私？",
    answer:
      "活动全程使用昵称，不公开真实姓名。手机号码全程隐藏，沟通通过 App 内互动进行。头像照片为可选项，您可以选择不上传。个人资料仅用于匹配算法，不对其他用户直接展示。",
  },
  {
    id: "faq-blindbox",
    icon: Box,
    iconColor: "text-yellow-500",
    iconBg: "bg-yellow-500/10",
    question: "什么是盲盒社交？",
    answer:
      "盲盒社交的核心理念是：你在活动前不知道自己会遇见谁。就像打开一个惊喜盲盒，这种不确定性能有效降低「被评判」的社交焦虑，让大家以更真实、更放松的状态展现自己。研究表明，这种方式更容易建立真实且持久的连接。",
  },
];

// ---------------------------------------------------------------------------
// Stagger animation variants
// ---------------------------------------------------------------------------

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: "easeOut" },
  },
};

// ---------------------------------------------------------------------------
// Sub-component: single accordion item
// ---------------------------------------------------------------------------

interface FAQAccordionItemProps {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQAccordionItem({ item, isOpen, onToggle }: FAQAccordionItemProps) {
  const Icon = item.icon;

  return (
    <motion.div variants={itemVariants}>
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <div
          className={`glass rounded-2xl overflow-hidden transition-shadow ${
            isOpen ? "shadow-md" : ""
          }`}
          data-testid={`faq-item-${item.id}`}
        >
          {/* Trigger row */}
          <CollapsibleTrigger asChild>
            <button
              className="w-full flex items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(280_45%_55%)] rounded-2xl"
              aria-expanded={isOpen}
              data-testid={`faq-trigger-${item.id}`}
            >
              {/* Icon badge */}
              <div
                className={`h-9 w-9 rounded-xl ${item.iconBg} flex items-center justify-center flex-shrink-0`}
                aria-hidden="true"
              >
                <Icon className={`h-4.5 w-4.5 ${item.iconColor}`} />
              </div>

              {/* Question text */}
              <span className="flex-1 text-sm font-semibold leading-snug">
                {item.question}
              </span>

              {/* Animated chevron */}
              <motion.span
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="flex-shrink-0"
                aria-hidden="true"
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.span>
            </button>
          </CollapsibleTrigger>

          {/* Animated answer panel */}
          <CollapsibleContent>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  {/* Subtle divider */}
                  <div
                    className="mx-4 h-px bg-border/50"
                    aria-hidden="true"
                  />
                  <p className="px-4 py-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {item.answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FAQPage() {
  // Track which FAQ item is currently open (null = all closed)
  const [openItem, setOpenItem] = useState<string | null>(null);

  const handleToggle = (id: string) => {
    // Toggle: close if already open, open otherwise
    setOpenItem((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ── Header ── */}
      <MobileHeader title="常见问题" />

      <main className="px-4 pt-5 space-y-4">
        {/* ── Intro banner ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="glass rounded-2xl p-4 flex items-center gap-3"
          data-testid="faq-intro-banner"
        >
          <div className="h-10 w-10 rounded-xl bg-[hsl(280_45%_55%)]/10 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="h-5 w-5 text-[hsl(280_45%_55%)]" />
          </div>
          <div>
            <p className="text-sm font-semibold">有问题找悦聚</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              点击问题查看详细解答，如有其他疑问可在社群内提问
            </p>
          </div>
        </motion.div>

        {/* ── FAQ accordion list ── */}
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3"
          data-testid="faq-list"
        >
          {FAQ_ITEMS.map((item) => (
            <FAQAccordionItem
              key={item.id}
              item={item}
              isOpen={openItem === item.id}
              onToggle={() => handleToggle(item.id)}
            />
          ))}
        </motion.div>

        {/* ── Still have questions — WeChat 智能客服 QR ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          data-testid="section-contact-prompt"
        >
          <WechatServiceQRCard variant="inline" />
        </motion.div>

        <div className="h-2" />
      </main>

      <BottomNav />
    </div>
  );
}
