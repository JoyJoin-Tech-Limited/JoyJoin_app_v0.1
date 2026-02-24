import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  FileText,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Lock,
  Calendar,
  Scale,
  Mail,
} from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";

// ---------------------------------------------------------------------------
// Types & data
// ---------------------------------------------------------------------------

interface TermsSection {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  heading: string;
  paragraphs: string[];
}

const TERMS_SECTIONS: TermsSection[] = [
  {
    id: "ts-service",
    icon: FileText,
    iconColor: "text-purple-500",
    iconBg: "bg-purple-500/10",
    heading: "一、服务说明",
    paragraphs: [
      "悦聚（JoyJoin）是一个面向都市青年的社交活动平台，致力于通过精心设计的线下活动帮助用户结识志趣相投的新朋友。",
      "平台提供活动报名、智能配对、破冰工具及活动回顾等服务，旨在以轻松自然的方式促进真实的人际连接。",
    ],
  },
  {
    id: "ts-eligibility",
    icon: UserCheck,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
    heading: "二、用户资格",
    paragraphs: [
      "使用悦聚服务须年满 18 周岁，未成年人不得注册或参与活动。",
      "用户须使用真实身份注册，不得冒用他人信息。平台保留对注册信息进行核实的权利，如发现虚假信息将立即停止服务并取消活动资格。",
    ],
  },
  {
    id: "ts-conduct",
    icon: ShieldCheck,
    iconColor: "text-green-500",
    iconBg: "bg-green-500/10",
    heading: "三、用户行为准则",
    paragraphs: [
      "参与者须以尊重、友善的态度对待所有活动成员，严禁任何形式的骚扰、歧视或不当行为。",
      "如遭受不当对待，请立即通过 App 内举报功能或联系客服，悦聚将认真对待每一条举报并依据情节予以处理，情节严重者将永久封禁账号。",
    ],
  },
  {
    id: "ts-privacy",
    icon: Lock,
    iconColor: "text-rose-500",
    iconBg: "bg-rose-500/10",
    heading: "四、隐私保护",
    paragraphs: [
      "悦聚收集的个人信息（包括性格标签、兴趣偏好等）仅用于活动配对算法，不会出售或共享给第三方商业机构。",
      "活动中使用昵称，手机号码全程加密保护。您可随时在账户设置中申请删除个人数据。",
    ],
  },
  {
    id: "ts-events",
    icon: Calendar,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
    heading: "五、活动参与规则",
    paragraphs: [
      "报名时须如实填写个人信息，虚假信息将影响匹配质量，情节严重者将限制未来报名资格。",
      "无故缺席活动（未提前取消）将影响个人匹配优先级评分。频繁缺席者，平台有权暂停其报名功能。退款政策详见「常见问题」页面。",
    ],
  },
  {
    id: "ts-disclaimer",
    icon: Scale,
    iconColor: "text-yellow-500",
    iconBg: "bg-yellow-500/10",
    heading: "六、免责声明",
    paragraphs: [
      "悦聚平台的职责是为用户创造高质量的相遇机会，活动结束后双方形成的任何关系（友谊、恋爱或其他）均属个人私事，平台不承担任何连带责任。",
      "平台不对活动中因个人行为引发的纠纷负责。如需法律援助，请通过正规法律途径解决。",
    ],
  },
  {
    id: "ts-contact",
    icon: Mail,
    iconColor: "text-cyan-500",
    iconBg: "bg-cyan-500/10",
    heading: "七、联系我们",
    paragraphs: [
      "如您对以上条款有任何疑问，或需要行使数据权利（查阅、更正、删除），欢迎通过以下方式联系我们：",
      "📧 邮箱：hello@joyjoin.cn\n我们将在 3 个工作日内回复您的邮件。",
    ],
  },
];

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.2 },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: "easeOut" },
  },
};

// ---------------------------------------------------------------------------
// Sub-component: single terms section card
// ---------------------------------------------------------------------------

function TermsSectionCard({ section }: { section: TermsSection }) {
  const Icon = section.icon;

  return (
    <motion.div
      variants={sectionVariants}
      className="glass rounded-2xl p-5"
      data-testid={`terms-section-${section.id}`}
    >
      {/* Section heading */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`h-8 w-8 rounded-lg ${section.iconBg} flex items-center justify-center flex-shrink-0`}
          aria-hidden="true"
        >
          <Icon className={`h-4 w-4 ${section.iconColor}`} />
        </div>
        <h2 className="text-sm font-bold">{section.heading}</h2>
      </div>

      {/* Paragraphs */}
      <div className="space-y-2 pl-11">
        {section.paragraphs.map((para, idx) => (
          <p
            key={idx}
            className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line"
          >
            {para}
          </p>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TermsPage() {
  // useLocation available for future programmatic navigation
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* ── Header ── */}
      <MobileHeader title="服务条款" />

      <main className="px-4 pt-5 space-y-4">
        {/* ── Meta banner: last updated + intro ── */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="glass rounded-2xl p-4 flex items-start gap-3"
          data-testid="terms-meta-banner"
        >
          <div className="h-9 w-9 rounded-xl bg-[hsl(280_45%_55%)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertCircle className="h-5 w-5 text-[hsl(280_45%_55%)]" />
          </div>
          <div>
            <p className="text-sm font-semibold">服务条款</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              最后更新：2025年1月1日
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              在使用悦聚服务前，请仔细阅读以下条款。继续使用即视为您已同意本协议全部内容。
            </p>
          </div>
        </motion.div>

        {/* ── Terms sections ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3"
          data-testid="terms-sections-list"
        >
          {TERMS_SECTIONS.map((section) => (
            <TermsSectionCard key={section.id} section={section} />
          ))}
        </motion.div>

        {/* ── Agreement footer ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="rounded-2xl border border-border/50 bg-muted/30 p-4 text-center space-y-1"
          data-testid="terms-agreement-footer"
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            使用悦聚服务即代表您已阅读、理解并同意本服务条款。
          </p>
          <p className="text-xs text-muted-foreground">
            © 2025 JoyJoin. 保留所有权利。
          </p>
        </motion.div>

        <div className="h-2" />
      </main>

      <BottomNav />
    </div>
  );
}
