import { useState, useCallback } from "react";

interface StreakInfo {
  newStreak: number;
  usedFreezeCard: boolean;
  streakBroken: boolean;
  previousStreak: number;
  streakBonus?: { xp: number; coins: number };
}

interface XPNotification {
  show: boolean;
  xpGained: number;
  coinsGained: number;
  action?: string;
  streakInfo?: StreakInfo;
}

interface XPNotificationPayload {
  xpGained: number;
  coinsGained: number;
  action?: string;
  streakInfo?: StreakInfo;
}

const NOTIFICATION_DURATION = 3500;

export function useXPNotification() {
  const [notification, setNotification] = useState<XPNotification>({
    show: false,
    xpGained: 0,
    coinsGained: 0,
  });

  const showNotification = useCallback((payload: XPNotificationPayload) => {
    setNotification({
      show: true,
      ...payload,
    });

    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, NOTIFICATION_DURATION);
  }, []);

  const hideNotification = useCallback(() => {
    setNotification((prev) => ({ ...prev, show: false }));
  }, []);

  return {
    notification,
    showNotification,
    hideNotification,
  };
}
