import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConnectionArchetypeReveal from "./ConnectionArchetypeReveal";

export interface ConnectionRevealItem {
  id: string;
  peerDisplayName: string;
  peerArchetype?: string | null;
  peerWechatId?: string | null;
  connectionReasons?: string[] | null;
}

interface ConnectionRevealOverlayProps {
  open: boolean;
  currentUserArchetype?: string | null;
  items: ConnectionRevealItem[];
  onClose: () => void;
  onFocusConnection?: (connectionId: string) => void;
}

export default function ConnectionRevealOverlay({
  open,
  currentUserArchetype,
  items,
  onClose,
  onFocusConnection,
}: ConnectionRevealOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const item = items[index];

  useEffect(() => {
    if (open) {
      setIndex(0);
    }
  }, [open, items]);

  const quotedReasons = useMemo(
    () => (item?.connectionReasons ?? []).filter(Boolean).slice(0, 2),
    [item],
  );

  if (!open || !item) return null;

  const handleNext = () => {
    if (index < items.length - 1) {
      setIndex((current) => current + 1);
      return;
    }
    setIndex(0);
    onClose();
  };

  const handleFocus = () => {
    onFocusConnection?.(item.id);
    handleNext();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[90] flex items-end justify-center bg-[#070510]/88 px-4 pb-8 pt-12 backdrop-blur-xl"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={prefersReducedMotion ? false : { y: 24, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.32, ease: "easeOut" }}
          className="w-full max-w-md rounded-[32px] border border-white/10 bg-white/8 p-6 text-white shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
        >
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.3em] text-white/45">Something happened</p>
            <h2 className="mt-2 text-2xl font-cn-display font-semibold">
              你和 {item.peerDisplayName} 互相选择了
            </h2>
            <p className="mt-2 text-sm text-white/65">这一刻值得被认真揭晓。</p>
          </div>

          <ConnectionArchetypeReveal
            currentUserArchetype={currentUserArchetype}
            peerArchetype={item.peerArchetype}
          />

          {quotedReasons.length > 0 && (
            <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
              <p className="text-xs text-white/45">Ta 觉得你们：</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {quotedReasons.map((reason) => (
                  <span
                    key={reason}
                    className="rounded-full bg-white/12 px-3 py-1 text-xs text-white/75"
                  >
                    {reason}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-[24px] bg-gradient-to-br from-white/14 via-white/8 to-white/4 p-4 ring-1 ring-white/12">
            <p className="text-xs text-white/50">Ta 的微信已为你解锁</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-white">
                  {item.peerWechatId || "暂未填写"}
                </p>
                <p className="text-xs text-white/45">复制后就可以主动打招呼啦</p>
              </div>
              {item.peerWechatId && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(item.peerWechatId ?? "");
                  }}
                  className="shrink-0"
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  复制
                </Button>
              )}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <Button onClick={handleFocus} className="h-12 w-full">
              记录这次连接的感受
            </Button>
            <Button variant="ghost" onClick={handleNext} className="w-full text-white/70">
              {index < items.length - 1 ? "继续看下一位" : "稍后再说"}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
