import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { AdminUserInterestCard } from "../AdminUserInterestCard";
import type { UserInterests } from "../types";

function screenshotInterests(): UserInterests {
  return {
    totalSelections: 9,
    totalHeat: 203,
    categoryHeat: { food: 50, play: 53, sports: 25, culture: 25, life: 25, growth: 25 },
    selections: [
      { topicId: "food-explore", label: "探店", category: "美食小酌", categoryId: "food", level: 3, heat: 25 },
      { topicId: "food-private-kitchen", label: "私厨", category: "美食小酌", categoryId: "food", level: 3, heat: 25 },
      { topicId: "play-ktv", label: "KTV", category: "聚会玩乐", categoryId: "play", level: 3, heat: 25 },
      { topicId: "play-bar", label: "小酒馆", category: "聚会玩乐", categoryId: "play", level: 3, heat: 25 },
      { topicId: "play-boardgame", label: "桌游", category: "聚会玩乐", categoryId: "play", level: 1, heat: 3 },
      { topicId: "sports-climbing", label: "攀岩", category: "运动户外", categoryId: "sports", level: 3, heat: 25 },
      { topicId: "culture-movie", label: "电影", category: "文艺现场", categoryId: "culture", level: 3, heat: 25 },
      { topicId: "life-travel", label: "旅行", category: "生活美学", categoryId: "life", level: 3, heat: 25 },
      { topicId: "growth-podcast", label: "播客", category: "思想成长", categoryId: "growth", level: 3, heat: 25 },
    ],
    topPriorities: [
      { topicId: "food-explore", label: "探店", heat: 25 },
      { topicId: "food-private-kitchen", label: "私厨", heat: 25 },
      { topicId: "play-ktv", label: "KTV", heat: 25 },
      { topicId: "play-bar", label: "小酒馆", heat: 25 },
      { topicId: "sports-climbing", label: "攀岩", heat: 25 },
      { topicId: "culture-movie", label: "电影", heat: 25 },
      { topicId: "life-travel", label: "旅行", heat: 25 },
      { topicId: "growth-podcast", label: "播客", heat: 25 },
    ],
  };
}

describe("AdminUserInterestCard", () => {
  it("shows the volume, breadth, and total heat summary", () => {
    render(<AdminUserInterestCard interests={screenshotInterests()} />);

    expect(screen.getByText("9 项兴趣 · 覆盖 6 类 · 总热度 203")).toBeTruthy();
  });

  it("lists all nine selections with their own heat tier", () => {
    render(<AdminUserInterestCard interests={screenshotInterests()} />);

    expect(screen.getAllByTestId(/^interest-row-/)).toHaveLength(9);

    const hiddenNinth = screen.getByTestId("interest-row-play-boardgame");
    expect(within(hiddenNinth).getByText(/感兴趣/)).toBeTruthy();
    expect(within(hiddenNinth).getByText("3")).toBeTruthy();
  });

  it("renders Chinese category names for both rows and rollups", () => {
    const { container } = render(<AdminUserInterestCard interests={screenshotInterests()} />);

    const playRollup = screen.getByTestId("interest-category-play");
    expect(playRollup.textContent).toContain("聚会玩乐");
    expect(playRollup.textContent).toContain("3 项");
    expect(playRollup.textContent).toContain("53");
    expect(screen.queryByText("play")).toBeNull();
    expect(screen.queryByText("food")).toBeNull();
    expect(container.textContent).toContain("美食小酌");
    expect(container.textContent).toContain("思想成长");
  });

  it("explains the 3 / 10 / 25 scale once", () => {
    render(<AdminUserInterestCard interests={screenshotInterests()} />);

    expect(screen.getByText(/热度 3 \/ 10 \/ 25 对应 感兴趣 \/ 很热衷 \/ 必聊项/)).toBeTruthy();
  });

  it("replaces the old level-3-only chip block", () => {
    render(<AdminUserInterestCard interests={screenshotInterests()} />);

    expect(screen.queryByText("高优先级兴趣")).toBeNull();
  });

  it("shows an empty state when nothing was selected", () => {
    render(<AdminUserInterestCard interests={null} />);

    expect(screen.getByText("尚未填写兴趣")).toBeTruthy();
    expect(screen.queryAllByTestId(/^interest-row-/)).toHaveLength(0);
  });
});
