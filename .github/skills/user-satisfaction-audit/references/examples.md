# Worked Examples

## Example 1 — Squad unboxing reveal (mini-program, emotional peak)

**Persona:** B — 回流用户, third day after registration, opening the "你的桌友来了" notification on the metro.
**Surface:** `pages/squad-unboxing/index`, revealed state, 4-member group, H5 render + WeChat DevTools screenshot.
**Visual Gate:** 0 Class A defects; one craft note (chemistry chip contrast on cream gradient).

### Narration (abridged)

1. I tap the notification and the gift box is already open — cards are mid-deal, sliding up one by one. I stop walking. ✦
2. I see four face-up cards in a fan. I instantly get it: "these are my people tonight". ✦
3. I read the title bar: `第2组 · 一拍即合 · 你的桌友来了`. I understand `第2组`; I wonder what `一拍即合` measures. ⚡ (minor)
4. I tap the second card. It lifts. The detail panel opens below with our connection points. I read all three pills without re-reading. ✦
5. I reach the `今晚这桌` brief: big day numeral, `周六 · 19:00`. I understand the date instantly. ✦
6. I read the venue row: name + `复制` chip + `场地已确定`. I re-read once — is `场地已确定` a status or an action? ⚡
7. I see the 团魂 bubble typing out. I wait for it to finish. I smile at the archetype mix line. ✦
8. I see `确认出席`. I know exactly what happens next. I tap it. The Xiaoyue success overlay plays. ✦

**Friction log:** ⚡ Beat 3 (chemistry word unexplained), ⚡ Beat 6 (status chip ambiguity).
**Delight log:** ✦ Beats 1, 2, 4, 5, 7, 8.
**Exit risk:** none observed.

### Scores

| Angle | Score | Evidence |
|-------|-------|----------|
| 1 — 3-second clarity | 4 | Beats 1–2: purpose and cast understood mid-animation |
| 2 — Cognitive smoothness | 2 | Beats 3, 6: two re-reads on meta/status copy |
| 3 — Holistic cleanliness | 4 | Squint test: fan + one panel + one dock; nothing competes |
| 4 — Emotional resonance | 4 | 情绪价值 composite 21/24 (仪式感 4, 惊喜感 4, 归属感 3) → 4; beats 1, 7 |
| 5 — Return hooks | 3 | `确认出席` plants tonight's commitment; no post-event thread shown |
| 6 — Share-worthiness | 4 | Beats 2, 4: imagined caption "我今晚的局 😳"; cards survive thumbnail |

**Total: 21/24 — 爱不释手.**

### Verdict

- **Share it?** Yes — the fan is the screenshot.
- **Return tomorrow?** Yes — attendance committed, event pending.
- **Recommend it?** Yes, with the exact beat-1 moment as the pitch.
- **Pay because of it?** Likely — the reveal justifies the ticket retroactively.

**Ship verdict: SHIP**, with two non-blocking P1 fixes routed to owners:
- Chemistry word tooltip or one-line gloss on first reveal → `frontend-hook-engine` (comprehension) + copy via `joyjoin-brand-guidelines`.
- Venue status chip reworded to plain sentence (`地点已定：{venue}`) → `ui-layout-audit` follow-up.

---

## Example 2 — Counter-example: generic event list (what 用完即走 looks like)

**Persona:** A — 首见用户 from a shared link.
**Surface:** hypothetical events list: 8 identical cards, each with title, date, price, a purple gradient, and "立即报名".

1. I land on a wall of purple cards. They all look the same. I don't know which one is for me. ⚡
2. I read three titles. They all say "周末交友局". I can't tell them apart without opening each. ⚡
3. I see prices. I don't know what I'm paying for yet. ⚡
4. Nothing here knows anything about me. I feel like I'm browsing a coupon app. ⚡
5. I scroll to the bottom. Nothing changes. I leave. ⚡⚡

| Angle | Score | Evidence |
|-------|-------|----------|
| 1 | 2 | Purpose clear ("pick an event"), next action unclear (which one? why?) |
| 2 | 2 | No comprehension effort, but no comprehension *support* either — identical cards force open-and-check loops |
| 3 | 2 | Even spacing, zero hierarchy; 8 equal shouts |
| 4 | 1 | 情绪价值 composite 6/24 → 1; no belonging, no identity, no ceremony |
| 5 | 0 | Beat 5: user leaves with nothing pending |
| 6 | 1 | Nobody screenshots a coupon wall |

**Total: 8/24 — 划走.** Verdict: do not ship; redesign around persona (archetype-aware entry card, one recommended pick, one "why this one for you" line) → route to `frontend-hook-engine` for CTA hierarchy + `pm-sin-mapper` for discovery strategy.
