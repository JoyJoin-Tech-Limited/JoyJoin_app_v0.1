# Registration Ceremony Spec — 「订座」感官编舞 (V1)

> Status: Active spec for the P1「订座」narrative rework of the pool-registration flow.
> Date: 2026-08-17. Owner: mini-program registration surfaces.
> Governing narrative: the user is not filling a form — they are reserving a seat
> (「订座仪式」). Every sensory decision below serves one question: does this moment
> help the user feel the seat becoming theirs?

---

## 1. Narrative Spine (four acts)

| Act | Surface | Story beat | User emotion |
|-----|---------|-----------|--------------|
| 1. 看场子 | Step 0 (hero → 悦仔的信) | "这场局是什么气质，有没有你的位置" | 向往 |
| 2. 留座 | Steps 1–2 (预算 + 期待) | "告诉悦仔你想怎么坐" | 参与、被照顾 |
| 3. 订座确认 | 确认弹窗 → 票卡支付 | "撕下副券，座位写你的名字" | 承诺 |
| 4. 等开席 | 成功仪式 → matching-status | "票根收好，悦仔去请你的桌友" | 期待 |

Module keep/drop test for any future change: **does this module help the user reserve
the seat, or does it help the system collect data?** Data-collection modules get
demoted (pill / collapsible / post-commitment), never equal billing with the story.

## 2. Haptic Grammar

Uses the shared `haptics()` helper (`apps/mini-program/src/lib/utils/haptics.ts`)
exclusively — never raw `Taro.vibrateShort` in page/component code. One celebration
pattern only, borrowed from `SOCIAL_HAPTIC_GRAMMAR` so the two ceremonies never
develop divergent "voices".

| Moment | Pattern | Helper call | Notes |
|--------|---------|-------------|-------|
| Option select (ChoiceCard / chip) | tick | `haptics('light')` | instant, every tap |
| Step advance / step back | light | `haptics('light')` | wired 2026-08-17 (P0) |
| Form first becomes submittable | success | `haptics('success')` | existing; do NOT upgrade to celebration — keep the climax scarce |
| Confirm-modal row reveal | light, staggered with rows | `haptics('light')` | paired with the check-pop timeline |
| Confirm CTA (锁定席位) | medium | `haptics('medium')` | commitment weight |
| Submit/register failure | warning | `haptics('warning')` | the only long buzz on the registration side |
| **Payment verified / seat stamped** | **celebration** | `socialHaptics('socialCelebration')` | rising three-pulse; fires exactly once, at the moment the 已留座 seal lands |
| Success-page CTA | medium | `haptics('medium')` | leaving the ceremony |

Rules:
- Celebration is rare by design (one per completed registration). If a surface wants
  a second "big" haptic, the answer is no — demote to `medium`.
- Busy-guard: `socialHaptics` already arbitrates overlaps; never bypass it with raw
  vibration calls.
- The haptic must fire on the *visual* beat (seal landing), not on the network
  response — poll completion → render seal → fire haptic in the same commit.

## 3. Motion Grammar

| Moment | Motion | Duration / easing | Fallback |
|--------|--------|-------------------|----------|
| Step forward / back | `--forward` / `--back` slide (existing classes) | existing values; do not speed up | `reduceMotion` → instant swap (existing) |
| Confirm modal rows | staggered check-pop (existing timeline) | existing | rows appear without stagger |
| Seal 「已留座」 | CSS scale-in stamp (0.92 → 1.0, slight overshoot ≤1.04, no bounce loop) | ~320ms ease-out | static seal |
| Ticket stub tear-off | translate + rotate along existing perforation, fade | ~450ms | stub simply absent |
| Confetti (legacy TicketSuccessView) | being replaced by seal + tear-off in Phase 4 | — | — |

Motion principles (brand): gentle, premium, no bouncy loops, one focal animation per
screen at a time. During the seal moment, nothing else on the screen animates.

## 4. Degradation Ladder

1. `shouldReduceMotion` (user OS setting) → all motion instant; haptics still fire
   (they carry the beat when visuals can't).
2. `deviceTier.isDegradation` → same as reduce-motion for non-essential animation;
   celebration haptic still fires.
3. Vibration API unavailable → `haptics()`/`socialHaptics()` silently no-op (already
   built in); never let a haptic failure block a CTA.
4. Merged patterns, never complicated ones — if a new moment needs a pattern, first
   try to reuse an existing row of this table.

## 5. Copy & Brand Constraints (binding)

- Terminology: 局 / 桌友 / 悦仔 / 入座 / 留座 / 席位. The 订座词族 (订座/留座/入座/席位)
  is approved for this flow and registered in `docs/copy/brand-copy-strategy.md` §3.
- 🔴 banned on all surfaces: 算法 / 权重 / 评分 / 智能匹配 / mechanism-explaining copy.
- Real numbers only (🔴 social-proof rule): 「已有 N 人入座」「你是第 N 位入座的人」
  must come from live `registrationCount` / persona snapshot queries.
- Payment / error / refund copy: Tone Mode System UI, zero sentence-final particles
  (🟡 trust-sensitive). Celebration surfaces may use 悦仔 Voice.
- One mascot per screen (brand red line) — Step 0 condensing must not leave
  hero persona + letter card + duo card mascots visible simultaneously.

## 6. Surface Ownership (P1 phases)

- Phase 1 (this spec + Step 0 condense): spec is law from 2026-08-17.
- Phase 2 (4 steps → 3): stepper labels and step transitions follow §2/§3.
- Phase 3 (`ReservationTicket` shared component): confirm modal / payment ticket /
  success render ONE component with slots; information is spoken once per ceremony.
- Phase 4 (`RegistrationSuccessCeremony`): seal + tear-off climax per §3; replaces
  the three divergent success surfaces; entitlement users get the full ceremony
  (no more toast-only success for our best users).

## 7. Governance

- Any new registration/payment surface must cite this spec in its PR description.
- Changes to this table require updating the spec in the same PR (docs-sync rule).
- Harness gates that enforce this spec's mechanics: BEM class-coverage,
  subpackage style-splitting verify, `useResetOnShow` for transient flags,
  no hooks below early returns, `reduceMotion` fallback on every new animation.
