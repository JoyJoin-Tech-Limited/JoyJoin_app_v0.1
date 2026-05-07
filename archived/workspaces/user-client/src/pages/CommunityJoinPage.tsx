import { useState } from "react";
import { motion } from "framer-motion";
import {
  QrCode,
  ArrowLeft,
  Users,
  Bell,
  Star,
  MessageCircle,
  Gift,
  CheckCircle2,
} from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import WechatServiceQRCard from "@/components/WechatServiceQRCard";

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

/** Stagger container: each child fades + rises in sequence */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.25 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const communityBenefits = [
  {
    icon: Bell,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    title: "活动优先通知",
    desc: "每次新活动上线第一时间收到消息，抢先报名不错过",
  },
  {
    icon: Star,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    title: "专属折扣福利",
    desc: "社群成员享受独家报名优惠，最高享 9 折特权",
  },
  {
    icon: Users,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    title: "活动精彩回顾",
    desc: "活动精彩瞬间、成功配对故事，第一时间在群内分享",
  },
  {
    icon: MessageCircle,
    color: "text-green-500",
    bg: "bg-green-500/10",
    title: "互动答疑解惑",
    desc: "有任何问题随时在群内提问，运营团队实时解答",
  },
  {
    icon: Gift,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    title: "神秘彩蛋活动",
    desc: "不定期群内抽奖、限定徽章赠送，仅群内成员可参与",
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function CommunityJoinPage() {
  const [serviceAdded, setServiceAdded] = useState(false);
  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      {/* ── Header ── */}
      <MobileHeader
        title="加入社群"
        action={
          // Back button placed on the left via the `action` slot
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            aria-label="返回"
            data-testid="button-back"
            className="mr-auto -ml-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />

      <main className="px-4 pt-6 space-y-6">
        {/* ── Hero heading ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="text-center space-y-2"
        >
          <h2 className="text-2xl font-bold tracking-tight">
            扫码加入悦聚社群
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            这里是所有参与过悦聚活动的小伙伴的大家庭，
            <br />
            加入即享专属福利与活动优先通知 🎉
          </p>
        </motion.div>

        {/* ── QR code card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, delay: 0.15, ease: "easeOut" }}
          className="flex justify-center"
          data-testid="section-qr-code"
        >
          <div className="glass rounded-3xl p-6 w-full max-w-xs flex flex-col items-center gap-5 shadow-lg">
            {/* WeChat brand pill */}
            <div className="flex items-center gap-2 bg-[#07C160]/10 rounded-full px-4 py-1.5">
              {/* Inline WeChat-style icon — lucide-react has no WeChat icon */}
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-[#07C160]"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M8.5 2C4.36 2 1 5.13 1 9c0 2.05.9 3.89 2.33 5.18L2.5 17l3.08-1.54A8.2 8.2 0 0 0 8.5 16c4.14 0 7.5-3.13 7.5-7S12.64 2 8.5 2ZM21 11c0-3.31-2.97-6-6.63-6-.2 0-.4.01-.6.03C14.55 7.82 16 10.26 16 13a8.8 8.8 0 0 1-.44 2.76C15.7 15.92 16 16 16.37 16l2.63 1.32-.7-2.56C19.4 13.7 21 12.43 21 11Z" />
              </svg>
              <span className="text-sm font-semibold text-[#07C160]">
                微信扫码加群
              </span>
            </div>

            {/* QR code placeholder */}
            <div
              className="w-52 h-52 rounded-2xl bg-muted/60 border-2 border-dashed border-border flex flex-col items-center justify-center gap-3"
              data-testid="qr-code-placeholder"
              aria-label="二维码占位区域"
            >
              <QrCode className="h-24 w-24 text-muted-foreground/40" />
              <span className="text-xs text-muted-foreground/60 text-center px-4">
                二维码加载中…
              </span>
            </div>

            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              长按或截图保存，打开微信扫一扫即可加入
            </p>
          </div>
        </motion.div>

        {/* ── Benefits section ── */}
        <div>
          <motion.h3
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="text-base font-semibold mb-3"
          >
            加入社群有什么好处？
          </motion.h3>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
            data-testid="section-benefits"
          >
            {communityBenefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={benefit.title}
                  variants={itemVariants}
                  className="glass rounded-2xl p-4 flex items-start gap-4"
                  data-testid={`benefit-card-${benefit.title}`}
                >
                  {/* Icon badge */}
                  <div
                    className={`h-10 w-10 rounded-xl ${benefit.bg} flex items-center justify-center flex-shrink-0`}
                    aria-hidden="true"
                  >
                    <Icon className={`h-5 w-5 ${benefit.color}`} />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{benefit.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {benefit.desc}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* ── 智能客服 QR ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.4 }}
          data-testid="section-customer-service"
        >
          <h3 className="text-base font-semibold mb-3">联系智能客服</h3>
          <WechatServiceQRCard variant="full" />

          {/* CTA */}
          {!serviceAdded ? (
            <Button
              className="w-full mt-3 bg-[#07C160] hover:bg-[#06AD56] text-white border-0"
              onClick={() => setServiceAdded(true)}
              data-testid="button-service-added"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              已添加客服 ✓
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-3 flex items-center justify-center gap-2 text-[#07C160] text-sm font-medium"
              data-testid="service-added-confirmation"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span style={{ fontFamily: 'var(--font-cn-display)' }}>
                已添加！有问题随时找我们 💬
              </span>
            </motion.div>
          )}
        </motion.div>

        {/* ── Footer disclaimer ── */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="text-center text-xs text-muted-foreground pb-4"
        >
          社群仅面向悦聚注册用户开放，请勿对外转发二维码
        </motion.p>
      </main>

      <BottomNav />
    </div>
  );
}
