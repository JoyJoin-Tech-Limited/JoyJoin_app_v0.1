import { describe, it, expect } from "vitest";
import {
  clampThemeTitle,
  THEME_TAGLINE_MAX_GRAPHEMES,
  THEME_TITLE_MAX_GRAPHEMES,
} from "../lib/themeTitleClamp";

/**
 * The theme title is rendered at 28rpx in `font-cn-display` inside a 338rpx
 * value column, so 12 CJK glyphs already consume the column exactly. These
 * tests lock the (characters in → characters out) table, because the failure
 * mode — a display-size name ellipsized by the UI — is invisible to every
 * assertion except a length one.
 */
describe("clampThemeTitle", () => {
  it("leaves a title that already fits untouched", () => {
    expect(clampThemeTitle("微醺夜话")).toBe("微醺夜话");
    expect(clampThemeTitle("今晚即兴饭局")).toBe("今晚即兴饭局");
  });

  it("treats the grapheme ceiling as inclusive", () => {
    const atLimit = "一二三四五六七八九十一"; // 11
    expect(THEME_TITLE_MAX_GRAPHEMES).toBe(11);
    expect(clampThemeTitle(atLimit)).toBe(atLimit);

    const oneOver = "一二三四五六七八九十一二"; // 12
    expect(clampThemeTitle(oneOver)).toHaveLength(11);
  });

  it("keeps the head clause of a compound title instead of cutting mid-phrase", () => {
    // The exact shape the designer flagged: a 17-character compound name.
    expect(clampThemeTitle("高能充电站：柯基×狐狸的周末探险")).toBe("高能充电站");
  });

  it("recognises every separator the generator glues with", () => {
    for (const separator of ["·", "：", ":", "|", "｜", "—", "–", "-"]) {
      expect(clampThemeTitle(`深夜频道${separator}说到做到然后又很长很长`)).toBe("深夜频道");
    }
  });

  it("falls back to a hard cut when the head clause is itself too long", () => {
    const result = clampThemeTitle("一个非常非常非常长的主题名字没有分隔符");
    expect(result).toHaveLength(11);
    expect(result).toBe("一个非常非常非常长的主");
  });

  it("never leaves dangling punctuation or glue after a cut", () => {
    // Cut lands on the 、 at position 11.
    expect(clampThemeTitle("一二三四五六七八九十、ABC")).toBe("一二三四五六七八九十");
    expect(clampThemeTitle("一二三四五六七八九十，ABC")).toBe("一二三四五六七八九十");
    expect(clampThemeTitle("一二三四五六七八九十 ABC")).toBe("一二三四五六七八九十");
  });

  it("never appends an ellipsis of its own", () => {
    // The UI owns truncation; a stored "…" would be ellipsized twice.
    expect(clampThemeTitle("一个非常非常非常长的主题名字没有分隔符")).not.toContain("…");
  });

  it("strips the quotes models wrap their own output in", () => {
    expect(clampThemeTitle("「微醺夜话」")).toBe("微醺夜话");
    expect(clampThemeTitle('"微醺夜话"')).toBe("微醺夜话");
  });

  it("is a total function", () => {
    expect(clampThemeTitle("")).toBe("");
    expect(clampThemeTitle(null)).toBe("");
    expect(clampThemeTitle(undefined)).toBe("");
    expect(clampThemeTitle("   ")).toBe("");
    expect(clampThemeTitle("：只有冒号开头")).toBe("：只有冒号开头");
  });

  it("counts an emoji as one unit so it cannot inflate the length", () => {
    // 11 graphemes, 12 UTF-16 code units for the emoji — must still fit.
    const withEmoji = "微醺夜话🎉一二三四五六";
    expect(clampThemeTitle(withEmoji)).toBe(withEmoji);
  });

  it("also carries the rationale line, which shares the same column", () => {
    // The tagline is validated at ≤20 by the generator but renders at 24rpx in
    // the same 338rpx column, so 15-20 characters ellipsized on a third of cards.
    expect(THEME_TAGLINE_MAX_GRAPHEMES).toBe(13);
    expect(clampThemeTitle("因咖啡相遇的跨行业创新组合", THEME_TAGLINE_MAX_GRAPHEMES)).toBe(
      "因咖啡相遇的跨行业创新组合",
    ); // 13 — exactly at the ceiling
    expect(
      clampThemeTitle("因咖啡相遇的跨行业创新组合然后还有很长的尾巴", THEME_TAGLINE_MAX_GRAPHEMES),
    ).toHaveLength(13);
  });
});
