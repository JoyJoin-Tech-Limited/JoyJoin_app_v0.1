import { notifyOpsMarkdown, buildAdminUrl } from "../wecomNotifier";

export interface AccountDeletedPayload {
  dailyCount: number;
  weeklyAvg: number;
  date: string;
  topArchetype: string;
  topArchetypeCount: number;
  topCity: string;
  topCityCount: number;
  avgAccountAgeDays: number;
  recentlyActiveCount: number;
  topReasons: string;
}

export async function notifyAccountDeleted(payload: AccountDeletedPayload): Promise<void> {
  const isSpike = payload.dailyCount > payload.weeklyAvg * 2;

  const lines: string[] = [
    `**今日注销：** ${payload.dailyCount} 人（近 7 日均值：${payload.weeklyAvg.toFixed(0)}/天）`,
    "",
    "**趋势判断：**",
    isSpike
      ? `🔴 **注销量突增（${payload.dailyCount} vs 均值 ${payload.weeklyAvg.toFixed(0)}），建议排查原因**`
      : "🟢 正常范围",
    "",
    "**高频注销特征：**",
    `- 最常见人格原型：${payload.topArchetype}（${payload.topArchetypeCount}人）`,
    `- 最常见城市：${payload.topCity}（${payload.topCityCount}人）`,
    `- 平均在 app 时长：${payload.avgAccountAgeDays} 天`,
    `- 最近登录后注销：${payload.recentlyActiveCount} 人（近 7 天有登录）`,
    `- 主要注销原因：${payload.topReasons}`,
    "",
    `[查看用户分析面板 →](${buildAdminUrl("/admin/analytics/user-retention")})`,
  ];

  await notifyOpsMarkdown(`🗑️ 用户注销日报（${payload.date}）`, lines);
}
