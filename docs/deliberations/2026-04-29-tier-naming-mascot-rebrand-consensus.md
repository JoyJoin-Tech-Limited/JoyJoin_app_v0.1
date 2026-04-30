# Social Icebreaker Tier Naming & Mascot Rebrand — Consensus

> Deliberation ID: `tier-naming-mascot-rebrand-2026-04-29`  
> Date: 2026-04-29  
> Outcome: **ACK-ALL** (3/3 delegates unanimous)  
> Delegates: Alpha (Architect), Beta (UX Visionary), Gamma (Code Realist)  

---

## 1. Decision Summary

### 1.1 Tier Display Names (User-Facing)

| Business Concept | Machine ID | Production Display | Variant (Feature-Flag Gated) | Kill-Switch Fallback |
|---|---|---|---|---|
| Light / Casual | `breeze` | **破冰局** | — | — |
| Medium / Warm | `glow` | **畅聊局** | 朦胧局 (requires explicit product/legal sign-off) | 漫游局 |
| Deep / Full | `blaze` | **狂欢局** | — | — |

**Key constraints:**
- `朦胧局` is atmospheric and intrigue-driven. It is **never** the default. It requires explicit enablement.
- `漫游局` is the zero-risk kill-switch fallback for medium tier — one config change, no deploy.
- All display names use the 局-format (social hang convention) per 2026 Chinese Gen Z naming research.

### 1.2 Tier Machine IDs (Code / DB / Wire Protocol)

| Business Concept | Machine ID | Rationale |
|---|---|---|
| Light | `breeze` | Neutral, collision-free, maps to "light touch" |
| Medium | `glow` | Neutral, collision-free, maps to "warm energy" |
| Deep | `blaze` | Neutral, collision-free, maps to "full celebration" |

**Non-negotiable:** Machine IDs are decoupled from display names. They are short, lowercase, kebab-safe, and never change once persisted.

### 1.3 Mascot Rebrand

| Layer | Value |
|---|---|
| **Display name** | 悦仔 / Yuezai |
| **Machine ID** | `xiaoyue` (unchanged) |
| **Scope** | Display-only in user-facing copy |
| **Backstory** | Server-driven (killable without deploy) |
| **File renames** | None — no TypeScript/component/DB/wire renames |

**Rationale:** `悦仔` is warm, approachable, and semantically tied to the app's core brand (悦聚 / JoyJoin). It surfaces naturally in user-facing copy without requiring a massive rename surface across 3 workspaces — all machine IDs, filenames, DB columns, and wire protocols remain `xiaoyue`.

---

## 2. What We Do NOT Change

To prevent thrash and accidental re-introduction of tech debt, the following are **explicitly frozen**:

1. **No file renames:** `XiaoyueGuidePage`, `xiaoyue-avatar.png`, `useXiaoyue`, `xiaoyueUtils.ts`, etc. all keep their names.
2. **No DB column renames:** `host_user_id` stays `host_user_id`. No migration.
3. **No wire protocol renames:** WebSocket events, REST DTO fields, and JSONB keys keep `xiaoyue` prefixes.
4. **No enum renames:** `XiaoyueMood`, `XiaoyueVoice`, etc. stay as-is.
5. **No tier rename of existing code:** If the codebase already has a `tier` field with values like `light`/`medium`/`deep`, we do NOT retroactively rename them. We only ensure new persisted data uses `breeze`/`glow`/`blaze`.

---

## 3. Launch Safety Protocol

| Risk | Mitigation |
|---|---|
| 朦胧局 triggers user complaints | Feature-flag gated. Default is 畅聊局. Kill-switch is 漫游局. |
| 悦仔 feels jarring to existing users | Phased rollout: display-only first, backstory onboarding only if CSAT lifts |
| Legal review blocks 朦胧局 | Fallback is already the default (畅聊局). No user-facing impact. |
| Metrics regress after rebrand | 7-day monitoring window. CSAT/NPS gating. Rollback = one config change. |

---

## 4. Implementation Checklist

### 4.1 Tier Naming (Minimal — Display Layer Only)

- [ ] Create `packages/shared/src/socialIcebreakerTierManifest.ts`:
  - Export `tierDisplayMap: Record<TierMachineId, { default: string; variants?: Record<string, string> }>`
  - Export `TierMachineId = 'breeze' | 'glow' | 'blaze'`
  - Export `resolveTierDisplay(machineId, featureFlags)` helper
- [ ] Update mini-program `SocialIcebreakerSessionPage` (or relevant component) to call `resolveTierDisplay` instead of hardcoded tier labels
- [ ] Add feature flag: `SOCIAL_ICEBREAKER_DISPLAY_TIER_VARIANT` (env or config)
- [ ] Add kill-switch env: `SOCIAL_ICEBREAKER_TIER_KILL_SWITCH` (maps to safe fallback)
- [ ] Update `docs/deliberations/2026-04-29-tier-naming-mascot-rebrand-consensus.md` when implementation is complete

### 4.2 Mascot Display Rebrand (Display Layer Only)

- [ ] Audit mini-program for user-facing "小悦" / "Xiaoyue" strings:
  - Chat bubbles, loading states, empty states, toast messages
- [ ] Replace with `getMascotDisplayName()` → returns "悦仔" / "Yuezai" based on locale
- [ ] Server-driven backstory: add `mascotBackstory` field to `/api/auth/user` or config endpoint
  - Default: brief intro line
  - Killable by setting `mascotBackstory.enabled = false`
- [ ] Leave all machine IDs, filenames, DB columns, and wire protocol untouched

### 4.3 Verification

- [ ] `npm run guardrails` passes
- [ ] Mini-program screenshots show correct tier labels and mascot name
- [ ] Feature flag toggle changes display correctly
- [ ] Kill-switch env changes display correctly
- [ ] No file renames, no DB migrations, no enum renames

---

## 5. Deliberation Transcript (Condensed)

### Phase 1 — Positioning
- **Alpha:** Proposed `starter` for tier role, 悦仔 for mascot, phased migration, machine IDs separate.
- **Beta:** Advocated 微醺局 as emotional winner, 莫吉 as mascot, warned against corporate tier language.
- **Gamma:** Insisted on neutral machine IDs (`breeze`/`glow`/`blaze`), config-driven display, zero renames.

### Phase 2 — Peer Review
- Alpha accepted Beta's 局-format naming and Gamma's machine ID constraints.
- Beta accepted Alpha's phased migration and Gamma's safety-first gating.
- Gamma accepted Beta's brand warmth within a config-driven boundary.

### Phase 3 — Roundtable
- Compromise on medium tier: `畅聊局` as default, `微醺局` as feature-flag variant, `漫聊局` as kill-switch.
- Compromise on mascot: `莫吉` display, `xiaoyue` machine ID, server-driven backstory.
- Machine IDs unanimously accepted: `breeze`/`glow`/`blaze`.

### Phase 4 — Consensus Poll
- **Alpha:** ACK — "Clean separation of display names from machine IDs, zero file/DB migration churn..."
- **Beta:** ACK — "Balances emotional brand personality with clean technical architecture..."
- **Gamma:** ACK — "Machine IDs decoupled from display names eliminates rename-driven tech debt..."

---

## 6. The 4-Expert Roundtable

After the initial three-delegate consensus, a **4-expert roundtable** was convened to stress-test the proposed names against real-world constraints. The panel comprised:

| Expertise | Focus |
|---|---|
| **Chinese Linguist** | Phonetic resonance, semantic nuance, and native speaker intuition across Mandarin dialect regions. |
| **Global Localization** | Cross-cultural portability, trademark safety, and pronunciation accessibility for non-native speakers. |
| **Gen Z Viral** | Shareability, meme potential, and natural fit with 2026 Chinese social-media vocabulary. |
| **Technical Architecture** | Machine-ID stability, config-driven rollout feasibility, and zero-migration enforcement. |

### Key Roundtable Outcomes

1. **`轻碰局` → `破冰局`** — The Linguist and Gen Z Viral experts agreed `轻碰` felt too tentative and corporate; `破冰` is already established user vocabulary ("破冰游戏"), signals intentional social design, and carries positive momentum.
2. **`尽欢局` → `狂欢局`** — Global Localization flagged potential ambiguity with `尽欢` (can read as "exhausted joy" in some contexts). `狂欢` is unambiguously celebratory, visually punchy in UI, and globally recognizable.
3. **`微醺局` → `朦胧局`** — Legal/Product raised alcohol sensitivity on `微醺`. The roundtable pivoted to `朦胧`, which preserves atmospheric intrigue without substance implications.
4. **`漫聊局` → `漫游局`** — Gen Z Viral felt `漫聊` was too close to generic video-chat apps. `漫游` evokes playful, aimless exploration — a better emotional match for the medium tier's kill-switch fallback.
5. **`莫吉` → `悦仔`** — Chinese Linguist and Global Localization both favored `悦仔` for its direct semantic tie to the app's brand name (悦聚 / JoyJoin). It is warmer, more mascot-like, and avoids the cocktail-brand collision risk of `莫吉`.

The roundtable **unanimously endorsed** the final name set (`破冰局`, `畅聊局`/`朦胧局`/`漫游局`, `狂欢局`, `悦仔`) and confirmed machine IDs (`breeze`/`glow`/`blaze`) remain untouched.

---

## 7. References

- Research briefs: Chinese Gen Z naming trends, global social game naming audit, JoyJoin brand voice audit (compiled during Phase 0)
- Related deliberations:
  - `icebreaker-host-authority-2026-04-29.json` — host authority / Xiaoyue autonomy consensus
  - `moment-card-enrichment-2026-04-29.json` — Moment Card enrichment implementation
- Skills used: `multi-agent-deliberation`, `feature-flags-launch-config`, `social-icebreaker-domain`
