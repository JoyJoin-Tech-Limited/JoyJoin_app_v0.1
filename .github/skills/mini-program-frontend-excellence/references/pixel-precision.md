# Pixel precision and layout discipline (mini-program)

**Scope:** `apps/mini-program` — Taro / WXSS / rpx. This document is the **non-negotiable** bar for visual implementation and PR review when UI changes.

## Authority order

1. **Named design spec** — Figma (or equivalent) with measurements, exported redlines, or a ticket that lists exact values. Implementation **must match** (see below).
2. **Repo variables** — `apps/mini-program/src/styles/_variables.scss` and existing page patterns (e.g. `$container-padding`, `$spacing-*`).
3. **No spec** — Apply **internal consistency** only (8rpx rhythm, alignment rules below). Do not invent one-off pixel values when a sibling screen already established the pattern.

## When a spec exists: zero tolerance

- **No “close enough”.** Padding, margin, gap, width, height, border-radius, border-width, font-size, and line-height must match the spec after **rpx conversion** for the project’s reference viewport rules, within **1 physical pixel** on the target device class (standard phone width used for review).
- **Wrong token = wrong PR.** If the spec says `24` and the code ships `22` or `26` without an approved exception, reviewers treat it as a **blocking** defect.
- **Documented exceptions only.** If WeChat/WXSS or a technical constraint prevents an exact match, the PR must state the constraint, show **WeChat DevTools** evidence (computed style or box overlay), and obtain **design review** sign-off on the deviation.

## When no spec exists: internal consistency

- **Primary spacing rhythm: multiples of 8rpx** — e.g. `8, 16, 24, 32, 40, 48, 56, 64…` for margins, padding, gap, and section vertical rhythm.
- **4rpx** is allowed only for: hairline borders (e.g. `2rpx`), optical alignment inside a locked component, or documented micro-nudges. If you use `4rpx` for something else, add a **short code comment** explaining why.
- **Alignment:** Reuse the same horizontal inset as sibling screens (`$container-padding` or the page’s established wrapper). Vertically, section gaps should follow the same ladder as nearby onboarding or hub screens unless there is a documented exception.
- **Typography:** Prefer existing `$font-size-*` and weight tokens; avoid new arbitrary `font-size: 27rpx`-style literals unless they are spec-backed.

## WeChat DevTools — mandatory pre-merge for UI changes

Automated CI **cannot** run WeChat DevTools. **Human verification is the enforcement layer.**

Before marking a PR ready (or approving), authors and reviewers must:

1. Open the changed page in **WeChat DevTools** (simulator at project target baseline).
2. Use the **Wxml** tree inspector and **computed styles** (or Styles panel) to verify key boxes: container padding, section gaps, CTA height, title and body font sizes vs spec or vs the rhythm rules above.
3. For dense or new layouts, spot-check **one real device** preview (phone) when possible.
4. When the diff is visual and reviewers cannot reproduce locally, the author attaches **screenshots** or a short **DevTools note** (which selectors were checked and values seen).

**Reviewers:** If `apps/mini-program` UI changed and there is no evidence of DevTools or device spot-check, **request changes** or block merge until the checklist in `mini-program-frontend-excellence` § Review checklist is satisfied.

## Relationship to automated tests

- Style **lint tests** (e.g. landing `index.style.test.ts`) guard specific unsafe CSS patterns; they do **not** replace DevTools measurement.
- Do not merge visual work solely because unit tests are green.

## Related

- [`taro-ui-framework.md`](./taro-ui-framework.md) — layout, performance, assets
- [`../SKILL.md`](../SKILL.md) — full workflow and review checklist
- [`../../design-system-governance/references/frontend-excellence-thresholds.md`](../../design-system-governance/references/frontend-excellence-thresholds.md) — interaction thresholds
