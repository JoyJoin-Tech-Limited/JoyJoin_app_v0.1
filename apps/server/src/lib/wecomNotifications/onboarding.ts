import { notifyOpsMarkdown, sanitizeUserPayload, buildAdminUrl } from "../wecomNotifier";

export interface OnboardingCompletePayload {
  user: {
    id?: string;
    displayName?: string | null;
    gender?: string | null;
    birthdate?: string | Date | null;
    primaryArchetype?: string | null;
    currentCity?: string | null;
    educationLevel?: string | null;
    occupationId?: string | null;
    industryNicheLabel?: string | null;
    intent?: string[] | null;
    lifeStage?: string | null;
    relationshipStatus?: string | null;
  };
  onboardingDurationMin: number;
  referralSource?: string | null;
}

export async function notifyOnboardingComplete(payload: OnboardingCompletePayload): Promise<void> {
  const info = sanitizeUserPayload(payload.user);
  const durationWarning = payload.onboardingDurationMin > 30
    ? ` ⚠️ 超过 30 分钟`
    : "";

  await notifyOpsMarkdown("🎉 新用户完成注册", [
    `**用户：** ${info.displayName}（${info.age !== null ? `${info.age}岁` : "未知年龄"} · ${info.gender}）`,
    `**城市：** ${info.city}`,
    `**人格原型：** ${info.archetype}`,
    `**教育：** ${info.education}`,
    `**职业：** ${info.occupation}`,
    `**社交意图：** ${info.intentList}`,
    `**渠道来源：** ${payload.referralSource || "自然注册"}`,
    `**注册耗时：** ${payload.onboardingDurationMin}分钟${durationWarning}`,
    "",
    `[查看用户详情 →](${buildAdminUrl(`/admin/users/${info.userId}`)})`,
  ]);
}
