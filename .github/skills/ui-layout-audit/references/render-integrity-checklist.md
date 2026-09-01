# Render Integrity Checklist (渲染完整性审计)

**Scope:** `apps/mini-program` rendered output. This checklist catches the defect class that code review is structurally blind to: **every line of SCSS is valid, every token is correct, and the render is still wrong.**

Origin incident (2026-09-01): `pages/profile-linked/terms` — the 法律说明 pill floated above the 用户协议 title baseline. Root cause: WeChat `<Text>` is inline, `type-heading` never set `display: block`, and the `inline-flex` pill aligned on its own small-text baseline. `margin-bottom: $spacing-sm` on the pill was dead code signaling a stacking intent that never happened.

**Core doctrine:** 代码自洽 ≠ 渲染和谐. Every alignment claim must be verified against the render. Fix at the **semantics layer** (`display`/`flex`), never with unexplained pixel nudges.

## Audit protocol

1. **Render first** — Step 0 of `ui-layout-audit` (audit:visual + screenshot) is the entry gate. This checklist runs against the render, not the code.
2. **Line-map** — For each visual line on screen, list which elements occupy it. Compare against JSX sibling intent. Any mismatch = investigate (usually R1).
3. **Run R1–R8 detection** below. Tag each finding **blocking** or **craft**.
4. **Fix at semantics layer.** Any `margin-top: -4rpx`-style optical nudge requires an inline comment explaining why semantics can't fix it.
5. **Re-render and verify the fix** — a semantics fix can shift neighboring lines; re-run the line-map.

## Defect taxonomy (R1–R8)

### R1 — Inline/block 语义错位 · **blocking**

- **Symptom:** An element that should own its line shares a line with a sibling (pill beside title, tag beside heading).
- **Mechanism:** WeChat `<Text>` renders **inline**. `inline-flex` / `inline-block` are inline-level. Without `display: block` or a `flex-direction: column` parent, siblings flow onto one line.
- **Detection:** Line-map mismatch; or any `<Text>` styled as a heading whose mixin/class does not set `display: block`.
- **Fix:** Parent `display: flex; flex-direction: column` (preferred — banners, cards) or `display: block` on the text. Remove margins that were only meaningful in the intended stacking.

### R2 — 基线对齐陷阱 · **blocking**

- **Symptom:** Same-line elements with different font sizes or fonts look like one is "floating" high or low.
- **Mechanism:** Inline-level boxes align on **text baseline**. The baseline of a small pill is its own 22rpx text baseline — it has no relationship to the visual center of a 40rpx title. Mixing Alimama display font with system font makes it worse (R4).
- **Detection:** Any rendered line containing elements whose font-size differs by ≥8rpx, or whose font-family differs.
- **Fix:** Wrap the pair in `display: flex; align-items: center` (or `baseline` only when sizes/fonts match). **Baseline alignment is forbidden for mixed sizes/fonts.**

### R3 — 行高幽灵 · craft → blocking when rhythm breaks

- **Symptom:** `margin: 16rpx` but the visible gap is clearly larger or smaller.
- **Mechanism:** Text line-boxes carry leading above the first line and below the last. CJK fonts (especially Alimama) have large default metrics. Visual gap = margin + residual leading.
- **Detection:** Measure **edge-to-edge** (glyph ink to glyph ink) in DevTools, not box-to-box.
- **Fix:** Account for line-height when setting margins adjacent to text; verify with the DevTools box overlay.

### R4 — 字体度量漂移 · craft

- **Symptom:** Alignment or line-height "jumps" where brand display font meets system font.
- **Mechanism:** Different ascent/descent metrics; identical `line-height` ratios render differently.
- **Fix:** Don't mix display font and system font on one line without a flex-center row (R2); prefer separate lines.

### R5 — 首尾间距失控 · craft

- **Symptom:** Phantom extra space at card top/bottom; last child's `margin-bottom` inflates the card.
- **Fix:** `:last-child { margin-bottom: 0 }` pattern, or parent flex column with `gap` (gap never leaks to edges).

### R6 — 图标/文本光学对齐 · craft

- **Symptom:** Icon sits visually high/low next to its label.
- **Fix:** `align-items: center`, never baseline; icon sizes on the 4rpx grid.

### R7 — 极值文案渲染 · blocking when broken

- **Detection:** Render every variant: 1 character, 20+ characters, empty string, English-in-CJK, maximum data length. Layouts tuned only to the happy-path string break silently on extremes.

### R8 — 死声明 / 意图漂移 · meta-check

- **Mechanism:** A declaration whose effect depends on layout context is a lie detector. `margin-bottom` on an inline-level element sharing a line, `vertical-align` on a block, `align-items` on a non-flex parent — all dead code.
- **Rule:** Every dead declaration is a **bug report**, not a cleanup-later. It records an intent that never reached the render. Investigate, don't delete-and-move-on.

## Hard rules (完美主义红线)

1. Never fix a baseline problem with negative margins — fix the `display` semantics.
2. Every mixed-size / mixed-font same-line pair is a flex row with `align-items: center`.
3. Every pill/tag adjacent to a title is verified in render — this pair is the highest-frequency offender.
4. Every dead declaration found during audit is investigated for intent drift (R8).
5. **数值优先于标签** — values carry more visual weight than their labels ("591" bigger than "Sales"); never emphasize labels over values.
6. **Spacing multiplier rule** — if related elements are `g` apart, the gap to the next group is ≥ `2g`. Uniform gaps destroy hierarchy.

## Quick example — the terms pill (read this before your first audit)

```
<View className='terms-page__banner'>          ← block container
  <View className='...-tag'>法律说明</View>      ← inline-flex, margin-bottom: 16rpx (dead)
  <Text className='...-title'>用户协议</Text>    ← inline (WeChat Text), no display:block
```

Intent (signaled by the pill's `margin-bottom`): pill on its own line above title.
Reality: one shared line, pill baseline-locked to its own small text → floats high.
Fix: `&__banner { display: flex; flex-direction: column; }` — the pill's `margin-bottom` becomes live again, and no pixel values change.

## Related

- [`../SKILL.md`](../SKILL.md) — audit workflow (Step 0 render gate) and review checklist
- [`../../mini-program-frontend-excellence/references/taro-ui-framework.md`](../../mini-program-frontend-excellence/references/taro-ui-framework.md) — write-time WXSS layout-semantics rules (L1–L5)
- [`../../frontend-design-audit/references/visual-correctness-gate.md`](../../frontend-design-audit/references/visual-correctness-gate.md) — Class A correctness rubric
