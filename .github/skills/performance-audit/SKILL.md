---
name: performance-audit
description: >
  Post-implementation performance audit covering smoothness (流畅度), rendering speed (速度),
  device adaptability (设备适配), memory safety (内存安全), network resilience (网络韧性),
  and package size (包体积) for WeChat mini-program. Uses Gen Z phone model baselines
  (8GB+ primary tier, not low-end). Incorporates grill-me interview methodology to
  stress-test performance assumptions after every implementation. Produces gated report:
  PASS / WARN / BLOCK. Trigger phrases: "performance audit", "流畅度", "speed check",
  "device adaptability", "perf audit after implementation", "run perf check",
  "performance gate", "perf grill".
---

# Performance Audit

## Purpose

Run after every implementation touching `apps/mini-program` to audit six performance dimensions using Gen Z device baselines (8GB+ RAM, 120Hz AMOLED, 5G primary tier — Android + iPhone co-equal). Incorporates `grill-me` methodology: a relentless one-question-at-a-time interview about the implementation's performance characteristics.

## When to use this skill / When NOT to use

- **Use:** After any implementation touching mini-program pages, components, routes, or data flows. Before merging a PR that changes rendering, animation, networking, or bundle composition. When a screen "feels slow" and needs a structured diagnostic. As a mandatory gate before calling a mini-program change "done."
- **Skip:** Pure server-side changes with zero mini-program impact. Doc-only or comment-only changes. Config-only changes that don't alter runtime behavior.

## Core rules

1. **Six dimensions, scored 0–10 each.** See `references/dimensions.md` for scoring rubrics.
   - 流畅度 (Smoothness), 速度 (Speed), 设备适配 (Device Adaptability)
   - 内存安全 (Memory Safety), 网络韧性 (Network Resilience), 包体积 (Package Size)

2. **Primary tier first.** Optimize for Gen Z primary devices (8GB+/120Hz/5G).
   Degradation tier (4–6GB/60Hz/4G) is fallback-only. Do not let Degradation dictate
   the Primary ceiling. See `references/device-baselines.md`.

3. **Measure before judging.** Run `node scripts/perf-audit-collect.mjs --changed-files=...` first to collect
   automated evidence (package sizes, anti-patterns). Then use the grill-me interview to cover gaps
   the automation cannot detect (device feel, network behavior, subjective smoothness).

4. **Grill-me after scoring.** Once dimensions are scored, run the grill-me interview
   (`references/grill-me-checklist.md`) — one question per turn — to stress-test every
   performance assumption the implementer made. Do not skip any dimension with score < 8.

5. **Gate thresholds:**
   - **PASS:** composite ≥ 48, no dimension < 6
   - **WARN:** composite ≥ 36, no dimension < 4 → ship with documented trade-off
   - **BLOCK:** composite < 36 or any dimension < 4 → fix before merge

6. **Report format.** Produce a structured report: per-dimension score + 1-line rationale,
   composite score, gate verdict, and ROI-ranked fix recommendations.

## Quick examples

- **New animated onboarding step:** score Smoothness (frame drops?), Device Adaptability (120Hz vs 60Hz?),
  Memory (canvas usage?), then grill-me the animation choices.
- **New API-dependent page:** score Speed (cold start + route transition), Network Resilience
  (4G behavior, timeout handling), then grill-me the data-fetching strategy.
- **Bundle size regression:** score Package Size (gzip measurement, subpackage placement),
  then grill-me every new import.

## Troubleshooting

- **"It feels fine on my iPhone 15 Pro"** → That's not an audit. Run on representative Gen Z devices
  (Xiaomi 13/14, OPPO Reno, vivo X series, Huawei Pura 70). If no device available,
  use benchmarkLevel ≤ 15 in WeChat DevTools (or test the iOS model heuristics in `apps/mini-program/src/hooks/useDeviceTier.ts`).
- **"The dimension score is subjective"** → Tie every score to `references/dimensions.md` rubrics.
  Scores must cite specific evidence (profile trace, bundle size, cold-start measurement).
- **Grill-me stalls** → If the implementer gives one-word answers, expand with concrete
  performance scenarios. "Did you test scroll with 30+ items?" → "On a Xiaomi 13 at 120Hz,
  with network throttled to 4G, scrolled fast?".
- **BLOCK on a trivial change** → Re-classify: if the change genuinely has zero performance
  surface area (e.g., a copy string), the audit should pass in < 30 seconds.

## Review checklist

- [ ] All 6 dimensions scored with evidence cited per `references/dimensions.md`
- [ ] Primary tier baselines from `references/device-baselines.md` applied
- [ ] Grill-me interview completed for every dimension scoring < 8
- [ ] Gate verdict (PASS/WARN/BLOCK) determined by threshold rules
- [ ] WARN verdicts include documented trade-off rationale
- [ ] BLOCK verdicts include ranked fix recommendations with estimated effort
- [ ] Report references specific files, WeChat DevTools traces, or bundle measurements

## Related files

- `references/dimensions.md` — scoring rubrics per dimension
- `references/device-baselines.md` — Gen Z primary tier device data
- `references/grill-me-checklist.md` — performance stress-test interview questions
- `docs/reference/perf.md` — canonical performance strategy
- `apps/mini-program/docs/DEVICE_QA_CHECKLIST.md` — device QA tiers
- `apps/mini-program/scripts/check-package-size.mjs` — package size measurement
- `scripts/perf-audit-collect.mjs` — automated evidence collection (run before grill-me)
- `.agents/skills/grill-me/SKILL.md`, `.agents/skills/frontend-performance-and-loading/SKILL.md`, `.agents/skills/mini-program-frontend-excellence/SKILL.md`
