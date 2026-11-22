# 入场卡视觉优化规范 — Entry Card v2 (Front Face)

**Date:** 2026-11-22
**Status:** Design spec — not implemented. Ready for implementation hand-off.
**Owner:** UI/UX (designer seat) → implementation owned by Taro Engineer; token enforcement owned by ui-layout-audit; copy owned by joyjoin-brand-guidelines.
**Surface:** apps/mini-program/src/pages/onboarding/profile-review (the card itself, a.k.a. 入场卡)
**Files in scope:** pages/onboarding/profile-review/index.tsx (card JSX only), pages/onboarding/profile-review/index.scss, components/onboarding/InsightShareEntry.tsx + .scss (inline variant only), components/onboarding/InsightRevealCard.tsx + .scss (two ink tokens only)
**Files explicitly out of scope:** tab bar highlight bug, hero / spine / mascot blocks, 见面礼 card internals, ProfileArchiveSheet structure (only inherits tokens), the share-poster canvas.

---

## 0. Scope, job, and render evidence

**The single job of this screen:** confirm "this card is me" and hand the user to Discover. It is a keepsake to be approved, not a form to be completed.

**Render set used for this critique**

| Evidence | State | Label |
|---|---|---|
| User-supplied capture (375pt, post-reveal, archetype present, interests loaded, occupation present) | happy path | **Seen-in-render** (via supplied capture description) |
| loading / interests-error / interests-empty / no-archetype / no-occupation / 1-interest / long name / 320pt / reduced-motion | all others | **Read-in-code** |

No fresh capture was produced in this session (read-only mandate). Everything numeric below is either a repo token or a computed WCAG ratio — no eyeballed contrast. Before merge, a real capture set is required (see §11).

**Mode:** review (seven dimensions) + implementation spec (the optimised version).

---

## 1. Why it reads 单调 / 不精致 — six root causes

The feedback is not "add more stuff". It is "the card has no internal order". Six structural causes, in order of impact:

**R1 — Every container has the same visual weight.**
The card is a stack of near-white surfaces: card gradient (accent 0.24 to white 0.96), observation island (white 0.86), share pill (white 0.86), interest chips (primary 0.06 / 0.10), profile rows (transparent). Four of these sit inside ~0.10 alpha of each other. Nothing is foreground, nothing is background — so the eye finds no plane to rest on and the whole card reads as one continuous sheet. Refinement is *contrast of materials*, and there is none.

**R2 — The rhythm is uniform, so nothing groups.**
Section padding 16/24rpx, summary rows 88rpx, chip gaps 16rpx, island gap 16rpx. Almost every gap is 16–24rpx. The multiplier law (related gap g, next group at least 2g) is violated everywhere: siblings and chapters are separated by the same distance. Uniform spacing is the most reliable way to make a screen feel unfinished while every token is correct.

**R3 — There is no data graphic.**
The only visualised fact is a dashed circle holding a percentile. Interests — the one dimension with real stored granularity (level 1/2/3, heat 3/10/25, category heat) — are printed as three identical pills. A personalised card with zero encoding cannot feel designed; it reads as a form printed on tinted paper.

**R4 — Pill inflation.**
Archetype pill, three basic tags, intent chips, interest chips, share pill, edit affordance: eight pill-shaped objects at 22–24rpx. When everything is a pill, pill-ness stops carrying meaning, and the one element that should be a pill (the archetype seal) loses its status.

**R5 — Self-disclosure is subordinate to inference.**
职业 / 行业 / 学历 / 家乡 / 关系状态 / 人生阶段 all exist in the payload and are either folded into a card-back sheet or not shown at all. The AI paragraph is the largest text block on the card. The card promises "this distils you" and then shows the model's opinion before the user's own answers.

**R6 — Craft gestures are scattered, not systemic.**
Dashed hairline, dashed stamp circle, clip-path fold, shimmer sweep, quote glyph, citation dots — five different craft gestures, none repeated, so none becomes a language. Add the absolute-positioned stamp (a primary fact placed out of flow, which the repo retro already bans) and the card reads as decorated rather than composed.

The 颗粒度 complaint is R3 + R5 together: the data has levels; the card renders it flat.

---

## 2. Seven-dimension critique

Ratings: pass / minor / major. Every finding names its owner skill and file.

### 2.1 Visual hierarchy — **major**

| # | Observation | Problem | Fix | Pri | Route |
|---|---|---|---|---|---|
| F1 | Name 40rpx/900 and the reveal line 32rpx in display font sit within 8rpx of each other; the CTA is 96rpx solid purple. | Two loudest things inside one card; the eye has no entry point. | One display size only: name becomes 48rpx and nothing else in the card exceeds 32rpx. | P0 | wow-elements |
| F2 | The rarity stamp is absolute top-right, forcing a 140rpx right padding on the header. | A vanity metric occupies the primary optical corner and pushes the name off-centre; out-of-flow facts drift. | Move rarity into a below-name identity strip, right-aligned, in flow; delete the stamp. | P1 | ui-layout-audit |
| F3 | The observation island is the tallest and brightest block. | Inference outranks self-disclosure (R5). | Demote the island (radius 32 to 24, fill 0.86 to 0.72) and move the chapter below 小档案 / 想找 / 兴趣. | P0 | frontend-hook-engine |
| F4 | 小档案 collapses to one line (occupation · city) that is empty when occupation is missing. | The user's own onboarding answers are invisible on the card that is supposed to represent them. | New 小档案 chapter: role line + meta run (see §4.2). | P0 | frontend-hook-engine |

### 2.2 Brand consistency — **minor**

| # | Observation | Problem | Fix | Pri | Route |
|---|---|---|---|---|---|
| F5 | The card uses a 22rpx primary-coloured section label with a mascot glyph; the card back uses a 32×4rpx accent tick + 24rpx/600 title. | Front and back of the same object speak two heading languages. | One chapter-mark system across both faces: 32rpx mark slot + 24rpx/600 title, gap 16. | P1 | design-system-governance |
| F6 | Card theming is a 0.24 accent gradient shared with the results poster. | A pocket card reads as a full-bleed poster; small text loses contrast (see D5). | Card-local tint cap 0.18 (see §5.3); the poster keeps 0.24. | P1 | joyjoin-brand-guidelines |
| F7 | Rarity falls back to decorative English "JOYJOIN ORIGINAL". | Decorative English is an AI-slop tell and asserts a claim the user did not earn. | No rarity -> no rarity element at all. | P2 | joyjoin-brand-guidelines |

### 2.3 Composition — **major**

| # | Observation | Problem | Fix | Pri | Route |
|---|---|---|---|---|---|
| F8 | Chapter gaps (16rpx), row gaps (16rpx) and inner groups (16rpx) are identical (R2). | Nothing groups; the card reads as a list of unrelated objects. | Two-step rhythm: 8rpx inside a group, 40rpx between chapters, 32rpx before the footer. | P0 | ui-layout-audit |
| F9 | The bottom third is administrative: three bordered rows + 修改 links + a dog-ear, all at 88rpx. | The card ends in paperwork instead of a signature. | Replace the row strip with chapters; footer becomes one 88rpx row (share + card back). | P1 | ui-layout-audit |
| F10 | The share pill is centred inside the card. | Centred text inside an otherwise left-aligned card breaks the axis and adds a second white surface. | Footer row, left-aligned share action, no pill. | P1 | ui-layout-audit |

### 2.4 Typography — **minor**

| # | Observation | Problem | Fix | Pri | Route |
|---|---|---|---|---|---|
| F11 | 20 / 22 / 24 / 28 / 32 / 40rpx all appear inside one card; 20rpx is used for readable copy. | Six sizes for one card flattens the scale into noise; 20rpx is below comfortable reading for CJK. | Three-step scale inside the card: 48 display / 24–28 title-body / 22 meta. 20rpx only for the rarity label. | P1 | ui-layout-audit |
| F12 | The name uses the UI font at weight 900. | Synthesised 900 on PingFang/Android renders muddy; the brand display face is the card's voice elsewhere. | Name uses font-cn-display at 700/48rpx. | P2 | design-system-governance |

### 2.5 Colour — **major**

| # | Observation | Problem | Fix | Pri | Route |
|---|---|---|---|---|---|
| F13 | Interest chips print the label in the heat colour on a 12–16% tint of itself. Measured: L1 #A78BFA on its own 12% tint = **2.45:1**; L2 #8B5CF6 = **3.56:1**; L3 #F97316 = **2.39:1**. | The one place where heat is communicated is unreadable (needs 4.5:1 at 24rpx). Heat currently fails exactly where it matters. | Heat colour becomes **fill / graphic only**; label text stays ink-primary. Level is carried by bar length + level word + aria-label. | P0 | design-system-governance |
| F14 | Evidence caption and the muted feedback segment use $color-text-muted #9CA3AF (**2.65:1** on white). | Accessibility failure on 20–22rpx copy. | Swap to $color-text-secondary-on-light (#59616C, 6.46:1 on white). | P1 | InsightRevealCard.scss |
| F15 | The card inherits the 0.24 accent surface; at that tint $color-text-tertiary-on-light drops to **4.16:1**. | Small ink on a saturated wash falls under the floor even though the token is safe on light. | Two-ink rule on the card (primary + secondary-on-light) and a tint cap of 0.18 -> worst case 5.18:1. | P1 | ui-layout-audit |

### 2.6 Affordance — **minor**

| # | Observation | Problem | Fix | Pri | Route |
|---|---|---|---|---|---|
| F16 | 修改 is a 22rpx text link at the end of each row; 存下这张卡 and 完整小档案 are two different tappable shapes (pill + fold). | Three actions, three different affordance grammars in 200rpx. | One action grammar: chapter-head text actions (88rpx tap box) + one footer row of two labelled actions. | P1 | mini-program-frontend-excellence |
| F17 | The card body has no press or focus state; only the fold does. | Users cannot tell what is inert (99% of the card) vs actionable. | Declare the card body inert by composition: no hover anywhere except the two footer actions and the 修改 actions. | P2 | mini-program-frontend-excellence |

### 2.7 Information density — **major**

| # | Observation | Problem | Fix | Pri | Route |
|---|---|---|---|---|---|
| F18 | Trusted data density is low (1 fact line + 3 flat chips) while inference density is high (2–3 AI lines + evidence + feedback control). | The card is simultaneously thin and busy: thin on who I am, busy on what the model thinks. | Raise self-declared density (role line, meta run, 4 heat rows); keep inference at its current volume but demote its material. | P0 | frontend-hook-engine |
| F19 | Only rarity provides a quantitative anchor; total heat / total selections are absent (correctly, they are vanity numbers). | Users cannot sense how much of them is on the card. | Section meta 共 N 个 on the interest chapter (a count, not a score). Never render raw heat values (3/10/25). | P2 | first-principles-velocity |

**Verdict (pre-fix):** strongest dimension = brand palette (tokens are on-brand throughout). Weakest = composition and colour (uniform rhythm, contrast-invalid heat text). Stance: **fix-then-ship** — the card is functionally correct and blocked only on F13/F14 (contrast law) and F1/F3 (hierarchy law).

---

## 3. The optimised card — structure

One card, five chapters, one footer. Order goes most-trusted to most-inferred.

    Card  radius 40 / border 3 accentBorder / accentSurface (tint capped 0.18) / overflow hidden
    |
    +- Ch.1  IDENTITY            padding 24 24 0
    |    +- name                 48 / 700 / display font / ink-primary
    |    +- meta run             22 / 400 / ink-secondary        mt 8
    |    +- identity strip       seal (filled pill) .... rarity   mt 16, h 40
    |
    +- 40rpx
    +- Ch.2  小档案              padding 0 24
    |    +- chapter head         32rpx mark + 24/600 title .... 修改 (88 tap)
    |    +- role line            28 / 600 ink-primary  +  industry 28/500 ink-secondary
    |    +- meta run             22 / 400 / ink-secondary        mt 8
    |
    +- 40rpx
    +- Ch.3  想找                padding 0 24
    |    +- chapter head         .... 修改
    |    +- values run           24 / 500 ink-primary, dot-joined, max 2 lines
    |
    +- 40rpx
    +- Ch.4  兴趣热量            padding 0 24
    |    +- chapter head         32rpx mark + title .... 共 N 个
    |    +- 4 heat rows          48h, gap 8: label .. track(120x8) . level word(88)
    |
    +- 40rpx
    +- Ch.5  悦仔的观察          padding 0 24
    |    +- chapter head         24rpx mascot mark + title (keeps the attribution)
    |    +- observation island   radius 24 / padding 16 24 / surface 0.72  <- the only white
    |
    +- 32rpx
    +- FOOTER                    padding 0 24 24, h 88
         存下这张卡 (ink-primary) ........ 完整小档案 + fold

**Card height budget:** about 1250rpx at default data. Cap: 1280rpx. If a change pushes past it, cut a heat row, not a chapter.

**Ordering note (highest-risk change).** Moving 悦仔的观察 below 小档案 / 想找 / 兴趣 is what makes the card honest, but it moves the staged reveal further down the scroll. Gift timing keys off onAllRowsLanded (not layout), so behaviour is unchanged; only the perceived first view is. **Fallback if the team wants a one-step rollout:** ship chapters 1 / 2 / 4 plus the footer styling with the old order (observation stays above 小档案), then reorder in a second PR together with the source-lock test updates.

---

## 4. Block specification

All values are on the 8rpx grid unless marked geometry (hairline width, bar radius, bar proportion) where the value is dictated by the shape rather than the rhythm.

### 4.1 Identity band

Purpose: make the name the card's only display element, and fold the two identity-metadata facts (archetype, rarity) into one aligned strip instead of a floating sticker.

    .profile-review__id            padding: 24rpx 24rpx 0;
    .profile-review__id-name       font-family: $font-cn-display; font-size: 48rpx;
                                   font-weight: 700; line-height: 1.3;
                                   color: $color-text-primary;
                                   word-break: keep-all; overflow-wrap: break-word;
    .profile-review__id-meta       margin-top: 8rpx; font-size: 22rpx; line-height: 1.5;
                                   color: $color-text-secondary-on-light;
    .profile-review__id-strip      margin-top: 16rpx; display: flex; align-items: center;
                                   justify-content: space-between; gap: 16rpx; min-height: 40rpx;
    .profile-review__id-seal       display: inline-flex; align-items: center; flex-shrink: 0;
                                   max-width: 60%; padding: 4rpx 16rpx;
                                   border-radius: $radius-pill; border: 2rpx solid <accentBorder>;
                                   background: <accentSoft>;
    .profile-review__id-seal-text  font-size: 22rpx; font-weight: 600; line-height: 1.4;
                                   color: <accentText>;
                                   overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    .profile-review__id-rarity     display: flex; align-items: center; gap: 8rpx; flex-shrink: 0;
    .profile-review__id-rarity-label   font-size: 20rpx; color: $color-text-secondary-on-light;
    .profile-review__id-rarity-value   font-size: 22rpx; font-weight: 600;
                                       color: $color-text-secondary-on-light;

**Decisions**

- **The dashed rarity circle is deleted.** Two reasons: an absolutely-positioned fact violates the in-flow rule (repo retro: no absolute positioning for primary facts), and it forces a 140rpx right pad that visually unbalances the name. The charm is preserved by keeping the pair (seal + rarity) on one line — the card still has a stamp line, it is typeset instead of glued on.
- **Rarity renders only when rarityPercentage is a number.** No JOYJOIN ORIGINAL English fallback (F7).
- **One filled pill in the whole card** (the seal). The three basic facts (age / gender / city) become a dot-joined meta run: identical information, no chrome, and one pill regains meaning.
- **Seal left, rarity right** keeps the strip a single ledger line. Long archetype names ellipsis at 60% width; rarity never truncates.

### 4.2 小档案 — three candidates, one choice

The user's exact words: 专业职业什么也没有显示. The block must carry role, industry and enough texture to feel complete — without becoming a CV.

**Candidate A — 2x2 field grid** (label over value, four tinted cells; same as the card back).

| | |
|---|---|
| + | Dense, familiar, tolerant of long values, matches the card back |
| - | Four more near-white cells (re-introduces R1), two lines per fact (~200rpx), and the grid immediately reads as a form |
| Verdict | Rejected on the front face. It is the right pattern for the **card back**, where the user is in inspect-data mode. |

**Candidate B — role line + meta run (CHOSEN)**

| | |
|---|---|
| + | One emphasis line (职业 + 行业) states the professional identity as a headline — exactly the missing signal. A second line adds texture at meta weight. Zero chrome, survives value changes by wrapping, keeps a card rather than a form. |
| - | Requires truncation discipline (two lines, then wrap) and a dedupe rule against 人生阶段. |
| Verdict | **Chosen.** Highest signal per rpx, lowest chrome, and it makes 职业 the second-loudest element on the card after the name. |

**Candidate C — icon rail** (icon + label + value per row).

| | |
|---|---|
| + | Very scannable, generous tap comfort if rows become editable |
| - | No icon exists for 职业 / 行业 / 学历 in the icon registry; the fallback chain ends at an emoji, which CI bans on primary copy. Would require new assets, which the brief forbids. |
| Verdict | Rejected on asset grounds. |

**Spec**

    .profile-review__profile-role        font-size: 28rpx; font-weight: 600; line-height: 1.45;
                                         color: $color-text-primary;
                                         word-break: break-word; overflow-wrap: break-word;
    .profile-review__profile-industry    margin-left: 8rpx; font-size: 28rpx; font-weight: 500;
                                         color: $color-text-secondary-on-light;
    .profile-review__profile-meta        margin-top: 8rpx; font-size: 22rpx; line-height: 1.5;
                                         color: $color-text-secondary-on-light;

**Data contract**

- role = occupationLabel (already composes work mode: 创始人 · 咖啡师). If empty and lifeStage is 学生党, role = 学生 (a real role, not a placeholder).
- industry = industryLabel, appended after an 8rpx-spaced middot; omitted when empty.
- meta run = [lifeStage, hometownRegionCity, educationLevel, relationshipStatus] filtered, de-duplicated against role (substring), **first three only**, joined by a middot. 关系状态 is last because it is the most sensitive field; it appears only when it fits within the first three.
- If role, industry and every meta value are empty: **omit the entire chapter** (head included). Do not print 资料待补充 on a keepsake — that word belongs to the card back.

**What must NOT appear here:** birthday, phone, real name, industry restrictions, matching scores, AI-inferred profession, or any value sourced from the AI (self-declared facts only).

### 4.3 想找

    .profile-review__intent-values    font-size: 24rpx; font-weight: 500; line-height: 1.5;
                                      color: $color-text-primary;

- Values are the existing getIntentLabel outputs (max 3), dot-joined, wrapping to at most two lines.
- No pills. Intent is a statement of purpose, not a selectable set; pills made it look like a filter.
- Chapter is omitted entirely when there are no intents (current code already hides the row; keep that).
- Edit action in the chapter head (same as 小档案), aria-label 修改想找.

### 4.4 兴趣热量 — the granularity fix

This is the block that answers 兴趣没有对齐热度的颗粒度. The data already has three levels and three heat values; the card must show them **without ever printing a number**.

**Data contract**

| Field | Source | Use |
|---|---|---|
| label | selections[].label | Row label (ink) |
| level | selections[].level (1/2/3, server-normalised) | Bar length + level word |
| heat | selections[].heat (3/10/25) | **Sort only** — never rendered |
| topPriorities | response.topPriorities | Force level 3 when a label appears there |
| totalSelections | response.totalSelections | Chapter meta 共 N 个 |

Rows = selections sorted by level desc, then heat desc, then label; topPriorities labels are promoted to level 3; cap **4 rows**. Because the level is absolute (not normalised to the largest item), a user with only L1 interests sees 33% bars, not 100% — this is the honesty rule; no fake scaling.

**Row spec**

    .profile-review__heat               margin-top: 16rpx; display: flex; flex-direction: column; gap: 8rpx;
    .profile-review__heat-row           display: flex; align-items: center; gap: 16rpx; min-height: 48rpx;
    .profile-review__heat-label         flex: 1; min-width: 0; font-size: 24rpx; font-weight: 500;
                                        line-height: 1.4; color: $color-text-primary;
                                        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    .profile-review__heat-track         width: 120rpx; height: 8rpx; flex-shrink: 0;
                                        border-radius: 4rpx; overflow: hidden;
                                        background: rgba($color-text-primary, 0.08);
    .profile-review__heat-fill          height: 100%; border-radius: 4rpx;
                                        transform-origin: left center;
    .profile-review__heat-fill--l1      width: 33.333%; background: $heat-l1;
    .profile-review__heat-fill--l2      width: 66.666%; background: $heat-l2;
    .profile-review__heat-fill--l3      width: 100%;    background: $heat-l3;
    .profile-review__heat-level         width: 88rpx; flex-shrink: 0; text-align: right;
                                        font-size: 22rpx; line-height: 1.4; white-space: nowrap;
                                        color: $color-text-secondary-on-light;

**Level table**

| Level | Heat | Bar | Fill colour | Level word | Row aria-label |
|---|---|---|---|---|---|
| L1 感兴趣 | 3 | 33.333% x 8rpx | #A78BFA | 感兴趣 | 探店，感兴趣 |
| L2 很热衷 | 10 | 66.666% x 8rpx | #8B5CF6 | 很热衷 | 徒步，很热衷 |
| L3 必聊项 | 25 | 100% x 8rpx | #F97316 | 必聊项 | 私厨，必聊项 |

**Why the heat palette is not text.** Measured on their own tints: L1 2.45:1, L2 3.56:1, L3 2.39:1. Heat carries **three redundant channels** — bar length, bar colour and the level word — so colour is never the sole carrier; text stays in ink at 6.46:1. This also satisfies the no-colour-only accessibility requirement structurally, without adding another badge.

**Contrast note for the bars themselves:** #A78BFA at 2.78:1 against white is below the 3:1 non-text floor as a colour-only graphic; because length and the level word carry the same information, the bar colour is redundant decoration. Do not remove the length or the word.

**Alpha:** bar fills are full opacity (1.0), not tinted. An 8rpx bar at 12–16% alpha disappears on a tinted paper background. The chip alphas already in the system (0.12 / 0.14 / 0.16 fill, 0.28 / 0.35 / 0.42 border) remain correct for chips on the card back — they are not reused on the front card.

**Chapter meta:** right-aligned 共 N 个 (22rpx, ink-secondary). When N > 4 the card back is where the rest lives — do not add a 更多 link inside the card (it would compete with the footer's card-back entry).

### 4.5 悦仔的观察 — keep the peak, demote the material

- Chapter head keeps its mascot mark (the attribution is the persona; removing it would make the AI text look self-authored). The mark slot is 32rpx on both chapter kinds so **all chapter titles align on the same x** — the tick is 32x4rpx, the mascot glyph is centred inside a 32rpx box.
- Island: radius 32 -> **24**, fill rgba(surface, 0.86) -> **0.72**, border 0, no shadow. It remains the card's only white surface (the rule that fixes R1).
- Internal typography is unchanged — the reveal row keeps its display face and accent ink. This is the card's ceremonial beat and must not be diluted by a second competing animation.
- Two token fixes inside the component (P1 a11y, F14): evidence caption and the muted feedback segment move from $color-text-muted to $color-text-secondary-on-light. Nothing else in InsightRevealCard changes.

### 4.6 Footer — share + card back in one row

    .profile-review__card-foot        margin-top: 32rpx; padding: 0 24rpx 24rpx;
                                      display: flex; align-items: center;
                                      justify-content: space-between; gap: 16rpx; min-height: 88rpx;
    .profile-review__foot-share       flex: 1; min-width: 0; display: flex; align-items: center;
                                      min-height: 88rpx;
    .profile-review__foot-share-text  font-size: 24rpx; font-weight: 600; color: $color-primary;
    .profile-review__foot-back        flex-shrink: 0; display: flex; align-items: flex-end; gap: 8rpx;
                                      min-height: 88rpx; padding-left: 16rpx;
                                      margin-right: -24rpx;
    .profile-review__foot-back-text   font-size: 24rpx; font-weight: 600; color: <archiveAccentText>;
    .profile-review__archive-entry-fold  40x40 clip-path triangle (unchanged geometry)

- Share keeps InsightShareEntry behind the scenes (busy state, aria-disabled, generating copy) but gains a **variant='inline'** prop so it drops the centred pill. Default stays pill so nothing else changes. The component keeps ownership of the busy semantics; the page only supplies the layout.
- The card-back entry keeps the existing fold geometry — it is the card's one paper gesture and the only thing that says this object has another side.
- Both actions: haptics('light') on press (share already emits it; the fold already emits it), hoverClass pressed tint rgba(primary, 0.04).

### 4.7 见面礼 (outside the card)

Unchanged visually. Set the gap to **32rpx** (currently 24) so the gift reads as a separate object belonging to the page, not to the card. Do not bring it inside the card: the card is a keepsake, the gift is a transaction.

---

## 5. Token tables

### 5.1 Spacing (8rpx grid)

| Use | Value | Token |
|---|---|---|
| Card inner gutter | 24rpx | $spacing-md (canon compact-card padding) |
| Top padding of card | 24rpx | $spacing-md |
| Bottom padding of card (footer) | 24rpx | $spacing-md |
| Between chapters | 40rpx | $spacing-lg |
| Island to footer | 32rpx | structural breath (24 + 8), not a token |
| Chapter head to body | 16rpx | $spacing-sm |
| Inside a meta run / role to meta | 8rpx | $spacing-xs |
| Heat rows gap | 8rpx | $spacing-xs |
| Heat row height | 48rpx | 8 x 6 |
| Identity strip height | 40rpx | $spacing-lg |
| Footer row height | 88rpx | $cta-min-tap |

### 5.2 Type (three steps only)

| Role | Size | Weight | Family | Colour |
|---|---|---|---|---|
| Card name (display) | 48rpx | 700 | $font-cn-display | primary |
| Chapter title | 24rpx | 600 | $font-ui | primary |
| Role line | 28rpx | 600 | $font-ui | primary |
| Industry (same line) | 28rpx | 500 | $font-ui | secondary-on-light |
| Values (想找) | 24rpx | 500 | $font-ui | primary |
| Heat label | 24rpx | 500 | $font-ui | primary |
| Meta run / level word / rarity value | 22rpx | 400 | $font-ui | secondary-on-light |
| Rarity label | 20rpx | 400 | $font-ui | secondary-on-light |
| Footer actions | 24rpx | 600 | $font-ui | primary / accent |

Line-heights: 1.3 name, 1.4 titles and marks, 1.45 role, 1.5 meta runs, 1.4 single-line rows.

### 5.3 Colour — two inks on the card

| Role | Token | On white | On card tint 0.18 | Use |
|---|---|---|---|---|
| Ink 1 | $color-text-primary #2D3142 | 12.9:1 | 10.9:1 | name, titles, role, values, heat labels |
| Ink 2 | $color-text-secondary-on-light #59616C | 6.5:1 | 5.2:1 | meta runs, industry, level word, rarity |
| Accent ink | accentText | per archetype (contrast-safe token) | — | tick, seal text, fold, reveal row |
| Accent fill | accentSoft (0.12) | — | — | seal background only |
| Heat fill | $heat-l1 #A78BFA / $heat-l2 #8B5CF6 / $heat-l3 #F97316 | 2.8 / 4.3 / 2.8 | — | **bars only, never text** |
| Banned on card | $color-text-tertiary, $color-text-muted | 3.1 / 2.7 | below floor | — |

**Accent surface.** Keep the archetype gradient (it is the card's identity) but cap the top tint at **0.18** for the entry card. Rationale with numbers: at 0.24 a mid-tint archetype drops #626A75 to 4.16:1 and #59616C to 4.78:1 — the classic token-was-safe-the-surface-was-not failure. At 0.18 the same pairing is 5.18:1. Implementation options, in order of preference:

1. add accentSurfaceCard (0.18 / 0.97) next to accentSurface in pages/onboarding/personality-test/visuals.ts and use it only here;
2. build the same gradient on the page from visual.accent (one helper line);
3. if the team insists on 0.24, every 22rpx token on the card must be #59616C **and** the render must be sampled per archetype at 375pt and 320pt before merge.

**Accent role map (what each visual.* field is allowed to do on this card):**

| Field | Allowed use | Forbidden use |
|---|---|---|
| visual.accentSurface | card background only (tint capped 0.18) | text ink, borders, bars |
| visual.accentBorder | card border (3rpx) and seal border (2rpx) | dividers, chips, heat bars |
| visual.accentSoft | seal background only (0.12) | any text surface wider than the seal |
| visual.accentText | chapter tick, seal text, card-back fold ink, the reveal row | paragraphs, meta runs, anything under 22rpx |

This is the one value in this spec that needs design-system-governance sign-off.

### 5.4 Radius / border / shadow

| Element | Radius | Border | Shadow |
|---|---|---|---|
| Card | 40rpx ($card-radius-lg) | 3rpx accentBorder | keep existing |
| Observation island | 24rpx ($card-radius-sm) | none | none |
| Seal | 999rpx ($radius-pill) | 2rpx accentBorder | none |
| Heat track / fill | 4rpx (geometry) | none | none |
| Chapter tick | 999rpx | none | none |
| Text actions | 0 (no chrome) | none | none |

Exactly one bordered interactive control may exist inside the card (the feedback segments). No bordered non-interactive pill is allowed. No full-width hairline is allowed inside the card — chapter boundaries are made by 40rpx of air plus a mark.

---

## 6. States

Every state below is render-mandatory (capture one frame each). No state may render an empty container or a fabricated value.

| State | Identity | 小档案 | 想找 | 兴趣热量 | 观察 |
|---|---|---|---|---|---|
| Happy path | name + meta + seal + rarity | role + industry + meta | values | 4 rows | island |
| Interests loading | unchanged | unchanged | unchanged | head + **2 skeleton rows** (label bar 40% / 56% x 20rpx at ink 0.06; track 120x8 at ink 0.06), aria-busy, pulse 1.2s, no level words | island |
| Interests error | unchanged | unchanged | unchanged | head + 22rpx 兴趣热量暂时没读取到 + inline 重试 (24rpx primary, 88rpx tap) | island |
| Interests empty | unchanged | unchanged | unchanged | head + 22rpx 还没有兴趣标签，可在「我的」补充 | island |
| No archetype | name + meta only; strip not rendered | normal | normal | normal | legacy shape |
| No occupation | role falls back to 学生 when lifeStage says so, else chapter omitted | meta run only if any value | normal | normal | normal |
| Only 1 interest | normal | normal | normal | 1 row at its real level (never 100% unless L3) | normal |
| topPriorities without heat | — | — | — | level forced to 3, bar 100%, word 必聊项 | — |
| Long name | 2-line wrap, no ellipsis; strip moves down | — | — | — | — |
| Long role | 2-line wrap; industry wraps under it | — | — | — | — |
| Long interest label | 1-line ellipsis on label only | — | — | — | — |
| 320pt | rpx layout is proportional, no reflow needed. Real risks: tap size (88rpx = 37.5pt) and safe-area gutters | — | — | — | — |
| Large system font | every text block uses min-height, never a fixed height | — | — | level word 88rpx nowrap; label ellipsis absorbs the squeeze | — |
| Reduced motion | identical layout | — | — | bars static at final width, no stagger, skeletons static 0.88 | island static |

**Anti-fabrication rules:** no zero-value bars, no 0% rarity, no placeholder profession, no synthetic interests to fill four rows, no heat numbers, no averages or percentages the payload does not contain.

---

## 7. Motion (two, and only two)

The card already owns a ceremonial reveal inside 悦仔的观察. Adding more would make two peaks fight. So: one ambient motion (new) plus reuse of the existing press states.

**M1 — Heat bars grow (new, essential).**

    .profile-review__stage--visible .profile-review__heat-fill {
      animation: profile-review-heat-grow 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .profile-review__heat-row:nth-child(1) .profile-review__heat-fill { animation-delay: 0ms; }
    .profile-review__heat-row:nth-child(2) .profile-review__heat-fill { animation-delay: 60ms; }
    .profile-review__heat-row:nth-child(3) .profile-review__heat-fill { animation-delay: 120ms; }
    .profile-review__heat-row:nth-child(4) .profile-review__heat-fill { animation-delay: 180ms; }

    @keyframes profile-review-heat-grow {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }

- Trigger is the existing stage-visible class, not mount, so growth happens when the card actually appears.
- transform only (no width animation) — GPU safe per the repo WeChat discipline.
- Total choreography 180 + 420 = 600ms, finishing before the insight reveal's first LLM row lands, so the two never compete for attention.

**M2 — Card-back fold press (keep).** Existing 180ms scale / rotate press. No change.

**Explicitly rejected:** a third animation (seal pop, rarity count-up, chapter fade-ups). The insight reveal is the card's emotional peak; the stage system already fades chapters in.

**Reduced motion.** Bars render at final width with no animation and no delay; skeletons hold a static 0.88 opacity. Extend the existing page-level prefers-reduced-motion kill list with the heat fill.

**Haptics.** No new haptics on the card (it is read-only). The footer share and the fold keep their existing light haptic.

---

## 8. Anti-AI-slop checklist (binding for this card)

| Forbidden | Why | Instead |
|---|---|---|
| Stacking identical pills for different data types | R4 — pill-ness stops meaning anything | one filled pill (the seal); everything else is type |
| Any new gradient | The card already has one authored surface | solid inks, alpha fills 0.04–0.12 |
| Decorative English (ORIGINAL / PREMIUM / EDITION) | Slop tell plus a claim the user did not earn | omit the element when data is absent |
| Emoji or a new icon per fact | No icons exist for 职业 / 学历; the fallback ends in emoji | 32rpx mark slot, tick for facts, mascot for voice |
| Over-rounding (everything at 999rpx) | Pills everywhere read as toy UI | 40 card / 24 island / 4 bar / 999 seal only |
| Centring inside the card | Breaks the card's single left axis | left-aligned; centring is reserved for the completion overlay |
| Fake data bars / normalising heat to the max | A single L1 interest must not draw a full bar | absolute level encoding |
| Numbers the user cannot act on (raw heat 25, total heat) | Vanity metric, already demoted once | 共 N 个 count only |
| A second white surface | R1 | one island only |
| Full-width hairlines inside the card | Filing-cabinet look | 40rpx air plus a chapter mark |
| Motion on the card besides M1 and the existing reveal | Two peaks cancel out | nothing else |

**Keepsake test (three questions before merge):** (1) Would a user screenshot this and send it to a friend without editing? (2) Does it still read as one object rather than a settings page? (3) Can you name the card's single loudest element in one second? If any answer is no, cut; do not add.

---

## 9. Implementation mapping

### 9.1 New BEM blocks (page SCSS)

| Block | Elements | Notes |
|---|---|---|
| profile-review__id | __id-name, __id-meta, __id-strip, __id-seal, __id-seal-text, __id-rarity, __id-rarity-label, __id-rarity-value | replaces __poster-header / __poster-header-row / __stamp |
| profile-review__chapter | __chapter-head, __chapter-mark (tick or icon slot), __chapter-title, __chapter-action, __chapter-meta | shared by chapters 2–5 |
| profile-review__profile | __profile-role, __profile-industry, __profile-meta | chapter 2 |
| profile-review__intent | __intent-values | chapter 3 |
| profile-review__heat | __heat, __heat-row, __heat-label, __heat-track, __heat-fill (--l1/--l2/--l3), __heat-level, __heat-skeleton | chapter 4; keep inline in the page |
| profile-review__card-foot | __foot-share, __foot-share-text, __foot-back, __foot-back-text | reuses __archive-entry-fold |

Every new class needs its rule in the same PR (BEM class-coverage gate).

### 9.2 Deprecations (delete in the same PR)

__stamp, __stamp-text, __poster-tags, __poster-tag, __poster-tag-text, __summary, __summary-row, __summary-label, __summary-value, __summary-edit, __summary-chips, __summary-chip (and --accent), __summary-chip-text, __summary-placeholder, __archive-entry and __archive-entry-text (folded into __foot-back), __interest-conclusion, __interest-stats (and --demoted), __interest-stat, __interest-value, __interest-label, __chip-group, __interest-story-pill (and icon/text), __interest-skeleton, __skeleton-line, __skeleton-chip-row, __skeleton-chip, __interest-placeholder*, __interest-error*, __archetype-summary, __info-grid, __info-block, __info-dot, __info-label, __info-value, __info-caption, __info-annotation, __intent-wrap, __intent-chip, __intent-chip-icon, __intent-chip-text.

**Do not delete:** __section, __section-label, __section-label-icon, __section-label-text, __ai-tag* — they are still rendered by InsightRevealCard's legacy branch and by the mascot chapter head. These are page classes referenced from inside a component; renaming them is a two-file edit and must not be attempted casually.

After deletion, regenerate the orphan baseline: node scripts/check/check-class-coverage.mjs --write-baseline.

### 9.3 Where styles live

- **All new blocks -> pages/onboarding/profile-review/index.scss.** This is a subpackage page: component SCSS must be @use'd into the page file (AGENTS §15) and component TSX must not side-effect-import its SCSS.
- **Heat rows stay inline in the page.** Do not extract an InterestHeatRows component: a new component inside the subpackage risks the manualChunks route into sub-common.wxss, which no page loads and which fails verify:subpackage-styles.
- **InsightShareEntry** gains variant='inline' with its rules in InsightShareEntry.scss (already @use'd by the page). Default pill preserves current behaviour.
- **InsightRevealCard** keeps ownership of its own rules; the page does not override them. Only the two ink tokens change (F14).
- **InterestChipCloud** is no longer rendered by the front card (the card back still renders it). Do not remove its @use from ProfileArchiveSheet.scss or from the page chain — the sheet depends on it. The component also side-effect imports its own SCSS, so it is currently double-owned; leave that as-is in this PR.

### 9.4 Page JSX changes (minimum set)

1. Build interestHeatRows (label, level, id) from selections plus topPriorities; keep the existing interestLevels map for the sheet.
2. Build profileMetaRun per §4.2 (dedupe, first three).
3. Replace the poster header / stamp / summary blocks with chapters 1–5 plus the footer.
4. Re-index the stage classes so the stagger still runs top to bottom (0.04s steps): id=3, profile=4, intent=5, heat=6, insight keeps its internal sequence, footer=7.
5. Do not touch: reveal gating, gift timing, analytics event names, completion flow, or the poster builder input. 小档案 fields must stay structurally excluded from the canvas in lib/onboarding/insightPoster.ts.

---

## 10. Accessibility

- **Tap targets:** every tappable element is at least 88rpx tall — footer share (flex 1), footer card-back, chapter 修改 actions (min-height 88 with a negative vertical margin so the 48rpx head keeps its height while the tap box overflows into the 40rpx chapter gap; precedent: ProfileArchiveSheet __close).
- **Text contrast:** two inks only, both measured above 4.5:1 on the capped tint (§5.3). No 20–22rpx copy in tertiary or muted.
- **Not colour-only:** heat rows carry level in the row aria-label (探店，感兴趣), in the visible level word, and in bar length. Removing colour from the screen must still leave the level legible.
- **Semantics:** each chapter is a group with an aria-label equal to its title; the heat block is role='list' with role='listitem' rows; the seal carries aria-label 原型 人脉蛛; rarity carries aria-label 稀有度 前 6%.
- **Reduced motion:** M1 disabled, skeletons static, no stagger (§7).
- **Reading order** matches visual order; no absolutely positioned facts remain.

---

## 11. Acceptance checks (render-verifiable)

Capture both faces at 375pt and 320pt, plus every state in §6 (loading / error / empty / 1-interest / no-occupation / long name / reduced motion).

1. Exactly **one** text at 48rpx; nothing else in the card exceeds 32rpx.
2. Exactly **one** filled pill (the seal) and **one** bordered interactive control (feedback segments) inside the card.
3. Exactly **one** light surface inside the card (the observation island).
4. Zero full-width hairlines and zero absolutely positioned facts inside the card.
5. All chapter titles share the same left x (32rpx mark slot + 16rpx gap); the tick and the mascot glyph align.
6. A user whose interests are all L1 still shows 33% bars (screenshot the state; do not trust the code).
7. Sample four text runs (name, role, meta, level word) against the tinted card at its top-left and bottom-right; all >= 4.5:1.
8. The card's bottom edge shows two actions on one 88rpx row; no centred pill remains.
9. Reduced motion: bars appear at final width with no growth and no stagger.
10. npm run build:weapp -w mini-program and npm run verify:subpackage-styles -w mini-program -> no non-empty sub-common.wxss; npm run guardrails clean.

---

## 12. Risks

1. **Ordering vs the reveal choreography.** Moving 悦仔的观察 below three chapters changes where the staged reveal lands on screen. Behavioural contracts (onAllRowsLanded, gift delay, share visibility) key off data, not layout, so they are safe — but any test asserting DOM order or the old class names (__summary, __poster-header) will fail, and the gift may appear while the reveal is off-screen. Mitigation: land styling first with the old order, reorder in a second commit together with the source-lock assertions, and capture the new scroll position at 375pt.
2. **Token and class churn inside a subpackage.** The redesign deletes about 35 class rules and adds about 20. Two gates watch this: check-class-coverage (ratchet baseline) and verify:subpackage-styles (chunk routing). Deleting rules is safe; adding a class without its rule, or moving rules between files, is not. A component SCSS reached by two page entries is hoisted to common.wxss and charged against the 2MB main package. Mitigation: keep the heat block inline in the page, never side-effect-import SCSS from a component, and run both gates before merge.
3. **Per-archetype seal contrast.** The seal prints accentText on accentSoft; accentText is tuned for light surfaces and the 12 archetypes have different hues. One render per archetype (or a sampled four) is required before merge; if any falls under 4.5:1, drop the seal fill to 0.08 and keep the border.

---

## 13. Open questions for the owners

- **joyjoin-brand-guidelines:** is 共 N 个 acceptable as the interest chapter meta, or should it read 兴趣热量 · 8? Copy is not this seat's call.
- **ui-layout-audit:** confirm 24rpx card padding (compact) over 40rpx for a keepsake card, and confirm 32rpx as a permitted structural gap between island and footer (it is 24+8, not a token).
- **design-system-governance:** approve accentSurfaceCard (0.18) as a new archetype visual field, or accept the 0.24 surface with a mandatory per-archetype contrast sample.
- **taro-engineer:** can the footer host InsightShareEntry variant='inline' without a layout jump when the busy copy (正在生成…) swaps in? If not, reserve the text width with min-width.

---

## 14. v2.1 追加层（2026-11-22，已实现）

- **兴趣结构一句话**：热度行之后新增 `热量集中在 美食小酌 · 文艺现场`，取 `categoryHeat` 前 2 个宏类别，只在已有兴趣行时出现；不新增条形、不显示总热量。
- **相处方式一行**：小档案内新增 `相处方式：热情亲近 · 活跃外放`。数据来自已登录的 `GET /api/assessment/result`（最新一次已完成 V4 测评，0–100 trait 向量）；最多 2 条，按 `|score − 50|` 取最显著项且阈值 ≥8，高分用 `highEndLabel`、低分用 `lowEndLabel`；不显示分数、不做雷达图；404 静默隐藏。
- **高度记账**：上一节实算 ≈1,570rpx 是 v2 基线；v2.1 两行都出现时约 +66rpx（实际 ≈1,636rpx）。1280 上限已在 P0-3 删除；仍不建议再加层。
- **反 AI 味文案**：排桌提示主句改为 `兴趣、性格和想找，会用来帮你找到同频的一桌`，副句改为 `职业和背景，会用来把不同圈子的人搭在一起`；不新增手势动画，保留既有按压/触感。
- **验证**：personality helper 6 + interest helper 7 + page-transition 7 测试通过；typecheck、build、verify:subpackage-styles、guardrails 通过。
- **待真机复核**：320/375pt 下两行出现后的卡高与滚动位置；测评查询晚到时相处方式行的入场是否造成跳动；长 trait 标签在 320pt 下是否折行。

---

## 2026-11-22 紧凑高级感整合（复审追加，Read-in-code）

- **卡高口径修正：** 实算 ≈1,570rpx（1,410–1,690 区间），"约 1,250 / 上限 1,280" 作废；代码没有 `max-height`。4 行热度 = +306rpx，1280 与 4 行热度互斥；要一屏只能移一章去卡背，不是继续调间距。
- **分段拆解：** 身份 199 / 小档案 176 / 想找 126 / 兴趣热量（4 行）306 / 悦仔的观察 607（岛内 528）/ 卡脚 152 / 边框 6。
- **平面分离：** 观察岛落到 0.72 填充 + 24rpx 圆角，读作"纸上的注释块"，不再称"卡内唯一白岛"；不为分离加边框或阴影。
- **一条纵轴：** 四个章节头统一 40rpx 高、24rpx 标记槽（tick 条仍 4rpx / 吉祥物 24rpx）、头底 16rpx；观察章节标签同 40rpx / 16rpx。标题共享同一 x 与基线（+约 30rpx）。
- **卡脚只留一个主作用：** 存下这张卡 24/600 primary；完整小档案降为 22/500 accent；折角是唯一纸感，不再当第二按钮；可点区仍 88rpx。
- **卡外排桌参考：** 只留 4rpx 竖线，删填充/圆角/上下内边距/字距，三行统一 22rpx；两句文案一字不改。
- **身份带三级：** 48 名字 / 24 原型印 / 22 元信息与稀有度（印 24rpx + 行高 1.3，零增高）。
- **已修 a11y：** 观察岛「来自你的选择」说明 20rpx 由 muted 改为 secondary-on-light（2.65:1 → 6.46:1）。
- **本轮不动：** 章节顺序与章数、两套墨色、热度只做填充、卡内无全宽分隔线、全卡一枚实心 pill、reveal/gift/share/隐私契约。
- **渲染验收（未做，必须补）：** 375pt 与 320pt 各一张"卡全高"、一张"卡脚特写"、一张"全 L3 四行满条"、一张浅色原型下的观察岛边界。
