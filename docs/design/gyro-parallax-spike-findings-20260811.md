# S10 Gyro-Parallax Spike — Findings & Measurement Protocol

**Date:** 2026-08-11 · **Status:** Spike implemented, device measurement PENDING · **Plan:** `docs/design/icebreaker-fluid-ux-iteration-plan-20260811.md` §S10 · **Locked floors:** `docs/design/icebreaker-fluid-ux-playbook-20260811.md` §3.1 + §10 ruling 7

---

## 1. What was built

A flag-gated gyro parallax prototype on **one hero surface**: the warmup phase topic card slot (`pages/icebreaker-session/phases/WarmupPhaseView.tsx` → `WarmupCardSlot`). The card gently tilts (`perspective + rotateX/rotateY`, max ±8° per axis) in response to device orientation, relative to a neutral pose calibrated from the first 5 sensor readings at listener start.

| File | Purpose |
|---|---|
| `apps/mini-program/src/pages/icebreaker-session/spike/gyroParallax.ts` | Pure logic: `GYRO_PARALLAX_SPIKE_ENABLED = false` module-local gate, tilt math (clamp ≤8°, pocket-posture damping, low-pass smoothing), dev-only `createJankMonitor` rAF-delta sampler |
| `apps/mini-program/src/pages/icebreaker-session/spike/GyroParallaxSpike.tsx` | Wrapper component: sensor lifecycle (`Taro.startDeviceMotionListening` + `onDeviceMotionChange`, interval `'ui'` ~60ms), rAF-throttled state updates (personality-card precedent), jank harness wiring, `useDidShow`/`useDidHide` + unmount stop, reduced-motion collapse to static |
| `apps/mini-program/src/pages/icebreaker-session/styles/_gyro-parallax-spike.scss` | Wrapper rules (flex-neutral in the zero-scroll warmup column, `will-change: transform`, 150ms ease-out transition, RM block) |
| `apps/mini-program/src/pages/icebreaker-session/index.scss` | `@use './styles/gyro-parallax-spike'` — compiles rules into the page WXSS (subpackage style-splitting guard) |
| `apps/mini-program/src/pages/icebreaker-session/__tests__/gyroParallaxSpike.test.ts` | 14 unit tests: flag default-off, ≤10° bound, pocket damping, clamp, smoothing, jank monitor accounting |
| `apps/mini-program/scripts/verify-subpackage-styles.mjs` | New REQUIREMENTS entry: `pages/icebreaker-session/index.wxss` must contain `gyro-parallax{` + `gyro-parallax--tracking{` |
| `apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx` | Mount point only: wraps the card-slot `View` in `<GyroParallaxSpike reduceMotion={reduceMotion}>` |

**Gate discipline:** no server file touched (no `featureFlags.ts` registration); the module-local constant is the only switch. When `false` (default) or reduced-motion is on, the component returns children verbatim — zero DOM, listener, or render delta.

**Sensor substitution (documented deviation):** the playbook names `wx.onGyroscopeData`, but WeChat gyroscope events deliver angular *velocity* (rad/s) which drifts when integrated — wrong tool for absolute-tilt parallax. The spike uses `Taro.onDeviceMotionChange` orientation (beta/gamma), matching the in-repo precedent `pages/onboarding/personality-test/results/WebGLLandStage.tsx` and the personality-card tilt pattern (`FinalStage.tsx`: ≤8° clamp, rAF-throttled updates, 0.15s ease-out).

**POCKET behavior (ruling 4):** when the device is within ±20° of flat (face-up on table) or face-down, the tilt target damps to identity — the flourish is off in POCKET. App-background / page-hide stops the sensor entirely (`useDidHide`).

**Deliberately omitted:** touch-drag tilt fallback. The warmup card carries ACT inputs (mood grid, deep-prompt expander, ready CTA); per ruling 1 (ACT inputs → behavioral always), a touch-tilt layer risks gesture contention on the session's primary input surface. Parallax is passive-only.

## 2. How to enable on a device

1. In `apps/mini-program/src/pages/icebreaker-session/spike/gyroParallax.ts`, set `GYRO_PARALLAX_SPIKE_ENABLED = true`.
2. Build a dev/体验版 bundle against staging: `TARO_APP_API_BASE_URL=https://staging.joyjoinapp.com npm run build:weapp -w mini-program`, upload per the standard 开发版 flow.
3. Enter any social icebreaker session (single-test 调试局 works) and reach the **warmup** phase. Tilt the phone: the topic card counter-tilts up to ±8° with a 150ms ease.
4. Verify the off states: lay the phone flat (POCKET) → card eases back to level; background the app / swipe away → sensor stops (no `[GyroSpike]` jank lines continue in vConsole).
5. **Revert the constant to `false` before committing any measurement branch.**

## 3. Measurement protocol (field tester)

**Device:** Gen-Z 8GB baseline Android (the performance-audit reference device), WeChat current stable. **Venue:** dim lighting, real or single-test session.

- **Jank/fps:** the dev harness samples rAF deltas while parallax is active. In vConsole, watch the periodic line `[GyroSpike] jank N/M frames (P%), worst Wms` (emitted every 15s), or evaluate `__JOYJOIN_GYRO_SPIKE__.getReport()` for a snapshot and `__JOYJOIN_GYRO_SPIKE__.reset()` between scenarios. Budget: frame delta > 34ms (~2 missed frames at 60fps) counts as jank. Scenario: full warmup phase with active tilting, then the whole session (parallax only runs in warmup).
- **Crashes:** run ≥3 full sessions with the flag on; any new crash / white screen / WeChat "运行异常" dialog = FAIL. Compare against the same build with the flag off if unsure whether a crash is new.
- **Battery:** full session duration (≥45 min) with screen-on held (`setKeepScreenOn` is already session policy). Record system battery drain for the WeChat app; compare to a flag-off control session on the same device within the same day. "Normal envelope" = drain delta within the noise of the control (±5% of battery capacity or tester-judged equivalent).
- **Reduced motion:** enable system reduced-motion → card must render static (no tilt response).

## 4. Verdict table (locked floors, playbook §10 ruling 7 — any WARN = drop)

| Floor | Threshold | Result | Verdict |
|---|---|---|---|
| Sustained 60fps | No new jank over budget while parallax active (jank ratio ≈ baseline; no sustained jank bursts attributable to the sensor/transform loop) | ☐ untested | ☐ PASS / ☐ WARN / ☐ DROP |
| Zero new crashes | 0 crash/white-screen across ≥3 flag-on sessions | ☐ untested | ☐ PASS / ☐ WARN / ☐ DROP |
| Battery envelope | Full-session drain within normal envelope vs flag-off control | ☐ untested | ☐ PASS / ☐ WARN / ☐ DROP |
| RM collapse (engineering gate) | Static render under system reduced motion | ☐ untested on device (unit-covered) | ☐ PASS / ☐ FAIL |

**Final verdict belongs to device measurement + `performance-audit`.** Any WARN in rows 1–3 = DROP, no negotiation; drop cost is zero (delete the wrapper mount + spike directory).

## 5. Static analysis (engineering assessment, pre-device)

- **Bundle delta:** ~6.3KB TSX + ~6.4KB TS + ~1.7KB SCSS source; compiled contribution to the `icebreaker-session` subpackage is ≈3–4KB minified — negligible against the subpackage budget. When the flag is off the module is still bundled (tree-shaking can't remove a dynamic-looking constant import chain) but executes nothing.
- **Render cost:** sensor cadence `'ui'` ≈ 60ms → at most ~16 rAF-throttled `setState` per second, re-rendering only the 1-node wrapper (`children` prop identity is stable across those renders, so `WarmupCardSlot` and the ember rim do not re-render). Transform is compositor-only (`will-change: transform`, perspective + rotate). No layout properties are animated; no new selectors queried per frame; no blur/filter added. Expected steady-state cost: one layer composite per tilt update — well inside 60fps budget on the baseline class of device, but this is exactly what the device protocol must confirm.
- **Render-cost caveat:** `perspective()` on the wrapper promotes the whole card subtree (foil shell + CardFlip + ember rim) into a 3D rendering context. On some mid-tier Android WebView builds this increases the composited layer memory for the card while active. Bounded (one hero surface, warmup phase only) but watch for it in the battery/memory observation.
- **Lifecycle:** sensor + rAF loop stop on `useDidHide` and unmount; a swipe-back or backgrounded page cannot leak the listener. Restart on `useDidShow` re-calibrates the neutral pose.

## 6. Known risks

- **Gyro/orientation availability varies across WeChat versions and Android ROMs.** `startDeviceMotionListening` requires base library ≥ 2.3.0; some devices deliver sparse or noisy orientation events, a few deliver none (the `fail` callback handles this — card stays static). iOS 13+ motion-permission prompts do NOT apply to mini-programs (WeChat brokers sensor access), but enterprise/kid-mode WeChat builds have been reported to suppress motion events.
- **Orientation units/quirks:** Taro typings document beta/gamma in radians; the older WebGLLandStage code divides by 90 (degree assumption). The spike treats values as radians per the current typings — **verify on device** that tilt amplitude feels right; if the response is ~57× too weak, the ROM is delivering degrees (flip the `RAD_TO_DEG` usage).
- **Neutral-pose calibration on entry:** if the player opens the session with the phone flat on the table, the first 5 samples calibrate "flat" as neutral and pocket-damping keeps the card level until the phone is raised past ~20° — acceptable, but means the very first impression may be static. Recalibrates on every page re-show.
- **Beta wraparound at ±π:** holding the phone beyond vertical can wrap beta and flip the rotateX sign briefly; the ±8° clamp + 150ms ease makes this a soft bounce at worst. Not expected in natural cocktail-table posture.
- **Interaction with existing card motion:** the wrapper transform composes with the deal/sheen/flip animations on the card subtree (parent transform + child rotateY flip). Static review shows no conflict (different elements), but the device run should eyeball the deal-in beat with tilt active.
- **Dev harness in production:** the jank monitor is gated on `process.env.NODE_ENV !== 'production'` AND the spike constant; if the spike ships, the harness must be stripped or re-gated to the DB flag.

## 7. Preliminary engineering leaning (non-binding)

**Lean SHIP-IF-CLEAN, expect DROP risk to be low but real.** The implementation is transform-only, single-surface, lifecycle-clean, and render-isolated — the cheapest possible version of this flourish. The two genuine unknowns only a device can answer: (1) whether WeChat's orientation stream on the baseline Android is smooth enough that the 16/s setState loop stays invisible, and (2) whether the sensor + persistent composited layer measurably moves the battery needle over a 45-minute session. If either shows a WARN, drop at zero product cost per ruling 7 — the flag-off path is byte-identical to today.
