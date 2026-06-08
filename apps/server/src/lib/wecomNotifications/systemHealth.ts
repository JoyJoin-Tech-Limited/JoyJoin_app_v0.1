import { notifyCriticalMarkdown, buildAdminUrl } from "../wecomNotifier";

export interface ErrorSpikePayload {
  businessImpact: string;
  affectedUserCount: number;
  endpointName: string;
  errorRate: number;
  sampleCount: number;
  firstSeenAt: string;
  durationMinutes: number;
  serviceName: string;
  actionGuide: string;
}

export async function notifyErrorSpike(payload: ErrorSpikePayload): Promise<void> {
  await notifyCriticalMarkdown("💥 系统异常告警 🚨", [
    `**现象：** ${payload.businessImpact}`,
    `**影响用户：** 约 ${payload.affectedUserCount} 人受影响`,
    "",
    "**异常详情：**",
    `- 接口：${payload.endpointName}`,
    `- 异常率：${payload.errorRate.toFixed(1)}%（阈值 5%）`,
    `- 样本量：${payload.sampleCount} 次请求异常`,
    `- 开始时间：${payload.firstSeenAt}`,
    `- 持续时间：${payload.durationMinutes} 分钟`,
    "",
    `**建议操作：** ${payload.actionGuide}`,
    "",
    `[监控面板 →](${buildAdminUrl("/admin/monitoring")})`,
  ]);
}
