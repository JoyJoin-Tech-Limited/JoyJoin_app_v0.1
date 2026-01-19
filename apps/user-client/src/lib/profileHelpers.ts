/**
 * Profile Helpers
 * Utilities for profile completeness calculation and label getters
 */

export interface UserProfile {
  displayName?: string;
  gender?: string;
  birthdate?: string;
  relationshipStatus?: string;
  education?: string;
  industryCategory?: string;
  industryCategoryLabel?: string;
  industrySegmentLabel?: string;
  hometown?: string;
  currentCity?: string;
  intent?: string[];
  interests?: string[];
  archetype?: string;
}

/**
 * Calculate profile completeness percentage
 */
export function calculateProfileCompleteness(profile: UserProfile): number {
  const fields = [
    profile.displayName,
    profile.gender,
    profile.birthdate,
    profile.relationshipStatus,
    profile.education,
    profile.industryCategory,
    profile.hometown,
    profile.currentCity,
    profile.intent && profile.intent.length > 0,
    profile.interests && profile.interests.length > 0,
  ];

  const completed = fields.filter(Boolean).length;
  return Math.round((completed / fields.length) * 100);
}

/**
 * Get relationship status label
 */
export function getRelationshipLabel(status: string): string {
  const labels: Record<string, string> = {
    single: "单身",
    dating: "恋爱中",
    married: "已婚",
    prefer_not_say: "不想说",
  };
  return labels[status] || status;
}

/**
 * Get education label
 */
export function getEducationLabel(education: string): string {
  const labels: Record<string, string> = {
    high_school: "高中及以下",
    college: "大专",
    bachelor: "本科",
    master: "硕士",
    phd: "博士",
  };
  return labels[education] || education;
}

/**
 * Get intent label
 */
export function getIntentLabel(intent: string): string {
  const labels: Record<string, string> = {
    friends: "交新朋友",
    networking: "拓展人脉",
    discussion: "深度交流",
    fun: "轻松娱乐",
    romance: "浪漫邂逅",
    flexible: "随缘",
  };
  return labels[intent] || intent;
}

/**
 * Get intent icon
 */
export function getIntentIcon(intent: string): string {
  const icons: Record<string, string> = {
    friends: "👥",
    networking: "🌐",
    discussion: "💬",
    fun: "🎉",
    romance: "💝",
    flexible: "🎲",
  };
  return icons[intent] || "✨";
}

/**
 * Get city label
 */
export function getCityLabel(city: string): string {
  const labels: Record<string, string> = {
    shenzhen: "深圳",
    hongkong: "香港",
    guangzhou: "广州",
    dongguan: "东莞",
    foshan: "佛山",
    other: "其他城市",
  };
  return labels[city] || city;
}

/**
 * Calculate age from birthdate
 */
export function calculateAge(birthdate: string): number | null {
  if (!birthdate) return null;
  
  const birth = new Date(birthdate + 'T00:00:00');
  
  // Validate the date
  if (isNaN(birth.getTime())) {
    return null;
  }
  
  const today = new Date();
  
  // Check if birthdate is in the future
  if (birth > today) {
    return null;
  }
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
