import { useEffect } from "react";

/** Route → page title mapping (derived from sidebar navigation) */
const ROUTE_TITLES: Record<string, string> = {
  "/admin": "数据看板",
  "/admin/dashboard": "数据看板",
  "/admin/users": "用户管理",
  "/admin/event-pools": "活动池管理",
  "/admin/venues": "场地管理",
  "/admin/matching": "匹配实验室",
  "/admin/matching-config": "匹配配置",
  "/admin/matching-logs": "匹配日志",
  "/admin/matching-reviews": "匹配审核",
  "/admin/feedback": "反馈管理",
  "/admin/moderation": "用户举报",
  "/admin/interaction-logs": "连接日志",
  "/admin/insights": "数据洞察",
  "/admin/outcome-analytics": "Outcome 分析",
  "/admin/icebreaker-ai-feedback": "破冰 AI 反馈",
  "/admin/content": "内容管理",
  "/admin/notifications": "通知推送",
  "/admin/events": "活动管理",
  "/admin/subscriptions": "订阅管理",
  "/admin/pricing": "定价管理",
  "/admin/coupons": "优惠券",
  "/admin/finance": "财务管理",
  "/admin/reports": "聊天举报",
  "/admin/evolution": "悦仔进化",
  "/admin/accounts": "管理员账号",
  "/admin/audit-logs": "审计日志",
  "/admin/feature-flags": "功能开关",
  "/admin/templates": "活动模板",
};

const DEFAULT_TITLE = "悦聚·Joy - 管理后台";

export function getPageTitle(path: string): string {
  // Exact match first
  if (ROUTE_TITLES[path]) {
    return `${ROUTE_TITLES[path]} · ${DEFAULT_TITLE}`;
  }
  // Fallback: try to find a parent route (e.g., /admin/users/123 → 用户管理)
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 2 && segments[0] === "admin") {
    const base = `/${segments[0]}/${segments[1]}`;
    if (ROUTE_TITLES[base]) {
      return `${ROUTE_TITLES[base]} · ${DEFAULT_TITLE}`;
    }
  }
  return DEFAULT_TITLE;
}

/** Set document.title based on current route. Call from layout level. */
export function usePageTitle(path: string) {
  useEffect(() => {
    document.title = getPageTitle(path);
  }, [path]);
}
