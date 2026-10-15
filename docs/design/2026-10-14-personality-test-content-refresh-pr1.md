# Personality Test Content Refresh — PR1 Copy Review (Spine)

> Status: **PR1 SHIPPED 2026-10-15** — the copy gate closed with the §8 owner decisions (2026-10-14);
> the Tier-3 Sprint Contract is LOCKED (`.git/.orchestration/sprints/sprint-contract.20261014_personality_content_pr1.md`)
> and the bank edits + P0 content-experience guardrail are merged (`5a08f7ba7`). This doc is now
> reference material for PR2, not a pending approval.
> Date: 2026-10-14 · Scope: PR1 of the 2-PR content pass (PR2 = tail re-dress, follow-up).
> Grill-locked decisions: full content pass; 4/9 anchor re-dress; freeze policy A; copy-first gate;
> Q51_PureX exception; P0 guardrail (sidecar map + contract test); PR1 green before PR2 starts.
> Writing protocol: `joyjoin-brand-guidelines` voice + de-AI 三遍法 (adapted from
> `flash-story-writing/references/de-ai-check.md`) + per-item face-validity check against frozen options.

---

## 1. What PR1 changes (and what it must not)

| Layer | PR1 change |
|---|---|
| `scenarioText` | **5 items re-dressed** (Q1, Q2, Q5, Q6 anchors + Q51_PureX calibration) |
| `questionText`, option text, trait scores | **Frozen** (Q51 exception resolved to scenario-only — §5) |
| `category` | **Untouched** — drives idle-whisper pools client-side; no client change needed |
| Engine / matcher / config / closings | Untouched; anchor IDs, count, order unchanged |
| P0 guardrail | New sidecar registry + contract test (green on merge) |

The user-facing effect: the guaranteed 9-anchor spine previously lived in one life domain
(peer group social events; invite motif visible twice). After PR1 the spine spans
**8 distinct domains** and the invite-style decision structure appears once.

## 2. Guard-tested constraints for every rewrite

1. **Scenario only.** Option text and scores byte-identical to today.
2. **Face validity.** The re-dressed scenario must keep *every* frozen option a natural
   answer — checked option-by-option below.
3. **Length.** New scenario target ≤ 30 code points (all five comply: 29/27/19/26/27). The
   operative check is the client's 2-line clamp (`MascotQuestionHeader.tsx:33-38`) verified in
   DevTools — current anchors range 14–35 (Q1=33, Q2=35), so length alone was never the guard.
4. **de-AI 三遍法.** ① word scan (no 意识到/其实/本质上/评价副词), ② sentence shape
   (concrete nouns, no psychological summary), ③ read-aloud as a real 25–30yo, ④ concreteness
   (a specific moment someone could photograph — no abstractions).
5. **Voice.** Warm, playful, premium, inclusive (`joyjoin-brand-guidelines`). No system-admin tone.

---

## 3. Copy review

### 3.1 Q1 — anchor · X/C/E · category `社交启动` (unchanged)

**Domain:** `community` 邻里/新环境 · **Motif:** `spontaneous_invite_join`

| | |
|---|---|
| OLD scenario | 工作日傍晚，同事群里突然有人发起：今晚有人想一起去新开的居酒屋吗？ |
| NEW scenario | 搬来新家的第一周，邻居在电梯里问：楼下小馆聚餐，一起来吗？ *(29)* |
| questionText | 你的第一反应和接下来的行动会是？ *(unchanged)* |

Frozen options + face-validity check:

| Opt | Text (frozen) | Loading | Face-valid in new scenario? |
|---|---|---|---|
| A | 好呀！正好想去看看！ | X+3 O+3 P+1 | ✓ spontaneous join; "想去看看" = check out the new neighborhood |
| B | 今晚吗？我看看安排... | C+2 | ✓ schedule-checking before committing |
| C | 谢谢！我约了朋友，下次叫我～ | A+3 | ✓ graceful decline, warm, already committed |
| D | 今天有点累...你们玩得开心！ | X−2 P−1 | ✓ tired decline, polite |

De-AI report: word scan clean; concrete nouns (电梯 / 小馆 / 聚餐); read-aloud natural;
no psychological summary. Motif eliminated: invite is from **neighbors in a new home**
(new-community bonding), not friends inviting to an event.
Review alternative (your pick): 楼栋群版 — 「搬来新小区的第三天，楼栋群里有人喊：楼下小馆聚餐，一起来呀？」(30). Review round 1 (PM) prefers the elevator variant: in-person, photographable, and structurally distinct from Q3's group-invite beat.

### 3.2 Q2 — anchor · O/C/X · category `决策参与` (unchanged)

**Domain:** `work` 职场协作 · **Motif:** `group_leisure_decision_role`

| | |
|---|---|
| OLD scenario | 大家讨论周末活动：剧本杀、Livehouse、清吧聊天、密室逃脱... |
| NEW scenario | 同事们商量团建去哪：剧本杀、露营、密室逃脱、K歌... |
| questionText | 你更愿意扮演什么角色？ *(unchanged)* |

| Opt | Text (frozen) | Loading | Face-valid? |
|---|---|---|---|
| A | 我都可以！哪个都好玩！ | O+2 P+1 C−2 | ✓ easygoing contributor |
| B | 我查下距离和评分，做比较表？ | C+4 O−2 | ✓ the planner of the group |
| C | 要不试试最特别的那个？ | O+2 P+1 | ✓ novelty seeker |
| D | 我想去能安静聊天的地方。 | E+3 O−2 | ✓ prefers a calmer venue |

**Deviation note (needs your sign-off).** The locked sketch proposed Q2 → 独处热爱/个人探索,
but option D (“能安静聊天的地方”) requires companions — a solo frame breaks face validity
under the freeze policy. Substitute: work/team-building, which closes the **work-domain gap
in the spine** (18 work items exist in the bank; zero in the spine today). Solo-passion moves
to the PR2 tail where it is unconstrained.

De-AI report: plain sentence, native listing rhythm; no AI-isms.

### 3.3 Q5 — anchor · X/A/E · category `团体形象` (unchanged)

**Domain:** `family` 家庭 · **Motif:** `group_photo_role`

| | |
|---|---|
| OLD scenario | 朋友聚餐后要拍合影发朋友圈。 |
| NEW scenario | 家里难得聚齐，长辈张罗着拍一张全家福。 |
| questionText | 你会？ *(unchanged)* |

| Opt | Text (frozen) | Loading | Face-valid? |
|---|---|---|---|
| A | 主动当摄影师，指挥大家站位 | X+3 P+2 A−2 | ✓ takes charge of the moment |
| B | 把站边缘的人拉进来，照顾每个人 | A+4 | ✓ notices the cousin standing aside |
| C | 找个位置站好，配合大家 | E+3 | ✓ compliant, easy |
| D | 站最边上，尽量不抢镜 | X−2 P−2 | ✓ self-effacing |

Keeps the locked sketch's family target for Q5. Emotional register upgrade: 全家福 is
warmer and more resonant than a friends' dinner photo; the A-anchor signal ("照顾站边缘的人")
is if anything stronger in a family frame.

De-AI report: 张罗着 is colloquial; no season lock (avoids 春节-only relevance); read-aloud natural.

### 3.4 Q6 — anchor · O/A/C · category `优化倾向` (unchanged)

**Domain:** `digital_life` 数字生活 · **Motif:** `optimization_disclosure`

| | |
|---|---|
| OLD scenario | 去探店的路上，你发现有条更近、人更少的路可以走。 |
| NEW scenario | 群里刚商量好聚餐的店，你刷到附近一家评分更高的新店。 *(26)* |
| questionText | 你会怎么做？ *(unchanged)* |

| Opt | Text (frozen) | Loading | Face-valid? |
|---|---|---|---|
| A | 立刻在群里@组织者，提出优化建议 | O+3 X+1 A−1 | ✓ public initiative with the find |
| B | 私聊组织者，委婉地提供信息 | A+2 C+2 | ✓ tactful private suggestion |
| C | 算了，按大家的来 | E+1 O−1 | ✓ conformity, avoids friction |
| D | 只告诉身边一两个人这个发现 | O−1 | ✓ selective sharing |

De-AI report: 刷到 / 附近 are native lexical items; concrete moment; no AI-isms.
Review round 1 revision: stakes lowered from「已订好 → 建议换店」to「刚商量好」(PM HIGH risk:
construct drift) and the coupon texture dropped (brand/commercial-texture flag).
Domain gained: digital life (first in spine).

### 3.5 Q51_PureX — calibration (pure-X) · category `纯X矩阵` (unchanged)

**Domain:** `social_initiation` · **Motif:** `stranger_approach_response`

| | |
|---|---|
| OLD scenario | 周末你没有任何计划，朋友临时约你参加一个全是陌生人的聚会。 |
| NEW scenario | 周末独自看展，几个陌生人来搭话，问你要不要加入一起逛。 *(27)* |
| questionText | 你的真实感受是？ *(unchanged)* |

| Opt | Text (frozen) | Loading | Face-valid? |
|---|---|---|---|
| A | 太好了，认识新朋友是最开心的事！ | X+2 | ✓ enthusiasm for unknown people |
| B | 有点兴趣，正好周末没事可以去看看 | X+1 | ✓ mild openness (“去看看” = join the stroll) |
| C | 犹豫，不太确定能不能融入全是陌生人的场合 | X0 | ✓ hesitancy about fitting into a stranger group |
| D | 完全不想去，和一群陌生人社交很消耗能量 | X−3 | ✓ avoidance; “去” still refers to joining |

**Exception resolution (needs your sign-off).** The locked plan granted a minimal option-D
rewording. On drafting, the new scenario (strangers in a shared public activity invite you
to join them) keeps **all four options face-valid with zero option edits** — the exception
is no longer needed. This is strictly better for measurement safety. Proposed downgrade:
**scenario-only, no exception.**

De-AI report: 搭话 / 看展 concrete; no AI-isms. Review round 1 revision: dropped 聊得投缘 —
it pre-warmed the approach stimulus and risked X inflation on this calibration item (PM);
cold-approach wording keeps a purer X signal. The user-flagged screen (friend + strangers +
party) is fully retired.

---

## 4. Anchors kept unchanged

| Anchor | Why it stays |
|---|---|
| Q3 个人计划 vs 朋友聚会邀请 | The single surviving invite-tradeoff item; best-written of the cluster; strong X/C/E tradeoff |
| Q4 桌游教学 | Game/learning domain; not part of the invite motif |
| Q7 生日礼物 | Relationship-care domain; distinct decision structure |
| Q8 团队竞赛 | Competition domain; options reference 对方组 (frozen) — frame must stay |
| Q150 买错票 | Travel domain; pure-E anchor added 2026-09 |

Spine domain coverage after PR1: community · work · relationships (Q3 tradeoff + Q7 care) ·
play/learning · family · digital · competition · travel = **8 distinct domains across 9 spine
items** (Q3 and Q7 share the relationships domain).

## 5. P0 guardrail spec (ships in PR1, green on merge)

New module `packages/shared/src/personality/contentExperienceMap.ts` — sidecar metadata,
**not** part of the engine type:

```ts
export type ContentDomain = 'social_initiation' | 'community' | 'family' | 'work'
  | 'friendship' | 'play_learning' | 'digital_life' | 'competition' | 'travel'
  | 'solo_passion' | 'values' | 'money' | 'imagination' | 'nature_city';
export type ContentMotif = /* decision-structure tags, starter set in §3 */ string;
export const CONTENT_EXPERIENCE_MAP: Record<string, { domain: ContentDomain; motifs: ContentMotif[] }>
```

New test `personality/__tests__/contentExperienceGuardrail.test.ts`:

1. **Tagging completeness** — every question in `questionsV4` has an entry (fails when item #178
   is added untagged).
2. **Spine coverage** — anchor set (`ANCHOR_QUESTION_IDS` + `CALIBRATION_QUESTION_IDS` +
   `UNIVERSAL_CLOSING_QUESTION_IDS`) covers ≥ 5 domains.
3. **Spine motif cap** — no motif appears > 1× in the spine.
4. **Bank motif cap (ratchet)** — per-motif count ≤ a recorded baseline this PR; tightened
   to ≤ 4 in PR2 after the tail pass removes the invite-clone cluster.

Full 177-item tagging is mechanical (auto-drafted, ambiguous items spot-reviewed during
implementation). Motif taxonomy is decision-structure level, not raw-situation level —
e.g. Q1 `spontaneous_invite_join` ≠ Q51 `stranger_approach_response` ≠ Q3 `plan_vs_social_invite`.

**Review round 1 hardening (PM, required before merge):**

- `ContentMotif` must be a **closed union / const array** with an allowlist test — free-string
  motifs would pass the caps vacuously.
- **Bidirectional completeness:** bank→map *and* map→bank (stale tags fail).
- **Ratchet the spine coverage threshold to the achieved value** (8 distinct domains) — a
  regression toward the 5-domain minimum must fail, not pass.
- Record the **PR1 bank-cap baseline value** in the test/doc (PR2 tightens to ≤ 4).
  *Ratchet semantics: the cap starts at today's measured per-motif count and may only tighten;
  any motif growing beyond its recorded baseline fails CI. Same pattern as
  `scripts/check/class-coverage-baseline.json`.*

## 6. Files touched / not touched

**Touched:** `questionsV4L1.ts` (4 scenario strings: Q1/Q2/Q5/Q6) · `questionsV4L2.ts`
(1 scenario string: Q51_PureX) · new `contentExperienceMap.ts` · new guardrail test ·
`feedback.ts` (one-line Q5-A commentary fix — owner-approved 2026-10-14).
**Not touched:** `adaptiveEngine.ts` · `types.ts` · option text/scores · `category` ·
`questionsV4*.ts` other modules · server · mini-program.

Per-option commentary (`feedback.ts`) — review round 1 verified Q1/Q2/Q5/Q6 entries remain
scenario-coherent except Q5-A's pre-existing mismatch (「自然就站到了中间位置」 for the
photographer option). **Approved fix:** → 「自然就站到了掌镜的位置，控场不需要宣布。」

## 7. PR1 verification (expected results)

| Check | Expectation |
|---|---|
| `npm run test -w @joyjoin/shared` | all pass incl. new guardrail |
| `npm run gate:assessment` | PASS 9 / KNOWN-FAIL 3 / REGRESSION 0 (unchanged) |
| `npm run simulate:personas:run:ci` | 12/12 |
| `tsx scripts/simulate/audit-question-bank-bias.ts` | scoring geometry identical; only report text lines for the 5 ids change |
| `npm run guardrails` | pass |
| WeChat DevTools | 5 re-dressed items render within the 2-line clamp (no client code changed) |

### Post-launch measurement & rollback (review round 1 — required before merge)

The harness cannot see semantics, so the re-dressed items get an explicit observation plan:

- **Option distributions:** capture pre-refresh baselines for the 5 ids from `assessment_answers`;
  re-check at T+7d / T+14d after each environment ships them. Alarm on per-item distribution
  shift beyond a locked band.
- **Engagement guardrail:** completion rate + 换一题 skip usage on re-dressed ids vs baseline
  (existing analytics: `question_answered` carries `questionId`+`dwellMs`; skip events tracked
  in `personality-test/index.tsx`). Trigger: completion drop > 3pp or skip-rate doubling on a
  re-dressed item.
- **Archetype sanity:** cohort archetype share vs pre-refresh within ±3pp.
- **Rollback:** content-only git revert (no flag, no schema). P0 = revert immediately on a
  trigger; P1 = observe 48h; P2 = tolerate. Owner: product owner + analytics.

Honest framing: the harness answer model is text-blind, so simulation proves **no scoring
drift**; *semantic* face validity is what this review doc certifies. PR1 code edits begin only
after (a) this doc is approved and (b) the Tier-3 Sprint Contract is ACK'd.

## 8. Decisions — RESOLVED 2026-10-14 (owner)

1. ✅ **Copy v2 signed off** (elevator Q1, stakes-lowered Q6, cold-approach Q51).
2. ✅ **团建 kept** as Q2 framing (obligation texture accepted with monitoring).
3. ✅ **Q51 exception downgraded** to scenario-only, no option edits.
4. ✅ **Bank motif cap: hardened baseline ratchet** (closed union + bidirectional + recorded
   baseline; PR2 tightens to ≤ 4).
5. ✅ **Q1 = 电梯版**; 楼栋群 retained in doc as alternative only.
6. ✅ **Q5-A feedback fix included in PR1** (one line, exact replacement in §6).

Copy gate closed → Tier-3 Sprint Contract drafted, verifier-reviewed (ACK-with-amendments,
7 applied), **LOCKED**: `.git/.orchestration/sprints/sprint-contract.20261014_personality_content_pr1.md`.

## 9. PR2 preview (not in this PR)

Tail re-dress (~15–20 items): solo passion (music/games/craft), family/family-chat,
money/取舍, imagination/humour, city/nature exploration, old-friends reunion (the parked
Q5-reunion candidate), invite-clone de-duplication (Q61/Q78/Q82/Q119/Q128 — Q119/Q128 carry
`targetPairs`, semantics locked), plus option copy polish under the per-item checklist.

**PR2 target: merged before the launch build cut for the 2026-11-09 深圳 soft launch**
(`docs/deliberations/2026-10-12-launch-timetable-cold-start.md`). PR2 starts only after PR1
merges green. PM note: option copy polish must not ride as cosmetic — option edits need their
own measurement plan and copy gate.

## 10. Review round 1 (2026-10-14)

- **PM agent — approve-with-changes.** Copy set accepted (Q1/Q5/Q51 strongest; Q2/Q6 accepted
  after revisions above). Required before merge: guardrail hardening (§5), length-rule
  reconciliation (§2), feedback.ts coherence check (§6), post-launch measurement + rollback
  (§7), docs-sync ACs. Residual risks accepted with monitoring: perceptual invite count
  stays 2 (Q1+Q3) until PR2; Q2 workplace-obligation texture; Q51 cohort-item framing — all
  logged.
- **Commercialization memo (CEO lens) — approve; ship PR1+PR2 before the 深圳 launch.**
  The test is the mandatory top-of-funnel gate before the monetization chain; the refresh is a
  cheap content lever on activation and matching-data quality ahead of 2026-11-09. North star
  for this work: personality-test completion rate (no baseline yet — capture pre-merge).
  Guardrails: skip/dwell + option-distribution drift + archetype sanity (§7). Content-only
  revert. Full 7-section memo delivered in session.
- **Docs-sync ACs (required in PR1):** `docs/systems/PERSONALITY_TEST_SYSTEM.md` stale Q51 row
  + anchor-count references; `idleWhispers.ts` category comment; this doc persisted as the
  grill-decision audit trail.

## 11. Implementation evidence (PR1 — 2026-10-14)

| AC | Evidence |
|---|---|
| AC1 copy | `git diff` on the two bank files = exactly 5 changed lines, each `scenarioText`; strings match doc §3 v2 verbatim |
| AC2 registry | `contentExperienceMap.ts`: 177/177 bank ids tagged, bidirectional check clean, closed domain + motif unions, 43 motifs |
| AC3 guardrail | `contentExperienceGuardrail.test.ts` 7/7 pass; baselines: anchors 8 domains, spine 10 domains, spine motif dupes 0; caps = recorded 2026-10-14 counts. Negative-path proof: Q42 tag removed → 1 failed / 6 passed; restored → 7/7 |
| AC4 feedback | `feedback.ts` Q5-A → 掌镜 line; no other entries touched (single-line diff) |
| AC5 gates | shared 506/506 · `typecheck` all 4 workspaces clean · `gate:assessment` **PASS 9 / KNOWN-FAIL 3 / REGRESSION 0 (identical to pre-change baseline captured same day)** · `simulate:personas:run:ci` 12/12 · bias audit regenerated (geometry untouched — scenario-only diff; report artifact refreshed, was stale vs bank) · `guardrails` PASS (5 pre-existing warnings, unrelated) |
| AC6 baseline | local DB reachable, `assessment_answers` total = 0 rows → below ≥30/item threshold → **fallback of record: T+7 read is the baseline**; query recorded: `SELECT question_id, selected_option, count(*)::int AS n FROM assessment_answers WHERE question_id IN ('Q1','Q2','Q5','Q6','Q51_PureX') GROUP BY 1,2 ORDER BY 1,2;` (run 2026-10-14, N=0) |
| AC7 docs | `PERSONALITY_TEST_SYSTEM.md:358` Q51 row + `:1057` anchor-conflation note updated; `idleWhispers.ts` untouched (expected zero diff — categories unchanged) |
| AC8 device | **PENDING — manual**: DevTools screenshot of the 5 re-dressed items within the 2-line clamp |

**Change-set note:** the working tree also contains pre-existing WIP from other workstreams
(profession overlay, results share, server routes, etc.). The PR1 change set is exactly:
`questionsV4L1.ts` · `questionsV4L2.ts` · `feedback.ts` · `contentExperienceMap.ts` (new) ·
`contentExperienceGuardrail.test.ts` (new) · `PERSONALITY_TEST_SYSTEM.md` (2 lines) · this doc ·
`scripts/simulate/data/question-bias-audit.json` (regenerated artifact).
