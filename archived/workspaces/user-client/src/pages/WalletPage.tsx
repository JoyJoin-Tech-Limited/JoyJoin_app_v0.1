import { motion } from "framer-motion";
import {
  Wallet,
  Ticket,
  Star,
  Users,
  Gift,
  Award,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CouponStatus = "可使用" | "已使用" | "已过期";
type CouponVariant = "discount" | "free" | "vip" | "coins" | "badge";

interface Coupon {
  id: string;
  type: CouponVariant;
  title: string;
  description: string;
  expiry: string | null; // null means no expiry
  status: CouponStatus;
  value?: string; // e.g. "9折" or "50悦币"
}

// ---------------------------------------------------------------------------
// Static coupon data (placeholder)
// ---------------------------------------------------------------------------

const COUPONS: Coupon[] = [
  {
    id: "c1",
    type: "discount",
    title: "9折优惠券",
    description: "下次活动报名享9折优惠",
    expiry: "30天后到期",
    status: "可使用",
    value: "9折",
  },
  {
    id: "c2",
    type: "free",
    title: "免费活动体验券",
    description: "可免费参加任意一场悦聚活动",
    expiry: "60天后到期",
    status: "可使用",
    value: "免费",
  },
  {
    id: "c3",
    type: "vip",
    title: "优先配对特权",
    description: "下场活动享受 VIP 优先匹配资格",
    expiry: "15天后到期",
    status: "可使用",
    value: "VIP",
  },
  {
    id: "c4",
    type: "coins",
    title: "好友邀请奖励",
    description: "成功邀请好友参加活动所得奖励",
    expiry: null,
    status: "可使用",
    value: "50悦币",
  },
  {
    id: "c5",
    type: "badge",
    title: "首次参加纪念章",
    description: "恭喜完成人生中第一场悦聚活动！",
    expiry: null,
    status: "已使用",
    value: "纪念",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map coupon variant → icon component, gradient, accent colour */
function getCouponStyle(type: CouponVariant) {
  const styles: Record<
    CouponVariant,
    { Icon: React.ElementType; gradient: string; accent: string }
  > = {
    discount: {
      Icon: Ticket,
      gradient: "from-purple-500/20 to-pink-500/20",
      accent: "text-purple-500",
    },
    free: {
      Icon: Sparkles,
      gradient: "from-green-500/20 to-teal-500/20",
      accent: "text-green-500",
    },
    vip: {
      Icon: Star,
      gradient: "from-yellow-500/20 to-orange-500/20",
      accent: "text-yellow-500",
    },
    coins: {
      Icon: Gift,
      gradient: "from-blue-500/20 to-cyan-500/20",
      accent: "text-blue-500",
    },
    badge: {
      Icon: Award,
      gradient: "from-rose-500/20 to-pink-500/20",
      accent: "text-rose-500",
    },
  };
  return styles[type];
}

/** Badge colour per status */
function getStatusStyle(status: CouponStatus): string {
  switch (status) {
    case "可使用":
      return "bg-green-500/10 text-green-600 border-green-500/20";
    case "已使用":
      return "bg-muted/60 text-muted-foreground border-border";
    case "已过期":
      return "bg-red-500/10 text-red-500 border-red-500/20";
  }
}

// ---------------------------------------------------------------------------
// Stagger animation variants
// ---------------------------------------------------------------------------

const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.3 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CouponCard({ coupon }: { coupon: Coupon }) {
  const { Icon, gradient, accent } = getCouponStyle(coupon.type);
  const isUsed = coupon.status !== "可使用";

  return (
    <motion.div
      variants={cardVariants}
      className={`glass rounded-2xl overflow-hidden transition-opacity ${
        isUsed ? "opacity-50" : ""
      }`}
      data-testid={`coupon-card-${coupon.id}`}
    >
      {/* Dashed tear-off divider effect via a subtle top stripe */}
      <div
        className={`h-1.5 w-full bg-gradient-to-r ${gradient} opacity-80`}
        aria-hidden="true"
      />

      <div className="p-4 flex items-start gap-4">
        {/* Icon badge */}
        <div
          className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0`}
          aria-hidden="true"
        >
          <Icon className={`h-6 w-6 ${accent}`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{coupon.title}</span>
            {/* Value pill (e.g. "9折") */}
            {coupon.value && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r ${gradient} ${accent}`}
              >
                {coupon.value}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {coupon.description}
          </p>

          {/* Expiry row */}
          {coupon.expiry && (
            <div className="flex items-center gap-1 mt-1.5">
              <Clock className="h-3 w-3 text-muted-foreground/70" />
              <span className="text-xs text-muted-foreground/70">
                {coupon.expiry}
              </span>
            </div>
          )}
        </div>

        {/* Status badge — right-aligned */}
        <Badge
          variant="outline"
          className={`text-xs flex-shrink-0 self-start mt-0.5 ${getStatusStyle(
            coupon.status
          )}`}
        >
          {coupon.status === "可使用" ? (
            <CheckCircle2 className="h-3 w-3 mr-1" />
          ) : null}
          {coupon.status}
        </Badge>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WalletPage() {
  const availableCount = COUPONS.filter((c) => c.status === "可使用").length;

  return (
    <div className="min-h-[100dvh] bg-background pb-20">
      {/* ── Header ── */}
      <MobileHeader title="专属福利柜" />

      <main className="px-4 pt-5 space-y-5">
        {/* ── Hero summary card ── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          data-testid="wallet-hero"
        >
          <div className="rounded-3xl bg-gradient-to-br from-[hsl(280_45%_55%)] to-pink-500 p-6 text-white shadow-lg relative overflow-hidden">
            {/* Decorative blurred circle */}
            <div
              className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/10 blur-2xl"
              aria-hidden="true"
            />
            <div
              className="absolute bottom-0 left-4 h-16 w-16 rounded-full bg-white/10 blur-xl"
              aria-hidden="true"
            />

            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80 font-medium">可用福利</p>
                <p
                  className="text-4xl font-extrabold mt-1 tracking-tight"
                  data-testid="text-coupon-count"
                >
                  {availableCount}
                  <span className="text-xl font-semibold ml-1 opacity-90">
                    张可用
                  </span>
                </p>
                <p className="text-xs opacity-70 mt-1">
                  悦聚社交宝库 · 专属权益福利
                </p>
              </div>
              <Wallet className="h-14 w-14 opacity-25" aria-hidden="true" />
            </div>

            {/* Stat pills */}
            <div className="relative z-10 flex gap-3 mt-4">
              {[
                { label: "总计", value: `${COUPONS.length}张` },
                {
                  label: "已使用",
                  value: `${COUPONS.filter((c) => c.status === "已使用").length}张`,
                },
                { label: "即将到期", value: "1张" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex-1 bg-white/15 rounded-xl py-2 px-2 text-center"
                >
                  <p className="text-xs opacity-70">{stat.label}</p>
                  <p className="text-sm font-bold">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Section header ── */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex items-center justify-between"
        >
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-[hsl(280_45%_55%)]" />
            我的福利卡包
          </h2>
          <span className="text-xs text-muted-foreground">
            共 {COUPONS.length} 张
          </span>
        </motion.div>

        {/* ── Coupon list ── */}
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3"
          data-testid="coupon-list"
        >
          {COUPONS.map((coupon) => (
            <CouponCard key={coupon.id} coupon={coupon} />
          ))}
        </motion.div>

        {/* ── How to earn more ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.45 }}
          className="glass rounded-2xl p-4"
          data-testid="section-earn-more"
        >
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Gift className="h-4 w-4 text-[hsl(280_45%_55%)]" />
            如何获得更多福利？
          </h3>
          <ul className="space-y-2">
            {[
              "完成活动签到，获得悦币奖励",
              "邀请好友参加活动，双方各得奖励",
              "连续参加活动，解锁连胜加成",
              "填写活动反馈问卷，获得额外悦币",
            ].map((tip) => (
              <li key={tip} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                {tip}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Bottom breathing room */}
        <div className="h-2" />
      </main>

      <BottomNav />
    </div>
  );
}
