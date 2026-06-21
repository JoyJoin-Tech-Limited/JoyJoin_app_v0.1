# JoyJoin Mini-Program 文案策略

> Brand-governed copy strategy for production-facing mini-program 文案.
> Last updated: 2026-05-15
>
> **Audience:** AI Agent (primary) + human editors/copywriters.
> **Scope:** All user-facing text in `apps/mini-program` and `packages/shared`.

---

## 0. Pre-Implementation: 48h Copy Audit

Before Phase 1, run a full-string audit:

1. Scrape EVERY user-facing string from `apps/mini-program/src/` and `packages/shared/src/`
2. Tag each by Surface, tone, and emotional temperature (1-5 scale)
3. Identify top-5 worst offenders by user impact (most visible, coldest-sounding)
4. Fix those 5 inline (no infrastructure needed) to validate approach
5. Pull CS tickets for copy-related user confusion → quantify baseline

Only proceed to Phase 1+ if the audit confirms systematic inconsistency > isolated bad strings.

---

## 1. Tone Mode: Surface ↔ Tone Mapping

One tone does NOT fit all surfaces. Three tonal modes, each with a distinct register:

### Tone modes

| Mode | Tone | 语气词密度 | 人称 | 适用场景 |
|------|------|-----------|------|---------|
| **System UI** | Warm neutral — friendly but efficient | 0-1 | 你 | Buttons, toasts, nav titles, settings, error toasts |
| **悦仔 Voice** | Full 闺蜜 — warm, playful, characterful | ≤3 | 你们/你 | 悦仔 dialogue, match explanations, loading whispers, recommendations |
| **Social/Game** | Playful banter — in-character, low-stakes humour | ≤3 | 你/大家 | Dice dares, vote/reveal, auction banter, phase intro |

### Surface allocation table

| Surface | Tone Mode | Example |
|---------|-----------|---------|
| Button labels, nav tabs | System UI | "保存修改" |
| Toast error (7-12 chars) | System UI | "没成功，再点一次就好" |
| Full-page error | 悦仔 Voice | "悦仔遇到点小麻烦，再试试看~" |
| Empty state | 悦仔 Voice | "悦仔还没找到适合你的活动，先逛逛发现页？" |
| Loading whisper | 悦仔 Voice | "有人和你一样讨厌香菜·正在揭晓中…" |
| 悦仔 tier recommendation | 悦仔 Voice | "想聊得深一点、找到同频的人？这个适合你们！" |
| Archetype compatibility | 悦仔 Voice | "哎呀妈呀两个脑洞王级选手碰一块儿了！" |
| Dice dare / pass lines | Social/Game | "我选择做一只安静的柯基。" |
| Vote / reveal copy | Social/Game | "猜猜是谁在说谎~" |
| Payment confirmation | System UI | "支付成功，权益已确认" |
| Payment error | System UI | "没成功，再试一次即可" |
| Ban / suspension notice | System UI (formal) | No particles, clear reason + next steps |
| Refund info | System UI | Formal-warm, reference order number |
| Legal / terms | System UI (formal) | Properly formal, no particles |

### Usage

Every copy template must declare its `toneMode` metadata. In code:

```typescript
interface CopyTemplateMeta {
  toneMode: 'system-ui' | 'yuezai-voice' | 'social-game';
  surface: string; // human-readable surface name
}
```

---

## 2. Four-Tier Constraint System

### 🔴 Hard Rule — Violation = Blocked

**Absolute banned words:** `LLM / 算法 / 权重 / 评分 / 数据` (when referring to internal mechanism)

**Forbidden principle:** "No explaining the machine."
- ❌ "根据您的数据，系统为您推荐…"
- ❌ "匹配算法计算后"
- ✅ "悦仔悄悄看了一眼，觉得你们会合得来"

**Core terminology is mandatory:** See §3. No legacy identifiers.

**All copy must have warmth:** Pure machine-style `"失败，请重试"` is never allowed. Every string must inject its tone mode's temperature.

**Social-proof metrics must be real:** Never fabricate popularity numbers, user counts, percentages, or rankings in user-facing copy.
- ❌ "已有 10,000+ 人加入"
- ❌ "93% 的用户都说好"
- ❌ "本周最受欢迎的局"
- ✅ "已有 128 人感兴趣" (when backed by a live query)
- ✅ Omit the metric and lead with value instead

### 🟠 Orange — Permitted with Required Framing

| Word | Allowed in | Banned in |
|------|-----------|-----------|
| 匹配 | "匹配偏好", "匹配设置" (user-facing value statements) | Describing internal mechanism ("匹配算法") |
| AI | Honest disclosure when explicitly asked ("悦仔是 AI 驱动的") | Proactive炫耀, feature names |
| 推荐 | "悦仔推荐…" (personified) | "系统推荐…", "算法推荐…" |
| 智能 | "智能匹配" is banned entirely; use "悦仔配对" or similar | — |

When using an 🟠 word, the surrounding sentence must frame it in social-experience terms, not technical terms.

### 🟡 Should Follow — Violation Requires Waiver

- **Sentence length:** Imperatives ≤ 12 chars, descriptions ≤ 25 chars
- **Error surfaces:** Toast errors → System UI (7-12 chars, no mascot). Full-page errors → 悦仔 Voice (with mascot)
- **Empty states:** MUST include action guidance, not just安慰. Prefer 悦仔 Voice
- **Payment / trust-sensitive copy:** Use System UI tone. 安全感先导. No `~`, `啦`, `哦` on unhappy paths
- **Unhappy paths (ban/fail/reject):** Formal-warm register. Clear reason + next steps. Zero particles

### 🟢 Nice to Have — Creative Encouragement

- Loading animism (system personification)
- Easter eggs (max 1 per screen, must not distract from primary task)
- Tone particle whitelist (see below, style reference only, NOT hard constraint)

**Approved particle whitelist (reference):** `啊 / 呀 / 嘛 / 呢 / 哦 / 哈 / 哟 / 啦 / 吧 / 诶 / 嘿 / 噢`

---

## 3. Core Terminology Table (🔴 Hard Rule)

| Canonical | Allowed Alternate | Banned Legacy |
|-----------|------------------|---------------|
| 局 / 破冰局 / 畅聊局 / 狂欢局 | 活动 (admin nav only) | 标准局 / Premium局 / 酒吧局 |
| 桌 / 这桌 / 桌友 / 成桌 | 小队 (squad-unboxing transition only) | 小组 / 群组 |
| 权益 | — | 会员 / VIP / 会员/VIP会员 |
| 连接 | — | 圈子 |
| 悦仔 | — | Hardcoded nicknames (小悦, Mia, etc.) |
| 发现 (nav tab) | — | — |
| 默契 / 高默契 | — | — |
| 氛围 / 氛围卡 / 氛围命格 | — | — |

---

## 4. Trust-Sensitive Copy (Unhappy Paths)

These are the moments where tone matters most but warmth must not undermine seriousness.

| Scenario | Tone | Structure | Example |
|----------|------|-----------|---------|
| Ban / suspension | System UI (formal) | Reason + duration + appeal path | "你的账号因违反社区规范已被暂时限制" |
| Payment failure | System UI | Result + action | "支付未成功，再试一次即可" |
| Refund in progress | System UI (+ order ref) | Confirmation + timeline | "退款已提交，预计 3-5 个工作日到账（订单号: XXX）" |
| Not matched to any group | 悦仔浅口吻 (≤1 particle) | Acknowledge + alternative | "这一局没有匹配到合适的桌友，试试其他局吧" |
| Fabricated social proof | System UI or 悦仔 Voice (surface-dependent) | Use real data or omit | "已有 128 人感兴趣" (live) / "来发现属于你的活动" (no metric) |
| Event cancelled | System UI | Reason +补偿 info | "活动因故取消，已为你退款" |
| Group full / slot taken | System UI | Fact + action | "名额已满，可以看看其他活动" |

**Golden rule:** Unhappy paths get **exactly as much warmth as the user needs to not feel punished**, and **no more warmth than they need to take the situation seriously**.

---

## 5. Copy Architecture

### 5.1 Directory

```
packages/shared/src/copy/
├── index.ts           # barrel export
├── terms.ts           # Core terminology mapping + validation helper
├── errorBaselines.ts  # Error message factory functions
├── emptyStates.ts     # Empty state templates
├── mascotVoice.ts     # 悦仔常用句式库
├── toneMap.ts         # Surface ↔ Tone mapping + allowed modes
└── exceptions.ts      # 🟠 Orange-word framing templates
```

### 5.2 Interface Design

Template strings + factory functions, mixed approach:

```typescript
// Factory function for type-safe error messages
function getErrorMessage(
  code: ErrorCode,
  context?: { mascotName?: string; surface?: string }
): string

// Template with interpolation
function getEmptyStateMessage(
  surface: 'events' | 'connections' | 'notifications' | 'messages' | 'history',
  context?: { mascotName?: string; includeAction?: boolean }
): string

// Tone-aware dispatch
function getCopy(
  template: CopyTemplate,
  toneMode?: ToneMode  // auto-selected from toneMap if omitted
): string
```

### 5.3 Ownership and Maintenance

```
CODEOWNERS: packages/shared/src/copy/* @joyjoin/pm @joyjoin/eng-lead
```

- **Owner:** PM + engineering lead (dual sign-off for any change)
- **Review required:** Every PR touching `copy/` needs both PM and eng review
- **CS/Ops notification:** PM issues a 1-page change summary whenever copy batch-updates

### 5.4 Exception Mechanism

When legitimate product need requires violating a 🔴 rule:

1. Document in `copy/exceptions.ts`: which rule is violated, why, expiration date
2. Obtain PM + engineering lead dual sign-off
3. Set auto-expiration date — review after expiry whether still needed

---

## 6. Success Metrics

| Metric | Baseline (from audit) | Target |
|--------|----------------------|--------|
| CS tickets related to UI copy confusion | Measured in audit | Reduce ≥ 50% |
| Payment completion rate | Pre-migration baseline | No regression |
| User sentiment score (post-event survey) | Pre-migration baseline | Maintain or improve |
| Empty state → action conversion | Pre-migration baseline | Improve ≥ 20% |

---

## 7. AI Agent Workflow

### Agent copy generation process

1. Determine `toneMode` from surface (use `toneMap.ts`)
2. Check 🔴 Hard Rules: no banned words, no mechanism description, correct terminology
3. Generate copy in tone mode's register
4. Self-validate: run through Hard Rules check
5. Submit for human review (PR)

### Prompt metadata for AI copy generation

Every copy-generation prompt MUST include:
- `toneMode`: system-ui | yuezai-voice | social-game
- `surface`: the UI surface this copy appears on
- `userArchetype` (optional): for personalised copy

---

## 8. Rollout Phases

| Phase | Scope | Risk | Prerequisites |
|-------|-------|------|--------------|
| **Phase 0** | 48h copy audit + fix top-5 inline | Low | — |
| **Phase 1** | Error states + Empty states unified (~50 locations) | Low | `copy/` directory + factory functions + toneMap ready |
| **Phase 2** | Payment flow rewrite (~15 locations) | Medium | A/B test confirmation that tone doesn't regress conversion |
| **Phase 3** | Onboarding / Nav / Misc (~30 locations) | Low | — |
| **V2** | i18n preparation, personalised copy hooks, `validateCopy` build-time CI gate | — | All Phases 0-3 validated |

---

## 9. Quick-Reference Card (Engineer 1-Pager)

> Print this. Pin it above your desk.

### 9.1 Three Tones

| Tone | Particles | Sounds like |
|------|-----------|-------------|
| System UI | 0-1 | "保存修改", "支付成功" |
| 悦仔 Voice | ≤3 | "哎呀妈呀两个脑洞王级选手碰一块儿了！" |
| Social/Game | ≤3 | "我选择做一只安静的柯基。" |

### 9.2 Never Say

`LLM / 算法 / 权重 / 评分 / 数据` (in internal-mechanism context)

### 9.3 Always Say

| Right | Wrong |
|-------|-------|
| 局 / 破冰局 / 畅聊局 / 狂欢局 | 标准局 / Premium局 |
| 桌 / 桌友 | 小组 / 群组 |
| 权益 | 会员 / VIP |
| 连接 | 圈子 |
| 悦仔 {verb} | 系统 / 平台 |

### 9.4 Error Copy Pattern

```
Toast (7-12 chars, System UI):  "没成功，再点一次就好"
Full page (悦仔 Voice):        "悦仔遇到点小麻烦，再试试看~"
```

### 9.5 Empty State Pattern

```
悦仔还没找到适合你的{noun}，先{action}？
```

For high-stakes surfaces where the user needs to understand *how* value is created
(e.g. 我的连接), explain the mechanism in one sentence before the action nudge:

```
连接是在活动里互相选择的人。参加一局活动，结束后提交反馈，
和你互相选择的人会出现在这里。
```

### 9.6 Trust-Sensitive Rule

Unhappy path = System UI (formal). No `~`, no `啦`, no `哦`. Warm but serious.

### 9.7 Quick Decision Tree

```
What am I writing?
├─ Button / toast / nav label → System UI
├─ 悦仔 dialogue / loading / recommendation → 悦仔 Voice
├─ Game phase / dare / reveal → Social/Game
├─ Payment / refund / error → System UI
└─ Ban / suspension → System UI (formal, zero particles)
```

---

## Appendix A: References

- Existing gold-standard copy: `packages/shared/src/personality/archetypeCompatibility.ts` (tone baseline)
- Existing 悦仔 copy module: `packages/shared/src/socialIcebreakerYuezaiCopy.ts`
- Loading whispers: `apps/mini-program/src/lib/utils/loadingWhispers.ts`
- Discover narrative copy: `apps/mini-program/src/lib/utils/discoverNarrativeCopy.ts`
- Game phase names: `packages/shared/src/phaseRegistry.ts`
- Tier display names: `packages/shared/src/socialIcebreakerTierManifest.ts`
- Brand guidelines: `docs/FOLDER_STRUCTURE.md`, JoyJoin Brand Guidelines skill

## Appendix B: Changelog

| Date | Change |
|------|--------|
| 2026-05-15 | Initial version. Merged from strategy deliberation + PM sin-mapper audit. |
| 2026-06-21 | Discover empty-state presence strip copy updated to invitation frame (`首座留给你`); capacity readout (`0/6`) removed from visible label per Oracle Card "mirror, not menu" principle. |
