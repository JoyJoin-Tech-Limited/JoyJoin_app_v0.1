export type DuoOutcome = {
  label: string;
  tone: "success" | "attention" | "pending" | "empty";
};

/** false means no recorded seating yet, not proof that the pair was separated. */
export function getDuoSeatedOutcome(matchedTogether: boolean | null): DuoOutcome {
  if (matchedTogether === true) return { label: "已同桌", tone: "success" };
  if (matchedTogether === false) return { label: "结果待定", tone: "pending" };
  return { label: "—", tone: "empty" };
}

export function getDuoRewardOutcome(
  rewardIssued: boolean | null,
  matchedTogether: boolean | null,
): DuoOutcome {
  if (rewardIssued === true) return { label: "券已发", tone: "success" };
  if (rewardIssued === false && matchedTogether === true) {
    return { label: "券未发", tone: "attention" };
  }
  return { label: "—", tone: "empty" };
}

/** seated counts use rows while accepted counts invitations; see server summary semantics. */
export function formatDuoSeatedRate(seated: number, accepted: number): string {
  if (accepted <= 0) return "—";
  const percent = Math.round((seated / accepted) * 1000) / 10;
  return `${percent}%`;
}
