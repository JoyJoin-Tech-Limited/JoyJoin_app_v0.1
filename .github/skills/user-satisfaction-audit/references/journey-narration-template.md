# Journey Narration Template

The persona walk is the audit's spine: scores without narration are vibes; narration without scores is a diary. Walk the rendered screen (or flow) in first person, beat by beat, then mine the narration for scoring evidence.

## Rules

1. **First person, present tense, in character.** "I land on the page and the first thing I see is…" — not "The user sees…".
2. **One beat per observation.** A beat is one glance, one thought, one tap, or one feeling.
3. **Mark every friction beat explicitly** with `⚡` (hesitation, re-read, scroll hunt, confusion, dead end) and every delight beat with `✦` (smile, pause, "oh nice").
4. **Never skip the boring beats.** "I wait 2 seconds staring at a spinner" is a beat.
5. **Stay honest about exits.** If the persona would leave, write the beat where they leave — and score from there. Do not finish the walk on their behalf.
6. **Narrate only what you rendered.** If a state (loading, error, empty) couldn't be rendered, write `未渲染` and exclude it from evidence.

## Template

```text
Persona: [A/B/C/D — name]
Surface: [page / flow, route, build or screenshot source]
Device/context: [device tier, network, entry point — share link / tab / notification]

BEATS
1. I arrive from [entry point]. The first thing I see is [element]. I think: "[inner voice line]".
2. I notice [element]. I feel [emotion / nothing]. ✦ / ⚡
3. I look for [goal]. I find it [immediately / after scanning / after scrolling / not at all]. ⚡
4. I read "[exact copy]". I understand it [on first read / on second read ⚡ / not fully ⚡].
5. I tap [element]. I expect [outcome]. What happens: [actual outcome]. ✦ / ⚡
6. …

FRICTION LOG
- ⚡ Beat N: [what caused the hesitation, exact copy/element]

DELIGHT LOG
- ✦ Beat N: [what caused the reaction, exact copy/element]

EXIT RISK
- [The beat where the persona would leave, or "no exit risk observed"]

SCORING EVIDENCE MAP
- Angle 1 ← beats …
- Angle 2 ← beats …
- Angle 3 ← beats …
- Angle 4 ← beats …
- Angle 5 ← beats …
- Angle 6 ← beats …
```

## Multi-state walks

For a screen with multiple states (loading → loaded → error / empty → populated), narrate **each state as its own beat group** in the order the persona experiences them:

```text
STATE: loading (cold open, 4G)
1. I see [skeleton / spinner / blank]. I know what's coming: [yes ⚡ / no].
STATE: loaded
2. …
STATE: pull-to-refresh error (simulate offline)
3. …
```

Non-happy-path states are where Angle 2 and Angle 4 are usually won or lost — a warm error message with a mascot is worth more than a perfect happy path.

## Flow walks

For multi-screen flows (e.g., registration → payment → confirmation), add a **thread line** between screens:

```text
→ I carry [expectation / question / emotion] into the next screen.
```

A flow fails Angle 2 when the user must re-establish context on every screen, and fails Angle 5 when the final screen leaves nothing pending.
