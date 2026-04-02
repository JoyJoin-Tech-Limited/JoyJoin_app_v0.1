import { motion } from "framer-motion";
import customerServiceQR from "@/assets/customer service/悦聚JoyJoin客服二维码页面-完整全屏.svg";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WechatServiceQRCardProps {
  variant?: "full" | "compact" | "inline";
  title?: string;
  subtitle?: string;
  footer?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const WECHAT_PATH =
  "M8.5 2C4.36 2 1 5.13 1 9c0 2.05.9 3.89 2.33 5.18L2.5 17l3.08-1.54A8.2 8.2 0 0 0 8.5 16c4.14 0 7.5-3.13 7.5-7S12.64 2 8.5 2ZM21 11c0-3.31-2.97-6-6.63-6-.2 0-.4.01-.6.03C14.55 7.82 16 10.26 16 13a8.8 8.8 0 0 1-.44 2.76C15.7 15.92 16 16 16.37 16l2.63 1.32-.7-2.56C19.4 13.7 21 12.43 21 11Z";

export default function WechatServiceQRCard({
  variant = "full",
  title = "加入我们的智能客服",
  subtitle = "使用微信扫描二维码联系客服",
  footer = "随时为您服务 24/7",
  className = "",
}: WechatServiceQRCardProps) {
  // QR image size per variant
  const qrSize =
    variant === "full"
      ? "w-52 h-52"
      : variant === "compact"
      ? "w-40 h-40"
      : "w-32 h-32";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`glass rounded-3xl p-5 flex flex-col items-center gap-4 shadow-md ${className}`}
    >
      {/* WeChat brand pill */}
      <div className="flex items-center gap-2 bg-[#07C160]/10 rounded-full px-4 py-1.5">
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 fill-[#07C160]"
          aria-hidden="true"
          focusable="false"
        >
          <path d={WECHAT_PATH} />
        </svg>
        <span className="text-sm font-semibold text-[#07C160]">微信智能客服</span>
      </div>

      {/* Title */}
      <div className="text-center space-y-1">
        <p
          className="font-cn-display text-base font-semibold"
        >
          {title}
        </p>
        <p
          className="font-cn-display text-xs text-muted-foreground"
        >
          {subtitle}
        </p>
      </div>

      {/* QR image */}
      <div className={`${qrSize} rounded-2xl overflow-hidden bg-white`}>
        <img
          src={customerServiceQR}
          alt="悦聚智能客服二维码"
          className="w-full h-full object-contain"
          aria-describedby="wechat-qr-instruction"
          loading="lazy"
          decoding="async"
        />
      </div>

      {/* Helper text */}
      <p
        id="wechat-qr-instruction"
        className="text-xs text-muted-foreground/70 text-center"
      >
        长按保存二维码
      </p>

      {/* Footer */}
      <p
        className="font-cn-display text-xs text-center bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent"
      >
        {footer}
      </p>
    </motion.div>
  );
}
