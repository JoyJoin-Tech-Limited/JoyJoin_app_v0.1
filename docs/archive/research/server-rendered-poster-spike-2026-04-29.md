# Server-Rendered Poster Spike Evaluation

> Sprint 5 deliverable: Evaluate sustainable escape from Canvas 2D complexity ceiling.  
> Date: 2026-04-29  
> Context: JoyJoin personality result share posters (1080×1920 tall, 750×750 square)

---

## 1. Problem Statement

**Current state:** Both tall (1080×1920) and square (750×750) posters are generated client-side via WeChat Mini Program Canvas 2D API.

**Pain points:**
- **Complexity ceiling**: Canvas 2D is imperative — every pixel is drawn by code. Adding new elements (trait bars, skill badges, holographic effects) requires coordinate math, manual text wrapping, and careful RAM management.
- **DPR fragility**: Export quality depends on device pixel ratio and available RAM. Low-end Android phones cap at DPR=1, producing blurry posters.
- **Cross-surface duplication**: Web `PokemonShareCard` (React/CSS) and mini-program `sharePoster.ts` (Canvas 2D) are completely separate implementations. Visual parity requires double work.
- **No caching**: Every share regenerates the poster from scratch (~1–2s on mid-range devices).
- **Font limitations**: Canvas `measureText` has inconsistent CJK width reporting across WeChat base library versions.

**Goal**: Find a server-side rendering approach that:
1. Supports CJK text, custom fonts, images, gradients, shadows
2. Can output 1080×1920 and 750×750 PNGs
3. Fits within JoyJoin's existing Node.js/Express server
4. Is operationally sustainable (memory, CPU, cold-start)
5. Allows reuse of existing web React components where possible

---

## 2. Option Evaluation Matrix

### 2.1 Satori + Resvg

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Fidelity** | ⭐⭐⭐☆☆ | Good for text + flexbox layouts. No box-shadow, no transforms, limited border-radius, no absolute positioning. Holographic sheen and foil sparkles would need SVG workaround. |
| **CJK Support** | ⭐⭐⭐☆☆ | Requires manual font file loading (`fetch` + `ArrayBuffer`). Simplified Chinese font files are 5–10MB. Must subset or load on-demand. |
| **Image Support** | ⭐⭐⭐⭐☆ | `loadImage` supports remote URLs and data URIs. Works well for archetype assets. |
| **Performance** | ⭐⭐⭐⭐⭐ | ~50–200ms per image. No browser overhead. Small bundle (~1MB). |
| **Ops Cost** | ⭐⭐⭐⭐⭐ | Pure Node.js, no native deps beyond `resvg-js` (Rust binary). Runs in existing server. |
| **Maintainability** | ⭐⭐⭐☆☆ | JSX templates are readable, but CSS subset is limiting. Complex layouts become verbose. |

**Verdict**: Best for simple OG-image-style cards. Our tall poster with holographic effects, layered gradients, and precise positioning would push Satori beyond its comfort zone.

---

### 2.2 Puppeteer / Playwright

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Fidelity** | ⭐⭐⭐⭐⭐ | Full Chromium rendering — any CSS, any layout. Can reuse existing `PokemonShareCard.tsx` almost verbatim. |
| **CJK Support** | ⭐⭐⭐⭐⭐ | System fonts or `@font-face` loading. No special handling needed. |
| **Image Support** | ⭐⭐⭐⭐⭐ | Native `<img>` tags, automatic loading and caching. |
| **Performance** | ⭐⭐☆☆☆ | Browser launch ~300–800ms. Per-page render ~200–500ms. Total ~500ms–1.3s cold. |
| **Ops Cost** | ⭐⭐☆☆☆ | Chromium is ~150MB. Needs Docker with Chrome deps or `playwright-chromium` binary. Memory per instance: ~100–300MB. |
| **Maintainability** | ⭐⭐⭐⭐⭐ | Reuse existing React components. Design changes propagate automatically. |

**Verdict**: Best fidelity and maintainability, but high operational cost. Viable only with aggressive caching (S3/R2) and warm browser pools.

---

### 2.3 Sharp + SVG Templates

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Fidelity** | ⭐⭐⭐☆☆ | SVG supports gradients, filters, masks. No flexbox — layout is manual coordinate math. Text wrapping is manual. |
| **CJK Support** | ⭐⭐⭐☆☆ | Font embedding via `@font-face` in SVG. CJK font files are large; subsetting required. |
| **Image Support** | ⭐⭐⭐⭐☆ | `<image>` tags with data URIs or external URLs. |
| **Performance** | ⭐⭐⭐⭐⭐ | SVG → PNG via Sharp/libvips is very fast (~50ms). |
| **Ops Cost** | ⭐⭐⭐⭐⭐ | Sharp is a well-maintained native dep. Already used by many Node.js projects. |
| **Maintainability** | ⭐⭐☆☆☆ | SVG templates for complex layouts are verbose and hard to reason about. |

**Verdict**: Good for simple layouts, but our poster design is too complex for hand-written SVG. Would recreate the same complexity problem in a different syntax.

---

### 2.4 node-canvas / skia-canvas

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Fidelity** | ⭐⭐⭐⭐☆ | Same Canvas 2D API as client-side. Supports all the same effects. |
| **CJK Support** | ⭐⭐⭐☆☆ | Font registration is manual. CJK font files must be loaded from disk. |
| **Image Support** | ⭐⭐⭐⭐⭐ | `drawImage` works natively. |
| **Performance** | ⭐⭐⭐⭐☆ | Fast (~100–300ms). No browser overhead. |
| **Ops Cost** | ⭐⭐⭐☆☆ | `node-canvas` requires Cairo/native deps. `skia-canvas` is lighter but still has native bindings. Docker compatibility varies. |
| **Maintainability** | ⭐⭐☆☆☆ | Same imperative complexity as client-side Canvas 2D. Doesn't solve the root problem. |

**Verdict**: Just moves the complexity from client to server. No net improvement in maintainability.

---

### 2.5 Cloudflare Workers + @vercel/og (Satori edge)

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Fidelity** | ⭐⭐⭐☆☆ | Same as Satori (CSS subset limitations). |
| **CJK Support** | ⭐⭐⭐☆☆ | Font files must be bundled or fetched at runtime. 1MB Worker bundle limit is tight with CJK fonts. |
| **Performance** | ⭐⭐⭐⭐⭐ | Edge-rendered, sub-100ms cold start. |
| **Ops Cost** | ⭐⭐⭐⭐⭐ | No server maintenance. Pay-per-request. |
| **Maintainability** | ⭐⭐⭐☆☆ | Same Satori limitations. |

**Verdict**: Good for simple social cards. Our complex poster with images and effects exceeds practical edge limits.

---

## 3. Comparative Summary

| Approach | Fidelity | Perf | Ops Cost | CJK | Best For |
|----------|----------|------|----------|-----|----------|
| **Satori + Resvg** | Medium | Excellent | Low | Tricky | Simple text-heavy cards |
| **Puppeteer** | Excellent | Poor | High | Perfect | Complex layouts, component reuse |
| **Sharp + SVG** | Medium | Excellent | Low | Tricky | Simple geometric layouts |
| **node-canvas** | High | Good | Medium | Tricky | Canvas-native effects |
| **Edge (@vercel/og)** | Medium | Excellent | Very Low | Tricky | Simple OG images |

---

## 4. Recommendation

### Phase A: Now — Keep Client-Side, Extract Shared Template

**Don't invest in server rendering yet.** The client-side canvas works and is shippable. Instead:

1. **Extract a shared JSON template schema** that describes the poster layout declaratively:
   ```json
   {
     "archetype": "corgi",
     "traitBars": [{"label": "亲和力", "value": 78}],
     "skills": {"active": "...", "passive": "..."},
     "layout": "tall" // or "square"
   }
   ```
2. **Make both Canvas implementations data-driven** from this schema. Reduces duplication.
3. **Add client-side caching** — store generated poster paths in `wx.getStorageSync` keyed by archetype+variant+nickname hash. Regenerate only when inputs change.

### Phase B: H2 — Puppeteer with Aggressive Caching

When share volume justifies the ops investment:

1. **Add `/api/poster/personality` endpoint** that accepts a JSON payload and returns a PNG URL.
2. **Use Playwright** (lighter than Puppeteer) with a persistent browser context:
   - Launch browser on server startup
   - Reuse pages via a pool
   - Render a hidden HTML template with the payload injected as `window.__POSTER_DATA__`
3. **Cache strategy**:
   - Hash the payload → deterministic filename
   - Store in S3/Cloudflare R2
   - Cache hit: return signed URL (~1ms)
   - Cache miss: render + upload (~500–800ms)
4. **Pre-warm cache** for all 12 archetypes × 3 color variants = 36 combinations on deploy.

**Estimated cost**: ~$20–50/mo in R2 storage + bandwidth at current scale. Negligible server impact with caching.

### Phase C: Future — Hybrid Satori for Square, Puppeteer for Tall

If square poster volume is high but tall poster is rare:
- Square (750×750): Use Satori — simple enough to fit its CSS subset
- Tall (1080×1920): Use Puppeteer — complex effects justify the cost

---

## 5. Migration Path from Client-Side Canvas

```
Current:                    Future:
┌─────────────────┐        ┌─────────────────┐
│ Mini-Program    │        │ Mini-Program    │
│ Canvas 2D       │        │ GET /api/poster │
│ (imperative)    │   →    │ (declarative)   │
└─────────────────┘        └─────────────────┘
                                  │
                                  ▼
                           ┌─────────────────┐
                           │ Server          │
                           │ Playwright/S3   │
                           │ (cached PNG)    │
                           └─────────────────┘
```

**Incremental steps:**
1. Build server endpoint that accepts poster JSON and returns a cached PNG URL
2. Update mini-program to call endpoint when sharing (fallback to client canvas if offline)
3. Gradually shift traffic as cache hit rate improves
4. Eventually deprecate client canvas for online users

---

## 6. Proof-of-Concept Scope

If we greenlight a PoC in H2:

**Time estimate**: 3–5 days  
**Deliverables**:
- `/api/poster/personality` endpoint (Playwright + R2)
- HTML template matching current tall poster design
- Cache layer with deterministic hashing
- Mini-program integration (fallback to client canvas)
- Load test: 100 concurrent requests

**Success criteria**:
- p95 render time < 1s (cache miss)
- p99 render time < 10ms (cache hit)
- Visual pixel-match with client canvas > 98%
- Server memory delta < 200MB

---

## 7. Decision

**Recommended**: Defer server rendering to H2. Keep client-side canvas for now, but extract shared template schema to reduce duplication and ease future migration.

**Rationale**:
- Client canvas is working and shippable after Sprints 1–4
- Server rendering is a significant ops investment (Playwright, R2, caching)
- Share volume doesn't yet justify the infrastructure cost
- A shared template schema gives us 80% of the maintainability benefit without the ops overhead
