# Mini-program device QA (launch)

JoyJoin uses a **tiered QA strategy**. Run the Primary tier checks on a modern flagship or upper-mid-range device. Run the Degradation tier checks on an older or budget device to confirm graceful fallback.

## Primary QA target (Tier-1 Gen Z baseline)

**Device profile:** 8GB+ RAM, 120Hz AMOLED, 5G, WeChat 8.0+, Android 12+ or iOS 16+. This is the hardware your core demographic actually uses (QuestMobile 2025: 35–40% of Xiaomi/OPPO/vivo users are under 24; avg DRAM 8.4GB+ globally, Huawei avg 12GB in China).

### Cold start and packages

- [ ] From cold open, log in and reach Discover without a white flash longer than **~800ms**.
- [ ] First entry into onboarding subpackage after login: transition feels instant (loading shell renders within 200ms).
- [ ] Tab bar: switching Discover / Events / Connections / Profile is **120Hz smooth** with no dropped frames.

### Motion (Primary tier)

- [ ] Staggered entrance animations on Discover pool cards run smoothly at 120Hz with 15+ pools.
- [ ] Matching overlays (match → members → theme) run full animation without stutter.
- [ ] Particle / shader effects (if any) maintain ≥55fps.

### Lists (Primary tier)

- [ ] Discover: scroll pool list with 30+ pools; no perceptible stutter.
- [ ] Events: scroll “我的足迹” with 20+ items; no perceptible stutter.

---

## Degradation QA target (graceful fallback)

**Device profile:** 4GB RAM, 60Hz LCD, 4G, WeChat 7.x, Android 9–10 or older iOS. Confirm the app remains usable even when full fidelity is not possible.

### Cold start and packages

## Cold start and packages

- [ ] From cold open, log in and reach Discover without a white flash longer than ~1s.
- [ ] First entry into onboarding subpackage after login: transition feels intentional (loading shell, not blank page).
- [ ] Tab bar: switching Discover / Events / Connections / Profile is smooth.

## Matching flow

- [ ] Pool registration success: “开启匹配结果通知” triggers the WeChat subscribe sheet (with `TARO_APP_WECHAT_SUBSCRIBE_TMPL_IDS` set in the build env).
- [ ] On matching status while **pending**: waiting UI updates; pull “立即刷新” works.
- [ ] When `POOL_MATCHED` fires: haptic (if supported), overlay stages (match → members → theme) run without duplicate overlays after background/foreground.
- [ ] After overlay: navigation to squad / event detail has no double flash (`redirectTo` / fallback).

## Motion (Degradation tier)

- [ ] With system or in-app reduced motion: squad unboxing and matching overlays shorten timings and remain usable.
- [ ] Low benchmark device: confirm automatic reduced motion path does not skip critical copy.
- [ ] Confirm staggered entrance animations are reduced or disabled; no jank from forced animation.

## Lists (Degradation tier)

- [ ] Discover: scroll pool list with 15+ pools; no severe stutter (VirtualList fallback or pagination active).
- [ ] Events: scroll “我的足迹” with several items; loading skeleton appears then content.

## Icebreaker (all tiers)

- [ ] Enter icebreaker from event: branded loading appears, then phase UI; “同步中…” during refetch is acceptable, not stuck.

- [ ] Enter icebreaker from event: branded loading appears, then phase UI; “同步中…” during refetch is acceptable, not stuck.
