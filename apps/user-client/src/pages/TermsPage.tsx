import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  FileText,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Lock,
  Calendar,
  Scale,
  Mail,
  Landmark,
  type LucideIcon,
} from "lucide-react";
import type { TermsSectionZh, TermsEntrySection } from "@shared/legal/joyjoinTermsZh";
import {
  JOYJOIN_TERMS_SECTIONS_ZH,
  LEGAL_LAST_UPDATED_LABEL_ZH,
  JOYJOIN_COPYRIGHT_YEAR,
  TERMS_ENTRY_META,
} from "@shared/legal/joyjoinTermsZh";
import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";

// ---------------------------------------------------------------------------
// Icons per section (canonical copy lives in @shared/legal/joyjoinTermsZh)
// ---------------------------------------------------------------------------

const SECTION_ICON: Record<
  string,
  { icon: LucideIcon; iconColor: string; iconBg: string }
> = {
  "ts-service": {
    icon: FileText,
    iconColor: "text-purple-500",
    iconBg: "bg-purple-500/10",
  },
  "ts-eligibility": {
    icon: UserCheck,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
  },
  "ts-conduct": {
    icon: ShieldCheck,
    iconColor: "text-green-500",
    iconBg: "bg-green-500/10",
  },
  "ts-privacy": {
    icon: Lock,
    iconColor: "text-rose-500",
    iconBg: "bg-rose-500/10",
  },
  "ts-events": {
    icon: Calendar,
    iconColor: "text-orange-500",
    iconBg: "bg-orange-500/10",
  },
  "ts-disclaimer": {
    icon: Scale,
    iconColor: "text-yellow-500",
    iconBg: "bg-yellow-500/10",
  },
  "ts-contact": {
    icon: Mail,
    iconColor: "text-cyan-500",
    iconBg: "bg-cyan-500/10",
  },
  "ts-legal-basis": {
    icon: Landmark,
    iconColor: "text-indigo-500",
    iconBg: "bg-indigo-500/10",
  },
};

type TermsSectionView = TermsSectionZh & {
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
};

const TERMS_SECTIONS_VIEW: TermsSectionView[] = JOYJOIN_TERMS_SECTIONS_ZH.map(
  (s) => {
    const meta = SECTION_ICON[s.id] ?? SECTION_ICON["ts-service"];
    return { ...s, ...meta };
  },
);

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

function TermsSectionCard({
  section,
  focusId,
}: {
  section: TermsSectionView;
  focusId?: string;
}) {
  const Icon = section.icon;
  const isFocus = Boolean(focusId && focusId === section.id);

  return (
    <motion.div
      variants={sectionVariants}
      id={section.id}
      className={`glass rounded-2xl p-5 scroll-mt-24 ${
        isFocus ? "ring-2 ring-[hsl(280_45%_55%)]/25 shadow-md" : ""
      }`}
      data-testid={`terms-section-${section.id}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`h-8 w-8 rounded-lg ${section.iconBg} flex items-center justify-center flex-shrink-0`}
          aria-hidden="true"
        >
          <Icon className={`h-4 w-4 ${section.iconColor}`} />
        </div>
        <h2 className="text-sm font-bold">{section.heading}</h2>
      </div>

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
  const [loc] = useLocation();
  const [entrySection, setEntrySection] = useState<TermsEntrySection>("terms");

  useEffect(() => {
    if (loc === "/privacy") {
      setEntrySection("privacy");
      return;
    }
    const q = new URLSearchParams(window.location.search).get("section");
    setEntrySection(q === "privacy" ? "privacy" : "terms");
  }, [loc]);

  const entryMeta = TERMS_ENTRY_META[entrySection];

  useEffect(() => {
    if (entrySection !== "privacy" || !entryMeta.focusId) return;
    const t = window.setTimeout(() => {
      document.getElementById(entryMeta.focusId!)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
    return () => window.clearTimeout(t);
  }, [entrySection, entryMeta.focusId]);

  const documentTitle = useMemo(
    () => (entrySection === "privacy" ? "隐私政策" : "用户协议"),
    [entrySection],
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <MobileHeader title={documentTitle} />

      <main className="px-4 pt-5 space-y-4">
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
            <p className="text-sm font-semibold">{entryMeta.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              最后更新：{LEGAL_LAST_UPDATED_LABEL_ZH}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {entryMeta.intro}
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-3"
          data-testid="terms-sections-list"
        >
          {TERMS_SECTIONS_VIEW.map((section) => (
            <TermsSectionCard
              key={section.id}
              section={section}
              focusId={entryMeta.focusId}
            />
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="rounded-2xl border border-border/50 bg-muted/30 p-4 text-center space-y-1"
          data-testid="terms-agreement-footer"
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            使用悦聚服务即代表您已阅读、理解并同意本页所示用户协议与隐私相关说明。
          </p>
          <p className="text-xs text-muted-foreground">
            © {JOYJOIN_COPYRIGHT_YEAR} JoyJoin. 保留所有权利。
          </p>
        </motion.div>

        <div className="h-2" />
      </main>

      <BottomNav />
    </div>
  );
}
