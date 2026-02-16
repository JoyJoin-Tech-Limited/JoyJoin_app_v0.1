import { useLocation } from "wouter";
import { useEffect } from "react";

/**
 * @deprecated 引导页已废弃 (2026-02-16)
 * 
 * 原 3 步全屏引导流程已替换为 DiscoverPage 上的内联教练标记 (inline coach marks)。
 * 此页面现在直接重定向到首页。
 * 
 * 迁移详情:
 * - 用户画像欢迎横幅 → CoachMarkBanner (DiscoverPage 顶部)
 * - 盲盒活动说明 → 首个事件卡片工具提示
 * - 小悦 AI 助手 → 浮动操作按钮 (XiaoyueFAB)
 * - 资料完善引导 → ProfileCompletionNudge
 * 
 * Related: Task 2 - Inline Coach Marks Implementation
 */
export default function GuidePage() {
  const [, setLocation] = useLocation();
  
  // 立即重定向到首页
  useEffect(() => {
    setLocation("/");
  }, [setLocation]);
  
  return null;
}
