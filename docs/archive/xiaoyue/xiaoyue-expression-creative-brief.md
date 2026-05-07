# Xiaoyue Expression Assets — Full Set Creative Brief

> **For:** Character Illustrator / 3D Artist  
> **From:** JoyJoin Product Team  
> **Status:** Ready for quoting  
> **Scope:** 16 unique expression assets (full library revamp)  
> **Delivery:** PNG masters + WebP exports  

---

## 1. Why a Full Set Revamp

> **Note for implementers:** Xiaoyue lives on **only as a visual mascot character** — loading animations, empty states, and personality-test decoration. The **conversational chat-based onboarding path is deprecated** and must not be revived. When you see "Xiaoyue" in code or docs, assume mascot/brand asset unless explicitly in `deepseekClientXiaoyue.ts` (legacy chat, enrichment mode only).

Our mascot Xiaoyue (小悦) currently has **9 unique art assets** serving **16 emotional states**. Seven states reuse the closest "close enough" asset. This worked for MVP, but breaks immersion in the personality test — where Xiaoyue appears as a visual host beside introspective questions.

The four test-phase fallbacks revealed the problem: a "cheerful encouragement" pose doesn't read as "curious inquiry." A "match success" celebration doesn't read as "surprised delight at a milestone." The user feels the mismatch even if they can't name it.

**Goal:** Every emotional moment in the product has a purpose-built Xiaoyue expression. Zero fallbacks. Zero "close enough."

---

## 2. Character Spec (Do Not Deviate)

### 2.1 Who Is Xiaoyue?

An anthropomorphic fox AI assistant. Not a human with fox ears — a fully anthropomorphic fox.

**Core persona:** "街头老狐狸" — a street-smart social veteran who's seen it all. Surface: relaxed, a little lazy, slightly knowing. Subsurface: deeply reliable, quietly warm, never judging.

**Age feel:** Young adult, 25–30 human equivalent.

### 2.2 Visual Constants (All 16 Expressions)

These must stay identical across every expression so the set reads as one character:

| Attribute | Spec |
|-----------|------|
| **Species** | Anthropomorphic fox |
| **Fur** | Warm orange-brown (#D4845C), natural sheen, tidy (not fluffy) |
| **Ears** | Standard fox upright ears, slightly outward tilt |
| **Eyes** | Amber, **looking slightly downward** (never direct camera). Pupils have a **faint purple/cyan halo** — subtle AI identifier, not glowing |
| **Tail** | Relaxed curl at one side (not wagging, not drooping) |
| **Clothing** | Purple hoodie (#8B5CF6), **lightly weathered** (natural wear, not pristine, not torn) |
| **Accessories** | Sunglasses hanging from collar (84% preference), vintage leather watch, minimal silver necklace |
| **Angle** | 3/4 view, slightly off-center weight |
| **Background** | Softly blurred café / bookshelf silhouette, warm tones |
| **Lighting** | Soft warm light from slightly above, soft natural shadows |
| **Style** | 3D anime render. Reference: *Zootopia* Nick Wilde, but **more relaxed, less slick/smug** |

### 2.3 What Xiaoyue Is NOT

- ❌ Not a cutesy mascot (no oversized eyes, no chibi proportions)
- ❌ Not a corporate chatbot (no headset, no uniform)
- ❌ Not an anime pretty-boy (no bishonen features)
- ❌ Not a realistic furry (stylized, appealing, readable at small sizes)

---

## 3. Expression Catalog — 16 Unique States

Grouped by emotional territory. Each state needs its own unique asset.

### Territory 1: Opening & Welcome (2 expressions)

---

#### `homeWelcome` — "Glad you're here"
**When it appears:** Landing page, personality test intro, emoji-tap questions.
**Current asset:** `xiaoyue-home-welcome.webp` (working, keep or refresh).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "Hey, come on in. This is going to be good." |
| **Body** | Open posture, one hand in pocket, other hand in relaxed "welcome" gesture. Slight lean forward. |
| **Head** | 15° tilt toward user, warm and inviting. |
| **Face** | Gentle open smile, cheeks slightly lifted. |
| **Eyes** | Soft, welcoming, looking down-toward (not at). |
| **Eyebrows** | Relaxed, neutral curve. |
| **Energy** | Warm / Moderate |
| **Notes** | This is the "first impression" pose. It sets the tone for everything else. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character, warm orange-brown fur, wearing a lightly weathered purple hoodie with sunglasses hanging from the collar. Open, welcoming body posture — one hand relaxed in a "come in" gesture, the other in the hoodie pocket. Head tilted 15° toward the viewer with a gentle, genuine smile. Eyes soft and looking slightly downward (not direct camera), with a faint purple halo in the pupils. Relaxed fox tail curled at his side. Background: softly blurred warm café interior. Soft warm lighting from above. 3D anime render style, relaxed "street-smart veteran" vibe — warm, inviting, never smug.

---

#### `coachGuide` — "Here's what I suggest"
**When it appears:** Inline coaching tips during onboarding, profile review guidance.
**Current asset:** `xiaoyue-cheer-encourage.webp` (overlaps with `optOutReassure` and `testCurious` — needs unique pose).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "I've done this before. Let me point you in the right direction." |
| **Body** | One hand raised in a casual "point / gesture" — not pointing AT the user, pointing to something beside him. |
| **Head** | Slight tilt, attentive. |
| **Face** | Confident, easy smile — the smile of someone who knows the answer but isn't showing off. |
| **Eyes** | Focused on the thing he's gesturing toward. |
| **Eyebrows** | Slightly raised, indicating "pay attention to this part." |
| **Energy** | Confident / Moderate |
| **Notes** | Key distinction from `homeWelcome`: more directed, less open-armed. Key distinction from `testCurious`: confident, not inquiring. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie, sunglasses hanging from collar. Confident but relaxed coaching pose — one hand casually gesturing to the side (not pointing at viewer, pointing at something beside him), other hand in pocket. Head slightly tilted with an easy, knowing smile. Eyes focused off-frame on the thing he's indicating, looking slightly downward. Eyebrows slightly raised as if saying "this part matters." Faint purple halo in pupils. Relaxed tail curled at his side. Background: softly blurred warm interior. 3D anime render, street-smart relaxed vibe — experienced, not bossy.

---

### Territory 2: Loading & Waiting (3 expressions)

---

#### `loadingSystem` — "Thinking..."
**When it appears:** System loading shells, fetching next question, processing.
**Current asset:** `xiaoyue-thinking.webp` (working, keep or refresh).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "Give me a second, I'm working on it." |
| **Body** | Still, grounded. Weight settled. |
| **Head** | Slightly down, chin tucked just a little. |
| **Face** | Neutral-concentrated. Mouth closed, no smile. |
| **Eyes** | Looking downward in focus, almost as if reading something invisible. |
| **Eyebrows** | Slightly drawn together — gentle concentration, not stress. |
| **Energy** | Calm / Low |
| **Notes** | Should NOT look worried or strained. This is "CPU thinking," not "human stressing." |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Still, grounded pose — weight settled, one hand in pocket, the other resting relaxed at his side. Head slightly lowered in quiet concentration, chin gently tucked. Neutral face, mouth closed, no smile. Eyes looking downward in focused thought, eyebrows slightly drawn together but NOT worried or strained — this is calm processing, not stress. Faint purple halo in pupils (subtle AI identifier). Relaxed tail curled at his side. Background: softly blurred warm interior. 3D anime render, relaxed street-smart vibe — "give me a second, I'm on it."

---

#### `loadingReveal` — "Here it comes..."
**When it appears:** Squad unboxing — the shaking animation before the reveal.
**Current asset:** `xiaoyue-match-waiting.webp` (fallback — needs unique art).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "Oh, this is going to be good. I can't wait for you to see." |
| **Body** | Leaning forward with contained excitement, weight on toes. One hand raised slightly as if holding back enthusiasm. |
| **Head** | Forward, eager. |
| **Face** | Anticipatory grin — mouth slightly open, excitement barely contained. |
| **Eyes** | Wide with excited anticipation, still looking slightly down (at the "box"). |
| **Eyebrows** | Raised, adding to the "eager" read. |
| **Energy** | High / Bubbly |
| **Notes** | Distinct from `matchWaiting` (patient hope) — this is ACTIVE excitement, not passive waiting. Should feel like Xiaoyue is about to open a gift WITH the user. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Leaning forward with contained excitement, weight shifted toward his toes, one hand slightly raised as if barely holding back enthusiasm. Head tilted forward eagerly. Face lit with an anticipatory grin — mouth slightly open, excitement barely contained. Eyes wide with eager anticipation, looking slightly downward (at an invisible "box" he's about to open WITH the user). Eyebrows raised, adding to the excitement. Faint purple halo in pupils. Tail possibly slightly more alert/curved. Background: softly blurred warm interior. 3D anime render, street-smart vibe — "this is going to be good, I can't wait for you to see."

---

#### `matchWaiting` — "Good things take time"
**When it appears:** Matching pending state — user has registered and is waiting for the algorithm.
**Current asset:** `xiaoyue-match-waiting.webp` (working, keep or refresh).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "The machine is working. I'm here with you while you wait." |
| **Body** | Relaxed stance, patient. One hand in pocket, the other resting casually. |
| **Head** | Gentle tilt, calm. |
| **Face** | Soft patient smile — not excited, not bored. Just "present." |
| **Eyes** | Gentle, looking slightly down, conveying "I'm not going anywhere." |
| **Eyebrows** | Relaxed, neutral. |
| **Energy** | Calm / Low-Moderate |
| **Notes** | This is SOCIAL waiting — Xiaoyue is keeping the user company. Not system processing (that's `loadingSystem`). Not excited reveal (that's `loadingReveal`). This is patient companionship. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Relaxed, patient stance — one hand in pocket, the other resting casually at his side. Head with a gentle tilt, calm and present. Soft, patient smile — not bored, not excited, just "I'm here with you." Eyes gentle, looking slightly downward, conveying quiet companionship. Eyebrows relaxed and neutral. Faint purple halo in pupils. Tail in its usual relaxed curl. Background: softly blurred warm interior. 3D anime render, street-smart vibe — "good things take time, and I'm not going anywhere."

---

### Territory 3: Success & Celebration (2 expressions)

---

#### `matchSuccess` — "You did it!"
**When it appears:** Matched overlay, personality results celebration page.
**Current asset:** `xiaoyue-match-success.webp` (working, keep or refresh).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "YES! Look at that — told you it'd work out." |
| **Body** | Open, celebratory. Both hands might be visible in a small "yes!" gesture, or one hand raised in triumph. |
| **Head** | Up, beaming. |
| **Face** | Full, genuine celebration smile — teeth slightly visible, warmth radiating. |
| **Eyes** | Bright, joyful, crinkled at the corners (but no aging wrinkles — fox fur texture only). |
| **Eyebrows** | Raised, adding joy. |
| **Energy** | High / Celebratory |
| **Notes** | This is the BIG emotion. The payoff moment. It should feel earned and genuine, not performative. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Celebratory, open body posture — one hand raised in a small "yes!" gesture of triumph, the other in pocket or also expressive. Head up, beaming with genuine joy. Full, warm celebration smile — teeth slightly visible, warmth radiating. Eyes bright and joyful, crinkled at the corners (fox fur texture, NOT aging wrinkles). Eyebrows raised adding to the happiness. Faint purple halo in pupils. Tail possibly slightly more animated in its curl. Background: softly blurred warm interior. 3D anime render, street-smart vibe — "YES! Told you it'd work out."

---

#### `actionSuccess` — "All set."
**When it appears:** Payment verified, action completed, general success.
**Current asset:** `xiaoyue-action-success.webp` (working, keep or refresh).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "Smooth. That's handled." |
| **Body** | Settled, one hand in pocket, maybe a small "OK" or thumbs-up gesture. |
| **Head** | Slight nod, satisfied. |
| **Face** | Small, closed-mouth satisfied smile — "job well done." |
| **Eyes** | Calm, looking down with quiet satisfaction. |
| **Eyebrows** | Relaxed, neutral. |
| **Energy** | Low-Moderate / Satisfied |
| **Notes** | Distinct from `matchSuccess`: this is quiet competence, not celebration. The difference between "you won the lottery!" and "your package arrived on time." Both positive, very different intensity. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Settled, competent pose — one hand in pocket, the other offering a relaxed "OK" or subtle thumbs-up gesture. Head with a small satisfied nod. Closed-mouth smile of quiet satisfaction — "smooth, that's handled." Eyes calm, looking slightly downward with contentment. Eyebrows relaxed and neutral. Faint purple halo in pupils. Tail in relaxed curl. Background: softly blurred warm interior. 3D anime render, street-smart vibe — quiet competence, not celebration. Understated reliability.

---

### Territory 4: Test Host — The Intentional Questioner (4 expressions)

These four are the core of the revamp. They define Xiaoyue's role during the personality test: not a cheerleader, not a robot — a curious, attentive host who is genuinely interested in the user's answers.

---

#### `testCurious` — "I'm curious about you"
**When it appears:** Presenting a choice question (A, B, C, D).
**Current asset:** `xiaoyue-cheer-encourage.webp` (fallback — NEW ART REQUIRED).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "Hmm, I wonder which one you'll pick. Both are interesting." |
| **Body** | One hand on chin in thoughtful pose, weight shifted. Leaning slightly in — engaged. |
| **Head** | Tilted 15°, inquiring. |
| **Face** | Warm open smile with a questioning edge — "I'm interested, not testing you." |
| **Eyes** | Looking at the user with gentle curiosity, slightly widened. |
| **Eyebrows** | Slightly raised — the classic "curious" eyebrow. |
| **Energy** | Moderate / Inquisitive |
| **Notes** | Key distinction from `coachGuide`: this is "I wonder..." not "I know." Key distinction from `homeWelcome`: more focused, less open-armed. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Thoughtful, curious pose — one hand on chin in a "pondering" gesture, weight shifted, leaning slightly toward the viewer as if genuinely interested. Head tilted 15° in an inquiring manner. Warm open smile with a questioning, curious edge — "I'm interested in your answer, not judging it." Eyes looking at the viewer with gentle curiosity, slightly widened. Eyebrows slightly raised in the classic "curious" expression. Faint purple halo in pupils. Tail in relaxed curl. Background: softly blurred warm interior. 3D anime render, street-smart vibe — "I wonder which you'll pick. Both are interesting."

---

#### `testListening` — "I'm listening"
**When it appears:** Presenting a slider / introspective question.
**Current asset:** `xiaoyue-match-waiting.webp` (fallback — NEW ART REQUIRED).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "Take your time. I'm right here." |
| **Body** | Leaning in, receptive. Both hands relaxed, possibly one hand open in a "go on" gesture. |
| **Head** | Forward, attentive. |
| **Face** | Neutral-attentive. No smile — this is serious listening, not cheerful encouragement. |
| **Eyes** | Focused forward, steady and gentle. Conveying "I see you." |
| **Eyebrows** | Relaxed, slightly drawn together in gentle focus. |
| **Energy** | Calm / Present |
| **Notes** | This is the MOST important new expression for the test phase. Sliders ask users to reflect on themselves — they need to feel SEEN, not cheered on. A smile here would break the mood. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Leaning in with receptive, attentive body language — weight forward, one hand relaxed and open in a "go on, I'm here" gesture, the other at his side. Head forward, fully attentive. Neutral face, NO smile — this is serious, respectful listening, not cheerful encouragement. Eyes focused forward, steady and gentle, conveying "I see you, take your time." Eyebrows relaxed, slightly drawn together in gentle focus. Faint purple halo in pupils. Tail in relaxed curl. Background: softly blurred warm interior. 3D anime render, street-smart vibe — "I'm listening. No rush."

---

#### `testNod` — "Got it."
**When it appears:** After user answers — brief acknowledgment before next question.
**Current asset:** `xiaoyue-action-success.webp` (fallback — NEW ART REQUIRED).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "Noted. Moving on." |
| **Body** | Small, minimal movement. Settled. |
| **Head** | Small gentle nod — 5–10° downward tilt, then back. |
| **Face** | Soft closed-mouth smile — "acknowledged." |
| **Eyes** | Looking down briefly (nodding), then back up. Warm, brief connection. |
| **Eyebrows** | Relaxed, no raised emphasis. |
| **Energy** | Very Low / Subtle |
| **Notes** | This expression is only shown for ~800ms between questions. It needs to read instantly as "I heard you" without distracting from the flow. Minimal motion, maximum clarity. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Minimal, settled pose — weight centered, hands relaxed. Small gentle nod — head tilted 5–10° downward in acknowledgment. Soft closed-mouth smile — subtle "got it." Eyes looking slightly down in the nod, then gently back up. Warm, brief connection. Eyebrows relaxed, no emphasis. Faint purple halo in pupils. Tail in relaxed curl. Background: softly blurred warm interior. 3D anime render, street-smart vibe — minimal motion, maximum clarity. "Noted. Moving on."

---

#### `testSurprised` — "That's really interesting!"
**When it appears:** Milestone questions (Q4, Q8) or unexpected convergence in answers.
**Current asset:** `xiaoyue-match-success.webp` (fallback — NEW ART REQUIRED).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "Oh! I didn't expect that — but it makes total sense." |
| **Body** | Slight recoil — shoulders back just a touch, hands rising slightly toward cheeks in delighted surprise. |
| **Head** | Back just a little, as if re-evaluating. |
| **Face** | Eyes widened with DELIGHT (not shock, not fear). Small gasp expression — mouth slightly open in an "oh!" shape. |
| **Eyes** | Widened, sparkling with interest. |
| **Eyebrows** | Raised high — but the smile keeps it warm, not alarmed. |
| **Energy** | High / Delighted |
| **Notes** | This is "pleasant surprise" — the joy of discovery. NOT shock, NOT alarm. The smile is what keeps it warm. Think "oh, that's fascinating!" not "oh no!" |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Delighted surprise pose — slight recoil with shoulders back just a touch, hands rising slightly toward his cheeks in a "oh, wow!" gesture. Head back just a little as if re-evaluating with fresh eyes. Eyes widened with DELIGHT (not shock, not fear), sparkling with genuine interest. Mouth slightly open in a small "oh!" of pleasant surprise. Eyebrows raised high, BUT the warm smile keeps it delighted rather than alarmed. Faint purple halo in pupils. Tail possibly slightly more alert. Background: softly blurred warm interior. 3D anime render, street-smart vibe — "Oh! I didn't expect that — but it makes total sense."

---

### Territory 5: Failure & Recovery (2 expressions)

---

#### `actionFailure` — "No worries, let's try again"
**When it appears:** Payment failed, network error, retryable error states.
**Current asset:** `xiaoyue-action-failure.webp` (working, keep or refresh).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "Hmm, that didn't work. But it's fixable. Don't stress." |
| **Body** | Relaxed, one hand in pocket, the other in a casual "shrug" or "let's retry" gesture. |
| **Head** | Slight tilt, empathetic. |
| **Face** | Gentle, reassuring expression — no panic, no disappointment. "This happens." |
| **Eyes** | Soft, looking at user with "it's okay" warmth. |
| **Eyebrows** | Slightly raised in gentle concern, not worry. |
| **Energy** | Low / Reassuring |
| **Notes** | Must NOT look sad or disappointed. The user already feels bad about the error. Xiaoyue should absorb the stress, not add to it. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Relaxed, unbothered pose — one hand in pocket, the other in a casual "shrug, no big deal" gesture. Head slightly tilted with empathetic warmth. Gentle, reassuring expression — NO panic, NO disappointment. Soft eyes looking at the viewer with "it's okay, this happens" warmth. Eyebrows slightly raised in gentle concern, not worry. Faint purple halo in pupils. Tail in relaxed curl. Background: softly blurred warm interior. 3D anime render, street-smart vibe — stress-absorbing, not stress-adding. "No worries, let's try again."

---

#### `optOutReassure` — "It's okay, no pressure"
**When it appears:** User cancels registration, opts out, or skips something.
**Current asset:** `xiaoyue-cheer-encourage.webp` (fallback — NEW ART REQUIRED).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "Hey, totally your call. No hard feelings. Come back whenever." |
| **Body** | Open, non-defensive. One hand in pocket, the other in a relaxed "it's fine" wave or open palm. |
| **Head** | Gentle tilt, non-judgmental. |
| **Face** | Warm, understanding smile — not cheerful, not sad. Just "I get it." |
| **Eyes** | Soft, looking at user with permission-giving warmth. |
| **Eyebrows** | Relaxed, neutral. |
| **Energy** | Low / Permissive |
| **Notes** | Key distinction from `actionFailure`: this is not about an error, it's about user choice. Key distinction from `coachGuide`: no direction, no "should." Pure permission. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Open, non-defensive pose — one hand in pocket, the other in a relaxed "it's totally fine" open-palm gesture. Head gently tilted, completely non-judgmental. Warm, understanding smile — not overly cheerful, not sad. Just "I get it, your call." Eyes soft, looking at the viewer with permission-giving warmth. Eyebrows relaxed and neutral. Faint purple halo in pupils. Tail in relaxed curl. Background: softly blurred warm interior. 3D anime render, street-smart vibe — "no pressure whatsoever, come back whenever."

---

### Territory 6: Closure & Gratitude (2 expressions)

---

#### `thanksFeedback` — "Thanks for sharing"
**When it appears:** Event feedback submitted, results bridge / warm handoff.
**Current asset:** `xiaoyue-thanks-feedback.webp` (working, keep or refresh).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "That means a lot. Really." |
| **Body** | Warm, one hand over heart or in a small grateful gesture. |
| **Head** | Slight bow/nod of appreciation. |
| **Face** | Genuine warmth, eyes crinkled in a true smile. |
| **Eyes** | Looking at user with real gratitude. |
| **Eyebrows** | Relaxed, soft. |
| **Energy** | Moderate / Warm |
| **Notes** | This is the "warm close" — the feeling of a good conversation ending on a high note. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Warm, grateful pose — one hand in a small gesture of thanks (over heart or gentle open palm), the other relaxed. Head with a slight bow/nod of genuine appreciation. Face lit with real warmth, eyes crinkled in a true smile of gratitude. Eyes looking at the viewer with sincere "that means a lot" warmth. Eyebrows relaxed and soft. Faint purple halo in pupils. Tail in relaxed curl. Background: softly blurred warm interior. 3D anime render, street-smart vibe — the warm close of a good conversation.

---

#### `neutralInformation` — "Just so you know"
**When it appears:** Legal/terms pages, login screen, informational states.
**Current asset:** `xiaoyue-reminder-notice.webp` (fallback — NEW ART REQUIRED).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "Here's the info. Plain and simple." |
| **Body** | Neutral stance, neither open nor closed. Hands relaxed at sides or one in pocket. |
| **Head** | Straight, level. No tilt. |
| **Face** | Neutral-calm. Minimal expression — not cold, just calm. |
| **Eyes** | Steady, looking slightly down. Professional warmth without familiarity. |
| **Eyebrows** | Neutral, flat. |
| **Energy** | Very Low / Neutral |
| **Notes** | This is the "professional" Xiaoyue — present but not inserting personality into legal text. Still warm (never cold), just quiet. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Neutral, calm stance — weight even, hands relaxed at his sides or one in pocket. Head straight and level, no tilt. Neutral-calm face, minimal expression — not cold, not overly friendly. Just present. Eyes steady, looking slightly downward with professional warmth without over-familiarity. Eyebrows neutral and flat. Faint purple halo in pupils. Tail in relaxed curl. Background: softly blurred warm interior. 3D anime render, street-smart vibe — "here's the info, plain and simple." Quiet presence.

---

### Territory 7: Trust & Transaction (1 expression)

---

#### `paymentTrust` — "Your money is safe with us"
**When it appears:** Payment page header, verification polling.
**Current asset:** `xiaoyue-reminder-notice.webp` (fallback — NEW ART REQUIRED).

| Direction | Detail |
|-----------|--------|
| **Inner monologue** | "I've got this. Your transaction is secure." |
| **Body** | Grounded, stable. Both feet planted. One hand in pocket, the other resting on an invisible counter or giving a subtle "trust me" gesture. |
| **Head** | Steady, confident. |
| **Face** | Calm, trustworthy expression — the face of someone who's handled thousands of transactions. |
| **Eyes** | Steady, looking slightly down with quiet confidence. |
| **Eyebrows** | Relaxed, neutral. |
| **Energy** | Low / Grounded |
| **Notes** | Distinct from `neutralInformation`: this is about TRUST, not just information. Xiaoyue should feel like a reliable business partner — competent, secure, unshakeable. |

**Designer prompt:**
> 3/4 view anthropomorphic fox character in a lightly weathered purple hoodie. Grounded, stable stance — both feet planted, weight centered, one hand in pocket, the other resting in a subtle "trust me" gesture or on an invisible counter. Head steady and confident. Calm, trustworthy expression — the face of someone who's handled this a thousand times. Eyes steady, looking slightly downward with quiet, unshakeable confidence. Eyebrows relaxed and neutral. Faint purple halo in pupils. Tail in relaxed curl. Background: softly blurred warm interior. 3D anime render, street-smart vibe — "your money is safe, I've got this." Competent, secure, reliable.

---

## 4. Expression Comparison Matrix

Use this to check that every expression is visually distinct from its neighbors:

| Expression | Mouth | Eyes | Eyebrows | Head | Energy |
|------------|-------|------|----------|------|--------|
| `homeWelcome` | Open smile, warm | Soft, welcoming | Relaxed | 15° tilt | Moderate |
| `coachGuide` | Easy, knowing smile | Focused off-frame | Slightly raised | Slight tilt | Moderate |
| `loadingSystem` | Closed, neutral | Downward, focused | Slightly drawn | Slightly down | Low |
| `loadingReveal` | Grin, mouth open | Wide, excited | Raised | Forward | High |
| `matchWaiting` | Soft patient smile | Gentle, present | Relaxed | Gentle tilt | Low-Moderate |
| `matchSuccess` | Full celebration smile | Bright, joyful, crinkled | Raised | Up | High |
| `actionSuccess` | Closed, satisfied | Calm, down | Relaxed | Small nod | Low-Moderate |
| `testCurious` | Warm questioning smile | Slightly widened, curious | Slightly raised | 15° tilt | Moderate |
| `testListening` | Neutral, NO smile | Steady, focused | Slightly drawn | Forward | Calm |
| `testNod` | Closed, soft smile | Brief down-then-up | Relaxed | 5–10° nod | Very Low |
| `testSurprised` | Small "oh!" open | Widened with delight | Raised high | Back slightly | High |
| `actionFailure` | Gentle, reassuring | Soft, warm | Slightly raised | Slight tilt | Low |
| `optOutReassure` | Understanding smile | Soft, permissive | Relaxed | Gentle tilt | Low |
| `thanksFeedback` | True grateful smile | Crinkled, warm | Soft | Slight bow | Moderate |
| `neutralInformation` | Minimal, calm | Steady, down | Flat | Straight | Very Low |
| `paymentTrust` | Calm, trustworthy | Steady, confident | Relaxed | Steady | Low |

**Check:** No two expressions should share the same combination of Mouth + Eyes + Energy.

---

## 5. Technical Spec

### Master Files (Your Delivery)
- **Format:** PNG with transparent background
- **Resolution:** Minimum 2000×3000px
- **Color mode:** sRGB
- **Naming:** `xiaoyue-{expression-id}_master.png`

### Raster Exports (We Can Also Do This In-House)
- **Format:** WebP (lossy)
- **Max width:** 480px (height proportional, no upscale)
- **Quality:** ~85
- **Target size:** ~35KB per file (largest UI slot is ~300rpx at ~3x density)
- **Naming:** `xiaoyue-{expression-id}.webp`

### Pipeline
```
Your delivery:
  xiaoyue-home-welcome_master.png
  xiaoyue-coach-guide_master.png
  ... (16 files)

Our conversion:
  npm run optimize:xiaoyue  →  generates .webp files
```

### Consistency Requirements
- All 16 expressions must share the **exact same angle, lighting, and background treatment**
- Variation comes from FACE and BODY LANGUAGE only — never from camera angle, lighting, or background changes
- Deliver a **style reference sheet** showing all 16 expressions in a grid so we can verify consistency

---

## 6. Deliverables Checklist

### Required
- [ ] 16 expression master PNGs (transparent background, ≥2000×3000px)
- [ ] Style reference sheet (grid of all 16 expressions for consistency check)
- [ ] Character turnaround / model sheet (if not already provided from prior work)

### Optional (Quote Separately)
- [ ] Animated versions (Lottie or frame sequences) for `testNod`, `loadingSystem`, `loadingReveal`
- [ ] Avatar crop versions (circular, face-only) for profile / share cards
- [ ] WebP exports (we can handle this in-house if preferred)

---

## 7. Acceptance Criteria

We will approve the set when:

1. **Consistency:** All 16 read as the same character at a glance.
2. **Distinctness:** Every expression is visually distinguishable from every other (per matrix above).
3. **Emotional accuracy:** Each expression evokes its intended feeling within 500ms of viewing.
4. **Technical compliance:** Masters meet resolution and transparency specs.
5. **Brand alignment:** Character matches the "street-smart veteran fox" persona — relaxed, reliable, never cutesy, never corporate.

---

## 8. Existing Assets for Reference

If helpful, we can provide our current 9 WebP assets as style/quality reference. These were created for our MVP and represent the baseline we're improving from. Several will be retired once this new set is delivered.

---

## 9. Timeline & Milestones (Suggested)

| Milestone | Deliverable | Review Focus |
|-----------|-------------|--------------|
| **Week 1** | Style reference sheet + 3 key expressions (`homeWelcome`, `testListening`, `matchSuccess`) | Character consistency, emotional accuracy |
| **Week 2** | Full 16-expression first pass | Distinctness, coverage across territories |
| **Week 3** | Revision round + final masters | Polish, technical compliance |
| **Week 4** | Final delivery + style reference sheet | Sign-off |

---

*Document version: 1.0*  
*Based on: JoyJoin Xiaoyue Design Guide v1.0, 500-person user testing data*  
*Expression system: 16-state canonical registry (see `apps/mini-program/src/lib/xiaoyueExpressions.ts`)*
