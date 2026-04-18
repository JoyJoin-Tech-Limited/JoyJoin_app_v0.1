# Taro UI engineering framework (JoyJoin mini-program)

This reference complements [`../SKILL.md`](../SKILL.md). Use it for **structural** Taro work: layout constraints, performance patterns, cross-end files, HTML safety, and asset budgets.

## Version reality (read first)

**JoyJoin `apps/mini-program` ships Taro 4.x** (see root `package.json` / `@tarojs/*` versions). Do not treat **Taro 5–only** APIs, theme engines, or marketing performance figures as current facts—see [Future / Taro 5 upgrade notes](#future--taro-5-upgrade-notes).

---

## 1. Design principles (JoyJoin-framed)

Taro’s component philosophy aligns with how we ship mini-program UI:

- **Cross-end consistency** — Prefer one implementation path in this repo (`@tarojs/components`, shared hooks); platform splits use explicit files or compile-time env, not scattered `if` chains.
- **Reuse** — Compose small Taro-native pieces; avoid coupling screens to one-off mega-components.
- **Styling** — Sass/SCSS and repo class patterns first; keep WXSS-safe selectors and JoyJoin brand alignment via existing skills.
- **Performance** — Treat **setData cost**, **list virtualization**, and **package size** as product requirements, not optional tuning.
- **Extensibility** — Prefer Taro and repo conventions before adding new global styling systems.

---

## 2. Layout and styling

- **Flex-first** — Use flex layout for predictable cross-end behavior. If React Native is ever targeted, **RN `View` defaults differ**; prefer explicit `flexDirection` where layout must match across ends.
- **Selectors** — Mini-program WXSS is limited vs browser CSS. For maximum portability (including RN), favor **single class selectors** and **BEM-style names** to avoid collisions under CSS Modules.
- **Units** — Repo config uses **`designWidth: 750`** in `apps/mini-program/config` — coordinate with **`rpx`** and existing Sass patterns. `postcss-pxtransform` may be in play depending on config; follow established file conventions.
- **Conditional styles** — Use Taro-style conditional compilation in styles or **multi-suffix files** (e.g. `*.weapp.scss`, `*.h5.scss`, `*.rn.scss`) when a platform truly needs different rules.
- **Overriding components** — Prefer class names and documented style props over ad hoc global overrides.

---

## 3. Components and ecosystem

- **Core components** — Import interactive and layout primitives from **`@tarojs/components`**. Use **PascalCase** names (`View`, `Text`, `Image`). Event props use the **`on*`** prefix (not `bind*`).
- **Optional UI libraries** — **NutUI**, **Taro UI**, **Tailwind / weapp-tailwindcss** are **not** JoyJoin defaults unless explicitly added to the app. Do not assume they are installed; prefer repo patterns.

### HTML and rich content

- **Do not use `dangerouslySetInnerHTML`** for cross-end HTML in Taro mini-program work. Prefer **`RichText`** (or structured `View`/`Text` composition) so content stays within platform safety and rendering rules.

---

## 4. Performance

### setData and update scope

WeChat performance is sensitive to **payload size** and **frequency** of updates. Mitigations:

- **`CustomWrapper`** — Wrap hot subtrees that update often so updates can be more localized (measure before over-wrapping).
- **`baseLevel`** — Lowering the template component depth can help **only** when profiled; it can break flex across native component boundaries and affect selector behavior (`>>>` / deep combinations). Treat as advanced.

### Lists and heavy screens

- Use **`VirtualList`** (or equivalent patterns) when collections approach the thresholds in [`../../design-system-governance/references/frontend-excellence-thresholds.md`](../../design-system-governance/references/frontend-excellence-thresholds.md).
- Prefer **ordinary subpackages** and **`preloadRule`** for heavy non-tab flows before independent subpackages; align with `taro-mini-program-frontend-engineer` agent guidance.

### Prerender

- Consider **prerender** only when profiling shows a real first-paint / hydrate problem—not as a default.

---

## 5. Cross-end adaptation

- **`process.env.TARO_ENV`** — Compile-time: `weapp`, `h5`, `rn`, etc. Dead code for other platforms is stripped.
- **Multi-suffix modules** — Prefer `foo.weapp.ts` / `foo.h5.ts` next to `foo.ts` for clean platform implementations with one import site.
- **Routing and params** — This app uses **React + Taro**: prefer **`useRouter`**, **`getCurrentInstance`**, or established repo helpers—not Vue-only `this.$router` examples from generic Taro docs.

---

## 6. Engineering

- **Monorepo** — Respect workspace and dependency rules ([`monorepo-workspace-governance`](../../monorepo-workspace-governance/SKILL.md) when changing root or shared packages).
- **CLI** — `taro doctor` for config and dependency issues; fix what it reports before claiming environment health.
- **WeChat DevTools** — For WeChat builds, common safe settings include turning **off** “ES6 → ES5” in devtools when it conflicts with the build pipeline, and avoiding extra minification/upload steps that fight the CI bundle—match team docs if stricter rules exist.

---

## 7. Quick reference

| Dimension | JoyJoin rule | APIs / patterns |
|-----------|----------------|-----------------|
| Components | `@tarojs/components`, PascalCase, `on*` events | `View`, `Text`, `Image`, `ScrollView`, `RichText` |
| Layout | Flex-first; BEM-friendly class names | `flexDirection`, `alignItems`, `justifyContent` |
| Units / density | `designWidth` 750 + `rpx` discipline | `config/index.ts`, Sass files |
| HTML-like content | No unsafe HTML injection | `RichText`, structured nodes |
| Updates | Localize hot trees | `CustomWrapper`, profile before `baseLevel` |
| Lists | Virtualize large collections | `VirtualList`, thresholds doc |
| Cross-end | Compile-time env + file suffixes | `TARO_ENV`, `*.weapp.*` |
| Assets | Budgeted, compressed, or vector | See §8 |

---

## 8. Raster, vector, and icon weight

Premium visuals must stay **measurable**. Do **not** silently merge oversized bitmaps or unoptimized SVGs.

### Thresholds and guardrails

| Context | Guidance |
|---------|----------|
| **Xiaoyue personality assets** | Enforced check: **`apps/mini-program/scripts/check-xiaoyue-asset-size.mjs`** — rasters under `src/assets/personality/xiaoyue/` must be **≤ 400 KiB** each (run `npm run check:xiaoyue-assets` from `apps/mini-program`). Use **`npm run optimize:xiaoyue`** (`optimize-xiaoyue-assets.mjs`) as the supported compression path. |
| **General UI PNG/JPEG/WebP** | **Flag for review** when a single inline UI asset exceeds roughly **100–200 KiB** without justification; **stricter** budgets for tab bar, launch, and first-screen hero paths. |
| **SVG icons** | Flag SVGs beyond **~20–50 KiB** or with excessive paths—run SVGO or simplify artwork. |
| **Uncertainty** | Measure: `ls -la`, build output, WeChat simulator package analytics, or Lighthouse / CWV on H5 when relevant. |

### When over budget — recommend (in order of fit)

1. **Modern raster** — WebP (and similar) where the runtime supports them; replace bloated PNG/JPEG.
2. **Recompression** — TinyPNG, ImageOptim, `sharp`, ImageMagick, or **repo scripts** (`optimize:xiaoyue` for that tree).
3. **SVG optimization** — SVGO, manual path cleanup, flattening unnecessary groups.
4. **Vector / CSS substitution** — Simple shapes, borders, gradients; avoid giant bitmaps for flat icons.
5. **Route / package strategy** — Move legitimately large hero media to **subpackage** or **non-critical** navigation timing so it does not wreck first paint or main package size.

### Premium without harming load

Crisp hierarchy and restrained motion must **not** depend on **unbounded** binary weight. Tie decisions to first-load and scroll smoothness expectations in [`../../frontend-performance-and-loading/SKILL.md`](../../frontend-performance-and-loading/SKILL.md) and [`../../../../docs/perf.md`](../../../../docs/perf.md) where applicable.

---

## Future / Taro 5 upgrade notes

Taro 5 introduces or emphasizes features such as **Taro Style**, theme APIs (e.g. `setThemeParams`-style theming), and platform-specific performance stories. **Do not rely on those names or APIs** until `apps/mini-program` officially upgrades and the team validates behavior. When upgrading:

- Re-read official Taro 5 migration docs.
- Re-run `taro doctor` and full weapp build.
- Revisit this reference and [`../SKILL.md`](../SKILL.md) for any needed rewrites.
