# Icebreaker L1 Pictogram & Copy Spec — Three-Layer Glance Stack + Handshake Bridge (Wave 0 Design Input)

**Date:** 2026-08-11 · **Status:** ✅ Brand/copy rulings LOCKED via grill-me round 2 (2026-08-11, see §8) — design-lead review remains for §8 Q1 (emblem scale) only · **Feeds:** iteration plan slices **S3** (Three-Layer Glance Stack) and **S8** (Handshake Bridge), per `docs/design/icebreaker-fluid-ux-iteration-plan-20260811.md` §3 · **Governing docs:** playbook `docs/design/icebreaker-fluid-ux-playbook-20260811.md` (§3 pillars, §5 zones, §10 rulings), `docs/copy/brand-copy-strategy.md` (copy law), `joyjoin-brand-guidelines` skill (visual referee)

> **Ownership boundary (playbook §9).** This spec owns *what* appears on each layer and *which words* are used. **Engineering owns** final dimensions, scale ratios, beziers, durations, gesture choice (hold-to-peek mechanics), and haptic waveforms. Nothing here prescribes pixels or curves.
>
> **Copy-tier convention.** Every proposed user-facing string carries its constraint tier from `docs/copy/brand-copy-strategy.md` §2: 🔴 hard rule (terminology / banned words / warmth), 🟠 permitted-with-framing, 🟡 should-follow (length, tone-mode fit), 🟢 creative latitude. Strings touching canonical terminology (局 / 桌 / 桌友 / 悦仔 / 破冰局 / 畅聊局 / 狂欢局 / 深聊 / 均衡 / 暢玩) are 🔴-governed by definition. **No emoji in any proposed string** (repo guardrail; brand uses `JoyJoinIcon`/CSS).
>
> **Phase inventory note.** `packages/shared/src/phaseRegistry.ts` ships **12** phase modules (11 playable + `phase_selection`); the session state machine adds `waiting` and `ended` (`SessionPhase` in `phaseUtils.tsx`). This spec covers **all 14 session surfaces**: 12 registry phases + `waiting` + `ended`, plus the `topic-card` sub-beat inside warmup. ("14 phases" in the Wave-0 brief = these 14 surfaces; `recap` is inside the registry dozen.)

---

## 1. L1 Signal — Per-Phase Table

L1 serves the **GLANCE** state: decodable in **0.5s at arm's length in dim light** (playbook §3.3/§3.7 squint protocol). One massive pictogram **or** one display word — never both, never more. Choice types:

- **(a) Reuse** — existing CDN emblem from `ICEBREAKER_PHASE_EMBLEM_ASSETS` / `PHASE_ICON_SRC_MAP` (`apps/mini-program/src/hooks/usePreloadCdnIcons.ts:98-110`, `apps/mini-program/src/pages/icebreaker-session/phaseUtils.tsx:27-40`). Sources are 240×240 WebP, transparent bg; `PhaseHeaderIcon` documents 240rpx as the current max sanctioned display size.
- **(b) New pictogram** — no usable asset exists; one-line visual concept logged in §2 as a future Lovart brief. **No asset filenames are invented here** — briefs only.
- **(c) Display word** — a single Chinese word, ≤4 characters, emotionally precise, `font-cn-display` (§3.1).

### 1.1 The table

| # | Phase (`id`) | CN label | GLANCE question it must answer | L1 choice | Copy tier | Notes |
|---|--------------|----------|-------------------------------|-----------|-----------|-------|
| 1 | `waiting` | 等待中 | "Has it started? What do I do?" | **(c) word「等人齐」** + optional 悦仔 `xiaoyue-waiting.webp` cameo (one-mascot rule) | 🟢 word; 🔴 悦仔 usage | This is the Handshake Bridge canvas (§6). A new ritual pictogram ((b), §2.1) may replace the word after design review. |
| 2 | `warmup` | 话题卡 | "We're talking — about a card." | **(a) `phase-warmup.webp`**; topic deal-flip sub-beat reuses **`phase-topic-card.webp`** (already in `PHASE_ICON_SRC_MAP`, absent from the emblem preload list — add to preload when it becomes L1) | 🔴 label 话题卡 | Two existing assets cover both warmup beats; no new art. |
| 3 | `micro_challenge` | 挑战 | "Do something together, now." | **(a) `phase-micro-challenge.webp`** | 🔴 label 挑战 | The challenge text is L2; the ACT「完成」tap is untouched by L1. |
| 4 | `lie_detective` | 谎言侦探 | "Vote — which one is the lie?" | **(a) `phase-lie-detective.webp`** (vote beat); reveal beat → shared word **「揭晓」** (§1.2) | 🔴 label; 🟢 reveal word | V2 tag-entry chips (S5d) live in ACT zone, not L1. |
| 5 | `undercover_word` | 谁是卧底 | "Describe out loud / vote." | **(a) `phase-undercover-word.webp`**; own-word card is a **private glance** (§4.2), not L1 | 🔴 label 谁是卧底 | Post-S5b the describe beat is verbal; optional turn word「说一说」🟢 reserved if field tests show the emblem doesn't read as "speak now." |
| 6 | `auction` | 拍卖 | "Bid now." | **(a) `phase-auction.webp`** | 🔴 label 拍卖 | Current bid + preset increment chips (S5a) are ACT content and stay visible; see §4. |
| 7 | `personality_dice` | 人格骰子 | "Pick a dare / get ready." | **(a) `phase-personality-dice.webp`**; reveal **countdown numeral as L1** (`font-en-brand` premium numeral — typography.md sanctions premium numerals "where visually appropriate"; this is the one sanctioned case) | 🔴 label 人格骰子 | Countdown replaces emblem for its duration; label「准备揭晓」🟢 demotes to L2. |
| 8 | `group_mirror` | 群像镜像 | "Who fits this best? Tap a face." | **(a) `phase-group-mirror.webp`**; optional word **「像谁」** held in reserve | 🔴 label; 🟢 word | Anonymity constraint (2026-08-03 audit) means no voter→target hints anywhere near L1. |
| 9 | `quip_battle` | 机智对决 | "Write one line, together, now." | **(a) `phase-quip-battle.webp`**; synchronized draft beat (playbook §10 ruling 5 spine) → word **「写一句」** | 🔴 label; 🟢 word | The ≤20s group draft beat is the only keyboard moment; its L1 is the word, the input sits in ACT. AI-rescue entry is private/player-only — never L1. |
| 10 | `speed_friending` | 快速交友 | "Rotate — new partner." | **(a) `phase-speed-friending.webp`**; rotation beat → word **「换一位」** | 🔴 label 快速交友; 🟢 word | Rotation is the beat the haptic carries; the word is the glanceable backup. |
| 11 | `mini_script` | 迷你剧本杀 | "We're inside a story — act N." | **(a) `phase-mini-script.webp`**; role card is a **private glance** (§4.2) | 🔴 label 迷你剧本杀 | 45-min narrative phase most strains the One-Glance rule; act transitions get the shared「揭晓」word at clue/solution reveals. |
| 12 | `recap` | 回顾 | "Look back together / share." | **(a) `phase-recap.webp`** | 🔴 label 回顾 | Recap is a sanctioned reading surface (share card, medal grid) — the One-Glance rule relaxes here by design; see §4.3. |
| 13 | `phase_selection` | 环节选择 | "Pick what we play next." | **(c) word「选环节」** | 🟢 | Host-facing admin-ish beat; word suffices, no art justified. If it proves player-visible in the field, revisit. |
| 14 | `ended` | 已结束 | "It's over — warmly." | **(c) word「下次见」** | 🟢 | Session-terminal warmth per copy 🔴 warmth rule; pairs with recap's coral bloom cooling back to beige. |

### 1.2 Shared reveal-beat word

Every phase with a synchronized reveal (lie_detective, undercover_word, group_mirror, quip_battle, mini_script, personality_dice post-countdown, recap headline) uses **one shared L1 word: 「揭晓」** (🟢, Social/Game tone mode), replacing the phase emblem for the ~2-second bloom. Rationale: playbook zone 4 is the one moment screens may command the room (collision-matrix cell 3 — aesthetic licensed to peak); a single learnable word across all reveals builds the same cross-phase literacy as the Reveal haptic. The phase emblem returns as the bloom settles.

### 1.3 Coverage summary

- **(a) Reuse existing emblem:** 11 of 14 surfaces (all playable phases + recap; warmup counts once with two assets).
- **(c) Display word only:** 3 surfaces (`waiting` 等人齐, `phase_selection` 选环节, `ended` 下次见).
- **(b) New pictogram needed:** 1 confirmed brief (Handshake Bridge ritual mark, §2.1) + 1 conditional (waiting-state pictogram, only if the 悦仔-cameo + word combo fails the squint test).
- **New-art total: 1–2 Lovart briefs.** Everything else rides shipped assets.

---

## 2. New-Art Briefs (Lovart, future)

Both briefs follow the brand illustration style lock (2D low-poly geometric, painterly facets, circular vignette, warm palette, purple `#8B5CF6` accent only — `references/mascots-and-illustration.md`) and must read as a **silhouette** at massive display size against both the cool-violet and warm-coral mood fields.

### 2.1 Handshake Bridge ritual mark (confirmed need)
**One-line concept:** six abstract low-poly glasses/hands meeting at a single warm-coral spark point inside a circular vignette — a "toast from above" that reads as *we begin together* at any size, with zero text and no mascot (the ritual opening is behavioral-cell per ruling 1; the mark must not upstage faces).

### 2.2 Waiting-state pictogram (conditional)
**One-line concept:** a small crescent-and-two-dots "gathering constellation" in cool violet-indigo with one facet warming to coral as seats fill — abstract enough to sit behind the「等人齐」word, legible as *almost ready* from silhouette alone. Commission only if §1.1 row 1 fails the squint test in the Wave 3 pilot.

---

## 3. L2 Script Treatment

### 3.1 Typography role assignment (binding within brand roles)

| Layer | Role | Face | Rationale |
|-------|------|------|-----------|
| **L1 word** (等人齐 / 揭晓 / 写一句 / 换一位 / 选环节 / 下次见) | `font-cn-display`, max size, heaviest loaded weight | AlimamaFangYuanTiVF-Thin via `Taro.loadFontFace` | typography.md: short, high-impact emotional Chinese; celebratory/reveal moments. Weight contrast via size + letter-spacing — **no CJK variable font** (playbook §3.5 platform truth). |
| **L1 numeral** (dice countdown) | `font-en-brand` | Quicksand / Outfit fallback | The single sanctioned "premium numerals" case. |
| **L2 script** (prompt, topic, dare, statement) | `font-ui`, comfortable reading size, regular weight | PingFang SC system stack | Functional reading for the one reader-aloud; display fonts are banned from body copy (typography.md key rules). |
| **L3 context** | `font-ui`, hairline micro-fragments, dimmed | System stack | Below reading size; never load-bearing. |

**Never** mix `font-cn-display` and `font-en-brand` on one screen (brand hard rule) — the dice countdown therefore *replaces* the emblem/word rather than coexisting with a `font-cn-display` element.

### 3.2 Quiet-contrast guidance

L2 must be effortlessly readable by the reader-aloud while **not pulling the listeners' eyes down** (playbook §3.7). Guidance (engineering owns exact values):

- L2 contrast sits *below* L1's full-saturation treatment and *above* L3's dimmed hairline — mid-weight against the mood field, no foil/halo, no accent color borrowed from L1.
- L2 never shares a line or visual band with L1; the tier separation must survive the 0.5s squint test.
- L2 text is **reader-facing, not audience-facing**: listeners decode the beat from L1 + mood field; nothing in L2 may be required to act (that is what L1 + haptics carry).
- Reader-aloud ergonomics: the reader holds the phone naturally at chest height; L2 stays within the upper-middle comfort band of the card. Exact placement is engineering's.

### 3.3 Example L2 fragments (by phase family)

Register: reader-aloud framing lines — punchy micro-copy, **fragments not sentences** (playbook §3.5), Social/Game tone mode (≤3 particles), imperatives ≤12 chars / descriptions ≤25 chars (🟡). Dynamic prompt content (topics, dares, statements) is generated by existing pipelines and unchanged; these are the **framing lines** that introduce it. All 🟢 unless flagged.

**Conversation family (warmup, speed_friending):**
- 「这张卡问我们——」 (warmup topic intro)
- 「聊聊这个」 (minimal variant)
- 「新同桌,新问题」 (speed_friending rotation — 🔴-compliant: 桌/同桌 canonical)

**Game family (micro_challenge):**
- 「一起来——」
- 「做完了点一下」 (pairs with the ACT「完成」target)

**Deduction family (lie_detective, undercover_word):**
- 「三句里,一句是假的」
- 「猜猜谁在编」 (🟡 12-char edge — verify)
- 「用你的词,说一句」 (undercover verbal describe, post-S5b)

**Competition family (auction):**
- 「这个,谁想要」
- 「出价,或者放手」

**Creative family (personality_dice, quip_battle, group_mirror):**
- 「选一个敢的」 (dice choose-mode)
- 「二十秒,写一句」 (quip draft beat — 🟡 verify length/rhythm aloud)
- 「谁最像这句话」 (group_mirror)

**Narrative family (mini_script):**
- 「第 N 幕,开演」
- 「读完你的角色卡」 (private-glance beat)

**Recap:**
- 「今晚的我们」
- 「带一张走」 (share-card CTA framing)

---

## 4. L3 Context Inventory

### 4.1 Per-phase demotion table

Elements below **demote behind hold-to-peek** (hairline, dimmed, blurred progressive disclosure; gesture is engineering's). Grounded in shipped code (`PhaseHeroCard` zones + per-phase hero views). "Pinned" = never demoted (§4.2).

| Phase | Demoted to L3 (behind peek) | Stays visible (not L1/L2) |
|-------|------------------------------|---------------------------|
| `waiting` | Joined count (`icebreaker__waiting-count` "X 位玩家已加入"), tier/vibe re-select affordance (`IcebreakerTierSheet` entry), host hint line | Handshake start CTA (host) — ACT |
| `warmup` | Presence strip avatars (`WarmupPresenceStrip`), mood label (搞笑/生活/轻松/情感), card position within the vibe's 4–7 card run | AIGC footer (pinned, §4.2); host mood-pick = host ACT tool (ruling 1: behavioral always, stays reachable) |
| `micro_challenge` | Roster dots + done/total (`doneCount`/`totalCount`), statusText | ACT「完成」button |
| `lie_detective` | Player chip「第 N / M 位玩家」, vote-accumulation dots, statusText | AIGC footer (pinned — AI statements); vote targets = ACT |
| `undercover_word` | Turn indicator, vote dots, statusText | Own word — **private glance** (§4.2); vote targets = ACT |
| `auction` | Lot chip「第 N / M 标」, bid history, coin balance | Current bid amount + increment chips = ACT context (hiding the price would break the mechanic — behavioral cell, ruling 1) |
| `personality_dice` | Player chip「N / M」, done/passed dots, statusText | Countdown numeral (it *is* the L1 during countdown); 3-option choose = ACT |
| `group_mirror` | Submitted dots, statusText | Nominee avatars = ACT |
| `quip_battle` | Card index「卡片 N/M」, submitted dots | Draft input (draft beat) + vote gestures = ACT; AI-rescue entry stays private/player-only |
| `speed_friending` | Round indicator, rotation timer hairline | Partner identity for the current round (names the person you're facing — hiding it fails the mechanic) |
| `mini_script` | Act indicator, ready dots「N/M 人已准备」, statusText | AIGC footer (pinned — AI story); role card = private glance; accusation picks = ACT |
| `recap` | Nothing demoted — recap is a reading surface (§4.3) | AIGC footer (pinned — AI summary); share CTA = ACT |
| `phase_selection` | Option metadata (durations, min players) | The options themselves = ACT |
| `ended` | — | Return/share CTA = ACT |

### 4.2 Elements that legally/contractually cannot hide

1. **AIGC disclosure row (`PhaseAigcRow` → `AIGCLabel` + `AIContentReportButton`).** When `aigcLabelsEnabled` is on and content meta marks AI generation, the「AI 生成内容」/「AI 辅助生成」label and the「反馈这段内容」report entry are regulatory disclosure surfaces (China AIGC labeling obligations) — they **pin below L3 as a quiet footer and never go behind hold-to-peek**. Fail-closed semantics are preserved: no meta, no label (curated fallbacks and user-authored content must never acquire the label). Copy is fixed by `AIGC_LABEL_COPY` (🔴 — do not reword in this spec).
2. **The single ACT target** of any state — never L3, by playbook definition.
3. **Host tools** (advance, generate, tier re-select) — behavioral cell of the collision matrix (ruling 1): reachable in one touch at all times; they may be visually quiet but never behind the peek gesture.
4. **Private-glance inversion (new pattern flagged here).** Hidden-role content (undercover own-word, mini_script role card) must be glanceable *only to the owner* — at a co-present table, an arm's-length GLANCE is visible to neighbors. Proposed treatment: hold-to-peek *inverted* — hidden by default, revealed to the holder on deliberate press, re-hidden on release. Design lead to confirm the pattern and its learnability cost (§8, Q2).

### 4.3 Recap exemption

Recap is the session's one sanctioned *reading* surface (IdentityReveal headline, share card, medal grid, V2 stats). The One-Glance rule relaxes: L1 emblem + L2 framing line still lead, but the stats grid renders as normal content, not peek-hidden L3. Justification: recap is post-loop — the POCKET→GLANCE→ACT loop has ended, eyes are already on each other, and the share card is a deliberate take-home artifact. Celebration/ParticleBurst stays within brand motion rules (no bounce).

---

## 5. Mood-Field State Fragments

Micro-copy paired with the three field states (playbook §3.4). Principle: **the field speaks first; copy is optional seasoning and must stay hairline/L3-grade** so the field never becomes a reading task.

| Field state | Palette (brand tokens) | Micro-copy (if any) | Tier |
|-------------|------------------------|---------------------|------|
| **Waiting** (cool violet-indigo; Primary Purple `#8B5CF6` + Sky Blue `#A8C5DD` derivative) | cool, serene | 「先聊着」 — hairline, fades once the field alone tests as sufficient | 🟢 |
| **Active** (field tightens as votes/dones accumulate) | neutral-warm transition | **No copy.** The tightening field + phase emblem carry the state; adding words here recreates the clutter we're removing | — |
| **Reveal-bloom** (Warm Coral `#FF9B85` family) | warm coral bloom, ~2s | 「一起揭晓」 — pairs with the shared「揭晓」L1 word and the group Reveal haptic;「一起」marks it as the synchronized group moment | 🟢 |

Notes: waiting copy is the only candidate that could survive as permanent; default assumption is the field alone suffices after learnability bedding-in (retire「先聊着」at the Wave-3 checkpoint if the squint protocol passes without it). No copy ever ships on the active field — silence is the design.

---

## 6. Handshake Bridge — Opening Ritual (S8 design input)

Behavioral-cell opening (ruling 1: first impressions are made by faces, not screens). The session's first screen never demands reading before the group has spoken; first content gates on all-joined + host's single touch. The phone's job: one ritual mark (§2.1) or the「等人齐」word, one host affordance, exact words for the group to say.

### 6.1 Candidate spoken rituals (exact words)

**Candidate A — 齐声开场 (unison countdown).** Host taps; all screens show「三、二、一」beat (numerals, `font-en-brand`) and the group says together:
> 「三、二、一——开聊!」 🟢
- *Pros:* zero preparation, works for shy tables, synchronizes the first group beat (the first time six pockets buzz together). *Cons:* slightly game-show; least personal.

**Candidate B — 碰杯开场 (toast).** Host taps; screen shows the ritual mark; anyone raises a glass and leads:
> 「这杯,敬新桌友——」 group: 「干杯!」 🟢 (🔴-compliant: 桌友 canonical)
- *Pros:* venue-native (cocktail in hand, playbook §3.6 litmus), physically eyes-up by construction. *Cons:* needs one willing lead; alcohol-optional venues need a glass-agnostic fallback (「碰个杯」works for tea).

**Candidate C — 名字接龙 (name relay).** Host taps; screen shows「我是 __ ,今天想聊 __ 」as the L2 scaffold; each person says their own:
> 「我是阿岚,今天想聊海。」 (per-person, name + one topic word) 🟢
- *Pros:* names are learned in the first 60 seconds — highest connection yield; feeds warmup. *Cons:* 6× turns is the slowest; risks reading-as-script if the scaffold is over-specified — the scaffold is a prompt, not a form to fill.

**Recommendation for review:** A as default (fastest to first group beat), B as the host-selectable alternative for glow/blaze tiers (bar venues), C reserved for 深聊 vibe where slowness is a feature. Final pick is the design lead's call after pilot observation (§8, Q3).

### 6.2 Host start affordance

- Primary CTA (single touch, solid `$color-primary` purple per CTA law): **「人齐了,开聊」** 🟢 (System UI tone, ≤12 chars).
- Secondary ghost link: **「再等等」** 🟢.
- Tier/vibe selection (破冰局/畅聊局/狂欢局, 深聊/均衡/暢玩 — all 🔴 canonical) remains available to the host but sits **outside the ritual path** (plan §S8 acceptance: admin stays reachable, never blocking the opening).
- The host's tap fires the first group beat (Nudge) — pacing reads as ritual, not admin work (playbook §2 host asymmetry).

---

## 7. Collision-Matrix Application Notes (playbook §10 ruling 1)

- **ACT inputs + host tools → behavioral always:** L1 spectacle never displaces, delays, or visually competes with the ACT zone. Auction price, vote targets, and the start CTA outrank any pictogram.
- **Ambient/GLANCE surfaces → behavioral-leaning, aesthetic capped at zero attention cost:** every (a) emblem reuse above is zero-new-attention (already-learned asset); new art is confined to the two §2 briefs.
- **Reveal/celebration beat → aesthetic licensed to peak:** the shared「揭晓」word + coral bloom + (future) synchronized Reveal haptic is the one licensed peak; nothing else in this spec spends that license.
- **Opening stays behavioral:** the Handshake Bridge ships word-or-mark + spoken ritual, no illustration showcase.

---

## 8. Review Resolutions & Remaining Questions

**🔴 brand/copy items — RESOLVED via grill-me round 2 with the product owner (2026-08-11):**
1. ~~Shared reveal word「揭晓」vs per-phase words~~ → **Shared「揭晓」ADOPTED.** One learnable cross-phase conditioned word, mirroring the Reveal haptic's one-pattern-one-meaning philosophy; phase identity returns with the emblem as the bloom settles.
2. ~~Three spoken-ritual candidates~~ → **Scene-split LOCKED:** A 齐声倒数 default; B 碰杯 host-selectable for glow/blaze bar venues; C 名字接龙 reserved for 深聊. Wave-3 pilot observation adjusts wording only, not selection.
3. ~~Host affordance pair~~ → **APPROVED as proposed:** 「人齐了，开聊」/「再等等」.
4. ~~Quip-battle AI-rescue labeling~~ → **Label follows content meta, never tool usage:** verbatim AI-substantiated submissions carry meta and show「AI 辅助生成」at reveal; edited/rewritten submissions are user-authored and unlabeled. Using the rescue is never itself visible. Consistent with the repo's per-content fail-closed AIGC regime.
5. ~~悦仔 waiting cameo vs one-mascot rule~~ → **Sequenced handoff, never coexistence:** the cameo owns waiting states; it yields to the ritual mark at the moment the host taps「人齐了，开聊」. The one-mascot rule holds on the time axis.

**Design-lead questions — status:**
- ~~Q2 (private-glance inverted-peek)~~ → **ADOPTED:** hold-to-reveal / release-to-hide for hidden-role content, reusing the L3 gesture vocabulary with inverted semantics; one-time teach cue at the first hidden-role moment. Gesture mechanics remain engineering's.
- ~~Q3 (ritual default strategy)~~ → resolved by brand ruling 2 above (scene-split, pilot observes).
- ~~Q4 (「先聊着」lifecycle)~~ → **Ship with S2, conditional retirement:** if the Wave-3 squint protocol passes without it, the word retires; the field alone carries waiting thereafter.
- ~~Q5 (`phase_selection` visibility)~~ → **ANSWERED from code:** it is a player-visible interstitial (`participation: 'observe_ok'`; state machine routes through it between phases, `phaseRegistry.ts:220`, `socialIcebreaker.ts:945-946`). The「选环节」word treatment stands as spec'd.
- **Q1 (emblem legibility at L1 scale) — STILL OPEN, routed to S3 spec phase:** 240px sources vs sanctioned 240rpx display; upscale-with-re-render via the CDN pipeline vs new renders; CDN manifest count implications. Engineering + design lead decision, no product ruling needed.

---

*DRAFT for design review. All strings proposed here are copy under `docs/copy/brand-copy-strategy.md` and carry their tier flags inline; none ship without the 🔴 review pass. Asset references point only to existing files under `apps/mini-program/src/pages/icebreaker-session/` and `apps/mini-program/src/hooks/usePreloadCdnIcons.ts`; new art exists solely as the two Lovart briefs in §2.*
