# Empty-State Visual Strategy — Premium No-Card Editorial System

**Date:** 2026-11-09
**Status:** Implemented for the four scoped no-data states; H5 render matrix passed, native visual verification pending
**Owner:** Mini-program frontend / design-system governance
**Component:** `apps/mini-program/src/components/mascot/XiaoyueEmptyState/`

## 1. Diagnosis

The prior designer review identified a repeated pattern rather than four isolated page problems:

- Empty content was placed inside decorative white cards even when the card communicated no grouping or data boundary. The extra fill, radius, border, and shadow made a quiet moment visually heavier than the useful action.
- Events and Discover used Lovart `StatusCard` artwork while Center Hub and Connections maintained separate inline Xiaoyue compositions. Similar moments therefore spoke different visual languages and duplicated markup.
- Multiple staggered entrances plus infinite mascot breathing made a static absence feel busy. Motion competed with reading instead of establishing hierarchy.
- Full-saturation active tabs could compete with the empty-state CTA. Long or mechanically wrapped CJK copy could leave a single character on the final line.
- Empty, loading, and error states were at risk of being treated as interchangeable. They are not: an empty state is a truthful wayfinding moment; loading and error are operational states with different copy, assets, and recovery semantics.

The response is subtraction plus convergence: remove the decorative container, use one shared mascot-led composition, and keep the existing page action as the single next step.

## 2. Principles

1. **Empty is not a card by default.** Use a card only when it groups meaningful structured content, controls, or a repeatable data object.
2. **One focal hierarchy.** Mascot → concise title → optional supporting line → at most one primary CTA.
3. **Editorial, not promotional.** The state explains what is true and where to go next; it does not manufacture urgency or promise unavailable inventory.
4. **Opt in deliberately.** `variant='editorial'` is required. Existing `XiaoyueEmptyState` consumers keep their current default, loading, error, archetype, and celebration behavior.
5. **Static after arrival.** One restrained group entrance is enough. Mascot, halo, copy, and CTA do not breathe, pulse, bloom, or stagger independently in the editorial variant.
6. **Preserve page behavior.** Navigation, analytics, haptics, filters, cache behavior, and retry handlers stay in their existing page owners.
7. **Native and accessible.** Taro `View`/`Text`/`Image` only, brand tokens, 8rpx spacing rhythm, CJK-safe wrapping, ≥88rpx CTA targets, and complete reduced-motion behavior.

## 3. Decision Tree

Use this order when choosing an empty/status treatment:

1. **Is the request still loading, did it fail, or is this a celebration/identity-rich ritual?**
   - Yes → keep the established loading/error/celebration treatment. Do not select `editorial` merely to make it look newer.
2. **Does the content need a card to communicate meaningful grouping?**
   - Yes → retain the grouping card. Examples: Connections `flow-card`, Discover `CityUnlockFeedCard`, data tables, and structured explanatory modules.
3. **Is this a quiet no-data state whose primary job is orientation or one next action?**
   - Yes → use `XiaoyueEmptyState variant='editorial'`.
4. **Does the surface have an established operational/error language or an explicit exclusion below?**
   - Yes → leave it unchanged and record any future migration as a separately reviewed scope.
5. **Would migration change CTA presence, analytics, navigation, artwork availability, or loading/error behavior?**
   - Yes → stop and resolve the contract before migrating. Editorial styling must not be used to rewrite product behavior.

## 4. Editorial Anatomy and Tokens

The component owns the composition; pages own only placement and behavior.

| Layer | Rule |
|---|---|
| Page placement | Existing page/scroll container supplies horizontal inset and vertical centering where appropriate. No extra white state panel. |
| Mascot | Existing Xiaoyue registry only. Scoped pages use `size='lg'`; no new artwork. |
| Halo | Existing soft radial halo, static after the group entrance. It is atmosphere, not a card or control. |
| Title | `@include type-heading`, 36rpx token, line-height 1.4, normal CJK word breaking, no arbitrary wrapping. |
| Subtitle | Optional; body token, relaxed line-height, normal CJK breaking. Explicit newline is allowed only for deliberately balanced copy. |
| CTA | Optional and singular; solid `$color-primary`, `$button-height` (96rpx, above the 88rpx minimum), pill radius, no gradient. Disabled/loading behavior and branded spinner remain component-owned. |
| Spacing | 8rpx rhythm. Editorial vertical padding is `$spacing-lg`; title/subtitle and CTA gaps use existing spacing tokens. |
| Fallback | Existing image-error fallback renders the branded 悦 mark without suppressing copy or CTA. |

No decorative background, border, radius, or shadow wraps the editorial content. The CTA may retain its own interactive shape and pressed feedback; that is not a content card.

## 5. Copy Rules

- Lead with the truthful current condition, then a short useful orientation. Avoid a stack of generic `暂无…` announcements.
- Prefer one sentence per level. Do not repeat the title in the subtitle or CTA.
- Do not promise activity, matches, timing, inventory, refunds, attendance, or outcomes that the underlying data does not establish.
- Keep approved WeChat-review vocabulary. No visible `匹配`, `社交`, `撮合`, `灵魂`, or `AI` terminology.
- Use normal CJK line breaking (`word-break: normal`; never `overflow-wrap: anywhere`). Shorten copy before narrowing the container. Verify every copy variant at small and standard phone widths for orphan lines.
- Preserve the existing action unless the product contract explicitly changes it. Unfiltered Discover intentionally has no CTA.

### Scoped copy inventory

| Surface / variant | Title | Subtitle | CTA |
|---|---|---|---|
| Events + Center Hub / ongoing | 此刻，还没有进行中的活动 | 活动有进展时，会在这里告诉你。 | Existing Discover action |
| Events + Center Hub / upcoming | 还没有待开始的活动 | 有新的安排时，会在这里告诉你。 | Existing Discover action |
| Events + Center Hub / completed | 第一段回忆，等你写下 | 活动结束后，可以在这里回看足迹。 | Existing Discover action |
| Connections / no data | 新的连接，从一场活动开始 | 参加活动并完成互动后，\n双向选择的连接会出现在这里。 | 去探索活动 |
| Discover / unfiltered | 当前没有可报名的活动 | 活动上线后，会在这里展示。 | None |
| Discover / filtered empty | 当前筛选下，还没有活动 | 清除筛选，看看其他区域。 | 清除筛选 |

Events and Center Hub retain their distinct tab state machines despite sharing copy. Events labels its CTA `去发现`; Center Hub retains `去探索活动`.

## 6. Motion and Accessibility Rules

- The editorial root performs one 420ms `transform` + `opacity` entrance with `cubic-bezier(0.22, 1, 0.36, 1)`.
- Child mascot, halo, copy, badge, and CTA entrance animations are disabled in editorial mode. Infinite mascot breathing is never enabled by this variant.
- `@media (prefers-reduced-motion: reduce)` disables the group entrance, all child entrance/CTA/halo/mascot animation, spinner rotation, transitions, and pressed transforms while preserving readable static layout.
- `motionReduced` on an editorial instance applies the same complete static treatment explicitly. It does not change default-variant consumers.
- CTA is a Taro `View` with button semantics, `aria-disabled`, an accessible loading label, `hoverClass`, and a ≥88rpx target. Haptics and analytics remain in page handlers.
- All copy is rendered through Taro text nodes; no HTML injection is introduced.

## 7. Page Inventory and Behavior Locks

| Page | Migrated branch | Asset | Preserved behavior |
|---|---|---|---|
| `pages/events` | Empty current tab only | `xiaoyue-events-empty` via `emotion='events'` | Three tabs, non-empty cards, loading skeletons, `StatusCard` error/retry, and one `events_empty_state_cta_tap` before Discover `switchTab` per CTA tap |
| `pages/center-hub` | Empty current tab only | `xiaoyue-events-empty` | Three tabs, non-empty cards, existing loading/error/retry, light haptic, Discover navigation |
| `pages/connections` | No connections only | `xiaoyue-connections-empty` via `emotion='curious'` | Loading `waiting`, error `reassure`, connection cards/actions, Discover navigation, and the separate meaningful `flow-card` |
| `pages/discover` | No visible pools only | `xiaoyue-events-empty` | Loading skeletons, `StatusCard` error/retry, filters and auto-relaxation, non-empty `VirtualList`/`OracleCard`, `CityUnlockFeedCard`, unfiltered no-CTA, filtered clear-filter action |

Events and Center Hub active tab pills use low-alpha purple fill/border with primary text so they remain selected without competing with the solid CTA. Global navigation and the tab bar are unchanged.

## 8. Exclusions

This strategy does **not** migrate or restyle:

- Notifications or Gathering Room.
- Any loading, error, permission, celebration, archetype-identity, payment, reward, icebreaker, or ceremony surface.
- `StatusCard` globally or its remaining error/status consumers.
- Connections `flow-card`, Discover `CityUnlockFeedCard`, or other cards that provide meaningful grouping.
- Navigation/tab-bar structure, APIs, schemas, feature flags, artwork registry, or dependencies.

Future similar no-data surfaces may opt in only after checking the decision tree and adding focused render/page coverage. This is a governed pattern, not a global restyle.

### Global scan outcomes — 2026-11-09

The mini-program empty/status surface scan found four repeated decorative-card no-data compositions; all four are in the scoped migration above. Other surfaces were deliberately not forced into the same treatment:

| Surface | Scan outcome |
|---|---|
| `pages/city-unlock` | Already uses a no-card mascot → copy → single-CTA composition. No decorative-card defect to migrate. |
| `pages/profile-linked/personal-story` | Already uses a no-card editorial empty composition; its populated story artwork is meaningful content, not an empty-state card. |
| `pages/notifications` and `pages/gathering-room` | Already reuse `XiaoyueEmptyState`; their loading/error/empty semantics remain isolated on the existing default variant. |
| `pages/profile-linked/rewards` | Empty assets, shop, and history are section-level modules within a larger rewards layout. Their cards communicate grouping and are not page-level wayfinding states. |
| Payment, pool-registration, feedback, personality, and icebreaker states | Operational, transactional, identity-rich, or ceremony surfaces with their own established treatments; no visual-only migration is appropriate. |

A remaining `StatusCard` usage is not evidence of a defect by itself. Migrate only when the decision tree identifies a quiet page-level no-data state and the card is purely decorative.

## 9. Rollout and Verification

### Automated evidence

- Component tests cover default isolation, editorial artwork, optional CTA/subtitle, image fallback, disabled/loading CTA, and reduced-motion safeguards.
- Actual page tests cover empty and non-empty branches for Events, Center Hub, Connections, and Discover; loading/error preservation; Events analytics order and exactly-once-per-tap behavior; Center Hub/Connections navigation; and Discover filtered/unfiltered behavior.
- Run:
  - focused Vitest suites for the component and four pages;
  - `npm run typecheck -w mini-program`;
  - `npm run guardrails`;
  - `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program` when required by the release gate.

### Render/native gate — required before AC-02 can pass

**2026-11-09 H5 evidence:** the final matrix passed all 18 variants at 320×568 and 390×844 under reduced motion, with no detected clipping, orphan lines, CTA target/viewport failures, or residual animation. The normal-motion probe confirmed one 420ms root entrance, no independent mascot/halo/CTA animation, and no settled loops. Temporary screenshots and reports are verification artifacts, not committed assets.

The parent review session owns capture and native inspection. Before merge/release:

1. Capture all four empty states at small and standard phone widths, including every Events/Center Hub tab variant and Discover filtered/unfiltered variants.
2. Inspect title/subtitle wrapping, single-character orphan lines, mascot/halo registration, CTA width/height, overlap, clipping, and the absence of a decorative state card.
3. Exercise normal and reduced-motion modes; confirm one entrance only and a completely static reduced-motion result.
4. Inspect computed styles/layout in WeChat DevTools and perform the required real-device spot check. Automated tests alone do not satisfy this gate.
5. Verify empty → CTA navigation, Discover clear-filter, loading/error retry, and representative non-empty content on the native runtime.

Until those captures and native checks are attached, visual AC-02 remains **NOT VERIFIED**, even when source and automated tests pass.

**2026-11-09 native attempt:** official `miniprogram-automator` was installed only in the external verification workspace. The first session connected to DevTools but `pageStack()` timed out; a fresh trusted launch then timed out before automation connected. No native screenshot or computed-layout evidence was produced. Complete the DevTools/real-device steps above manually or in a working automation session before release sign-off; do not treat H5 evidence as native proof.
