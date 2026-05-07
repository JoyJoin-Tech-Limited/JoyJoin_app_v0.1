import { useState, useEffect, useMemo, useCallback } from "react";

export interface RevealStatus {
  isRevealed: boolean;
  countdown: string;
  countdownMessage: string;
  timeRemaining: number;
  precision: "days" | "hours" | "minutes" | "seconds";
}

const REVEAL_THRESHOLD_HOURS = 24;

const XIAOYUE_MESSAGES = [
  "嘿嘿，还有 {countdown} 就能见到新朋友啦～",
  "TA们也在期待和你相遇哦！",
  "小悦已经帮你安排好一切，敬请期待 ✨",
  "神秘感是最好的期待，再等等哦～",
  "好事不怕晚，{countdown} 后揭晓！",
];

function formatCountdown(ms: number): { countdown: string; precision: RevealStatus["precision"] } {
  if (ms <= 0) {
    return { countdown: "即将揭晓", precision: "seconds" };
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return {
      countdown: `${days}天后`,
      precision: "days",
    };
  }

  if (hours >= 1) {
    const remainingMinutes = minutes % 60;
    return {
      countdown: `${hours}小时${remainingMinutes > 0 ? remainingMinutes + "分钟" : ""}`,
      precision: "hours",
    };
  }

  if (minutes >= 1) {
    const remainingSeconds = seconds % 60;
    return {
      countdown: `${minutes}分${remainingSeconds}秒`,
      precision: "minutes",
    };
  }

  return {
    countdown: `${seconds}秒`,
    precision: "seconds",
  };
}

function getXiaoyueMessage(countdown: string, messageIndex: number): string {
  const message = XIAOYUE_MESSAGES[messageIndex % XIAOYUE_MESSAGES.length];
  return message.replace("{countdown}", countdown);
}

export function useRevealStatus(eventDateTime: Date | string | null | undefined): RevealStatus {
  const eventDate = useMemo(() => {
    if (!eventDateTime) return null;
    return typeof eventDateTime === "string" ? new Date(eventDateTime) : eventDateTime;
  }, [eventDateTime]);

  const [now, setNow] = useState(() => new Date());
  const [messageIndex] = useState(() => Math.floor(Math.random() * XIAOYUE_MESSAGES.length));

  const calculateStatus = useCallback((): RevealStatus => {
    if (!eventDate) {
      return {
        isRevealed: false,
        countdown: "未知",
        countdownMessage: "活动时间待定",
        timeRemaining: Infinity,
        precision: "days",
      };
    }

    const revealTime = new Date(eventDate.getTime() - REVEAL_THRESHOLD_HOURS * 60 * 60 * 1000);
    const currentTime = new Date();
    const msUntilReveal = revealTime.getTime() - currentTime.getTime();

    if (msUntilReveal <= 0) {
      return {
        isRevealed: true,
        countdown: "已揭晓",
        countdownMessage: "匹配结果已揭晓！",
        timeRemaining: 0,
        precision: "seconds",
      };
    }

    const { countdown, precision } = formatCountdown(msUntilReveal);
    const countdownMessage = getXiaoyueMessage(countdown, messageIndex);

    return {
      isRevealed: false,
      countdown,
      countdownMessage,
      timeRemaining: msUntilReveal,
      precision,
    };
  }, [eventDate, messageIndex]);

  const [status, setStatus] = useState<RevealStatus>(() => calculateStatus());

  useEffect(() => {
    if (!eventDate) return;

    const updateStatus = () => {
      const newStatus = calculateStatus();
      setStatus(newStatus);
      setNow(new Date());
    };

    updateStatus();

    let intervalMs: number;
    if (status.precision === "seconds" || status.precision === "minutes") {
      intervalMs = 1000;
    } else if (status.precision === "hours") {
      intervalMs = 60 * 1000;
    } else {
      intervalMs = 60 * 60 * 1000;
    }

    const interval = setInterval(updateStatus, intervalMs);
    return () => clearInterval(interval);
  }, [eventDate, calculateStatus, status.precision]);

  return status;
}

export function useEventRevealCountdown(eventDateTime: Date | string | null | undefined) {
  const status = useRevealStatus(eventDateTime);
  
  return {
    ...status,
    formattedCountdown: status.isRevealed 
      ? null 
      : status.countdown,
    xiaoyueMessage: status.isRevealed 
      ? "终于可以见面啦！小悦好开心～" 
      : status.countdownMessage,
  };
}
