# User Satisfaction Audit — WebGL Spike vs CSS: Comparative Verdict

**Date:** 2026-07-19 · **Skill:** `user-satisfaction-audit` · **Persona:** A — 首见用户 (the only persona who ever sees this flow)
**Variants:** (E) shipped CSS reel · (P+) CSS storyboard-complete + F1 blend reframe · (W) WebGL spike (hybrid: CSS reel + WebGL land moment)
**Pre-registered gate (strategy §B1):** W ships only if **Angle-4 composite improves ≥ +3** over the CSS comparison AND **Angle 6 earns 4** AND 55fps device AND ≤600KB.

## Evidence basis

- **W: rendered truth.** Full beat-by-beat renders from the spike session (`prototypes/webgl-reveal/shots/`): drum spin, flash, burst peak, resolve, settled Pokémon-style card. Walked visually this session.
- **E/P+: carried from the 2026-07-19 audit** (`user-satisfaction-audit-slot-machine-existing-vs-proposed-2026-07-19.md`): E = code-walk + June rendered audits; P+ = design intent.

---

## 1. Persona walk — (W) WebGL, from the renders

```text
1. The reel resolves into a 3D RING of cards rotating in space — depth, not a flat
   feed. The front card glows like light gathering at the center. ✦ "Something is
   being assembled."
2. FLASH — white-orange fills the screen for a beat. Startle → excitement. ✦
3. Gold particle STORM — thousands of sparks with trails, filling the frame. ✦✦
   (t=1.2: this is the screen-record moment.)
4. Through the cloud, a CARD resolves — spring-loaded, slight rotation, camera
   pushing in. It's not an image — it's a Pokémon-style 命格卡: MY name in the
   banner, 典型 pill, framed art, keywords, a set number No.01/12. ✦✦
   (t=1.45 → t=2.0 resolve beat: the "oh it's MINE" moment.)
5. The art window has a holo sheen that moves when I move the phone (tilt).
   Undiscovered at first — a second-layer delight. ✦
6. Caption letters land below: 开心柯基 · 典型命格.

FRICTION LOG
- ⚡ Beat 2–3: card fully obscured ~0.3s at flash peak (intentional Pokémon beat;
  resolves cleanly — acceptable, but density could trim ~15%).
- ⚡ "Is this random?" persists — the WebGL moment does NOT include answer-echo
  whispers (Angle-2 fix is renderer-orthogonal).
- ⚡ Tilt is undiscoverable — no hint that the card responds.

DELIGHT LOG
- ✦✦ Beat 3 (gold storm), Beat 4 (card resolves through cloud — the smile).
- ✦ Beat 1 (light gathering), Beat 5 (tilt discovery).
```

## 2. Scores — three-way, persona A

| Angle | E | P+ | W | W evidence |
|---|---|---|---|---|
| 1 · 3s clarity | 3 | 3 | 3 | Renderer-neutral; headline fix pending in all |
| 2 · Cognitive smoothness | 3 | 3 | 3 | Echo-whisper fix pending in all; "is it random?" persists |
| 3 · Cleanliness | 4 | 4 | **3** | Peak density (flash+storm+card simultaneously) — torn 3/4, took lower; earns 4 with ~15% particle-density trim at peak |
| 4 · Emotional resonance | 3 | 4 | **4** | Composite below |
| 5 · Return hooks | 3 | 3 | 3 | `No.01/12` collectibility nudges but plants no pending thread — structural fix is renderer-neutral |
| 6 · Share-worthiness | 3 | 3 | **4** | Grill-me survives: exact artifact = the t=1.2→1.45 burst-to-resolve recording + the named 命格卡; survives thumbnail; persona A names the exact friend (the one who shared the link) |
| **Total** | **19** | **19–20** | **20** | Band: 愿意回来, W at the 爱不释手 threshold |

### Angle 4 detail — 情绪价值 composite

| Sub-dimension | E | P+ | W | Note |
|---|---|---|---|---|
| 归属感 | 2 | 2 | 2 | Structurally capped — no community at this surface in ANY variant |
| 成就感 | 3 | 4 | 4 | W: crafted gift moment, rendered and verified |
| 身份认同 | 3 | 4 | 4 | W: the 命格卡 (name banner + pill + set number) is an ownable badge-object |
| 惊喜感 | 2 | 3 | **4** | W: multiple rendered wow beats (light-gathering, storm, spring-out, tilt). Built → allowed to score 4 |
| 被理解感 | 2 | 3 | 3 | F1 blend reframe helps equally in both; echo whispers still pending |
| 仪式感 | 3 | 4 | 4 | W: camera dolly makes it a scene, not a screen |
| **Composite → Angle 4** | **15 → 3** | **20 → 4** | **21 → 4** | |

## 3. Gate verdict — and a finding about the gate itself

| Criterion | Result |
|---|---|
| Angle-4 composite ≥ +3 over CSS | ❌ **FAIL: +1 (21 vs 20)** |
| Angle 6 = 4 | ✅ PASS |
| ≤600KB | ✅ PASS (537KB) |
| 55fps device | ⏳ pending (26fps SwiftShader = software floor only) |

**⚠️ Finding: the pre-registered +3 threshold was mathematically unsatisfiable.** 归属感 is structurally capped at 2 (no community surface at this step), so the maximum reachable composite is 22 (2+4+4+4+4+4). Against P+'s 20, the maximum possible delta was **+2**, never +3. The gate was mis-calibrated when written — flagging honestly rather than quietly re-scoring.

**What W actually delivers over P+:** +1 composite (21 vs 20, via 惊喜感 3→4) AND Angle 6 from 3→4 (the only variant where the *moment itself* — not just the poster — is shareable) AND it converts two "design intent" 4s into rendered, verified 4s. What it does NOT deliver: anything on Angles 1/2/5 (renderer-neutral structural fixes), and it costs −1 on Angle 3 transiently.

## 4. Recommendation

The renderer question and the 24/24 question are **separable**, and conflating them was the gate's design flaw:

1. **Ship the renderer-neutral fixes regardless** (they carry most of the score): F1 blend reframe, echo whispers, Angle-1 headline, return-hook wiring, storyboard-complete CSS celebration.
2. **Recalibrate the WebGL gate** for PM ratification — proposed: *composite +1 AND Angle 6 = 4 AND 55fps on the baseline device AND ≤600KB at Taro-integration re-measure*. W currently meets 3 of 4; only real-device FPS remains.
3. If device FPS passes: ship the **hybrid** (CSS reel + WebGL land moment, `full` tier only, CSS P+ celebration as `reduced`-tier fallback) — exactly the spike architecture. If FPS fails: CSS P+ ships alone and the spike is shelved with evidence.
4. The Pokémon-style 命格卡 canvas generator (built in the spike) is **renderer-neutral** — adopt it for the CSS version's card, the share poster, and Profile regardless of the WebGL decision.

## 5. What this does NOT close

- Real-device FPS/thermal (needs human + mid-tier Android).
- Taro-integration bundle re-measure (esbuild floor 537KB; webpack estimate 560–600KB).
- 24/24 remains a post-build re-audit target; W's realistic ceiling with all structural fixes shipped ≈ 22–23 (归属感 stays 2 until archetype meets community at a later surface).
