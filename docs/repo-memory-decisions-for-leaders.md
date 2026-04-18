# Repo memory — decisions for leaders (plain English)

This page is for **product owners, founders, and anyone approving how we “remember” things in the repo** — no coding background required. Technical details live in `repo-memory/README.md` and `.github/agents/repo-memory-steward.agent.md`.

---

## What problem this solves

Our AI and automation helpers work better when **important lessons don’t disappear after each chat**. **Repo memory** is the team’s chosen place to store **reviewed, durable facts** (strategies, constraints, “we decided X”) so we don’t re-invent them every week.

---

## The two “buckets” (you only need this mental model)

| Bucket | Plain English | When it counts |
|--------|----------------|----------------|
| **Draft / candidate** | A proposed memory note — like a memo in “review.” | Good for discussion; **not** yet treated as official team truth everywhere. |
| **Promoted** | Approved and indexed — “this is how we do it until we change it.” | Feeds retrieval and advisory tooling; **stronger** effect on future automation. |

**Your call, in practice:**  
- **“Let’s try it as a draft first”** → keep it a **candidate** until you’re comfortable.  
- **“This is official”** → **promote** (after you’re happy with the wording).

---

## Decision points (what you might be asked to choose)

### 1. Should this lesson become durable memory at all?

**Ask yourself:** Will we care about this **six months from now**? Is it a **repeatable rule** (not a one-off bug fix)?

- **Yes** → worth capturing (draft or promoted).  
- **No** → a ticket or chat comment may be enough.

---

### 2. Draft only, or promote to “official”?

**Draft (candidate)**  
- Lower risk; easy to revise.  
- Good when the idea is right but the **wording or scope** still needs a pass.

**Promote**  
- Says: **this is canonical** for the team’s tooling and retrieval.  
- Use when you’re willing to stand behind it in a **PR review** (or equivalent sign-off).

*Nothing here requires you to read code — only to agree on **accuracy** and **authority**.*

---

### 3. One-step “save and lock” vs two steps

We support automation so engineers don’t have to run two separate commands:

- **Two steps:** draft first → promote later (more pause for review).  
- **One step (`auto-land`):** draft **and** promote in a single action, only when someone explicitly opts in with a safety switch.

**Your policy choice as a leader:**

| If you want… | Tell the team… |
|--------------|----------------|
| Maximum caution | “Never use one-step; always draft, then we review, then promote.” |
| Speed with guardrails | “One-step is OK only after **I’ve reviewed the text** (e.g. in a PR).” |
| Engineers self-serve | “Use one-step for low-stakes notes; escalate anything customer- or brand-facing to me.” |

You don’t need to know the command names — only the **rules of thumb** above.

---

### 4. Fully automatic promotion with no human (e.g. runs in the background forever)

**Recommendation:** **Don’t** turn this on for durable memory.  
Wrong or outdated “official” facts are expensive: they spread through automation and erode trust.

**Safer pattern:** Automation is fine **after** a human has approved the **content** (for example, by merging a pull request that adds or updates the note).

---

### 5. Who “owns” a memory note?

The note’s **owner** field is a **label** (team or person accountable for keeping it accurate).  
**Your decision:** assign ownership so someone revisits stale items (e.g. quarterly) or when the product changes.

---

## One-page cheat sheet

1. **Durable memory = team truth** — use it for decisions you want to **reuse**.  
2. **Candidate = proposal** — promote when you’re ready to call it **official**.  
3. **Prefer human review** (PR or explicit approval) before promotion — especially for customer-facing or brand-sensitive content.  
4. **Avoid** fully hands-off promotion with no review.  
5. **Ownership** — every important note should have a clear **who keeps this fresh**.

---

## Where to go next

- **Operational detail:** [`repo-memory/README.md`](../repo-memory/README.md)  
- **Who runs the automation lane:** [`Repo Memory Steward`](../.github/agents/repo-memory-steward.agent.md) (for technical implementers)

If you want a **one-line policy** for your staff, you can paste:

> *We capture repeatable lessons in repo memory. Drafts are proposals; promoted notes are official. We don’t promote durable memory without a human review of the content (e.g. PR). Fully automatic promotion with no review is off.*
