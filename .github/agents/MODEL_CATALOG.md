# Model catalog (canonical)

**Single source of truth** for execution-model names, premium-request cost multipliers, and suitability heuristics used by:

- [`.github/AI_WORKFLOW_POLICY.md`](../AI_WORKFLOW_POLICY.md) — planning policy
- [`.github/agents/planner.agent.md`](./planner.agent.md) — `## Model Recommendation for Execution`
- [`.github/agents/supervisor.agent.md`](./supervisor.agent.md) — `### Model Assignment` and per-step model hints
- [`.github/skills/first-principles-velocity/SKILL.md`](../skills/first-principles-velocity/SKILL.md) — critical-path framing + pairing tiers to task shape

**Maintenance:** When this pool or multipliers change, update **this file** and adjust references in the policy and agent files in the **same PR**—do not fork a second table elsewhere.

---

## Baseline table

| Model Name | Cost (Premium Request Units) | Best Suited For |
| --- | --- | --- |
| GPT-5 mini | 0.00x | Trivial tasks, simple syntax fixes, single-line changes. |
| GPT-5.4 mini | 0.33x | Minor refactors, small component updates, light debugging. |
| GPT-5.4 xhigh | 1.00x | Standard feature implementation, moderate complexity. |
| Sonnet 4.6 | 1.00x | Balanced performance for typical engineering tasks. |
| Opus 4.6 | 3.00x | Complex logic, architectural changes, multi-file coordination. |
| Opus 4.7 | 7.50x | Extremely complex refactors, large-scale planning, high-stakes decisions. |

Optimize for outcome quality first, then token efficiency. Do not default to the cheapest model for non-trivial work, and do not spend premium capacity on trivial work.

---

## Dimensions for selection (use every time)

Route work by **shape**, not vibes:

| Dimension | Lean cheaper | Lean stronger |
| --- | --- | --- |
| **Ambiguity** | Spec is explicit, acceptance obvious | Requirements fuzzy, many valid designs |
| **Blast radius** | One file / one function | Cross-cutting contracts, auth, money, data integrity |
| **Coordination** | Single owner, linear steps | Many files, parallel workstreams, orchestration |
| **Tooling depth** | Read-only or a few commands | Long tool chains, computer/browser use, multi-step agents |
| **Reasoning depth** | Mechanical edit, known pattern | Architecture, novel invariants, adversarial edge cases |
| **Latency budget** | User wants instant iteration | Correctness matters more than seconds-to-first-token |
| **Context mass** | Small prompt, narrow files | Very large repos or huge diffs in one pass |

When two dimensions disagree (e.g. “small edit” but **high blast radius**), **escalate** tier.

---

## OpenAI GPT family (this catalog)

**GPT-5 mini** — Near-zero cost tier. Best for **mechanical** work: renames, obvious fixes, formatting, single-shot answers where a mistake is cheap to undo. Avoid for ambiguous specs, security-sensitive edits, or multi-step refactors.

**GPT-5.4 mini** — Cost-efficient **frontier-small** tier. Strong for bounded tasks with clear success criteria: localized UI tweaks, narrow bug hunts with a repro, smaller refactors across a **small** surface. Per OpenAI’s GPT‑5.4 line, smaller variants trade some depth on the hardest agentic / computer-use style tasks vs the full **GPT‑5.4** class models—if the task looks like **long-horizon** agent work, **terminal-heavy** automation, or **large-context** synthesis, move up to **GPT‑5.4 xhigh** (or Claude Sonnet per row below) rather than mini.

**GPT-5.4 xhigh** — Default **professional / implementation** tier in this table (1.00x). OpenAI positions **GPT‑5.4** class models as strong on **coding, agentic workflows, tool use**, and long-context professional work. Use for standard feature work, multi-file edits with moderate complexity, and most “ship this PR” engineering. Prefer this over mini when **implicit requirements**, **cross-file consistency**, or **tool orchestration** matter.

*Vendor context:* [Introducing GPT‑5.4](https://openai.com/index/introducing-gpt-5-4/) (reasoning, coding, agentic workflows, computer-use class capabilities in the family).

---

## Anthropic Claude (this catalog)

**Sonnet 4.6** — **Default balanced** tier for coding and agents at **Sonnet-equivalent** cost in this table. Anthropic describes Sonnet 4.6 as a strong generalist for **coding, agents, and long-running tasks**, with a large context window—use when you want **instruction-following, multi-file reasoning, and tool reliability** without paying Opus rates. Pair with **extended thinking** (when your product surface exposes it) for harder reasoning at the cost of latency.

*Vendor context:* [Claude Sonnet 4.6](https://www.anthropic.com/claude/sonnet) (capabilities, context, use cases).

**Opus 4.6** — Step up when **Sonnet** is insufficient: heavier **architecture**, trickier **multi-agent** coordination, or when prior passes still miss edge cases. Prefer when mistakes are expensive (payments, migrations, security).

**Opus 4.7** — Reserve for **largest** refactors, org-wide planning, or **highest-stakes** decisions where you would otherwise schedule senior staff time. Requires explicit justification in Planner / Supervisor outputs.

---

## Cross-lineup heuristics (GPT vs Claude in this repo)

- **Research & synthesis** (read-heavy, web-assisted): **Sonnet 4.6** or **GPT‑5.4 xhigh**—both handle long context and tool use well; pick whichever matches your session’s **default** and pricing.
- **Tight implementation loop** on a **small** surface: **GPT‑5.4 mini** or **GPT‑5 mini** if truly trivial.
- **Orchestration / routing / executive briefing**: **Sonnet 4.6** or **GPT‑5.4 xhigh**; escalate to **Opus** when tradeoffs are strategic or cross-team.
- **Verification / “prove it” passes** (e.g. Verifier lane): prefer **faster/cheaper** tiers when checks are **narrow and scripted**; do not use mini for interpreting flaky failures across the stack.

---

## Escalation ladder (suggested)

1. **GPT‑5 mini** — only after confirming the task is truly low-risk and atomic.  
2. **GPT‑5.4 mini** — bounded, well-specified work.  
3. **GPT‑5.4 xhigh** or **Sonnet 4.6** — default shipping tier for real engineering.  
4. **Opus 4.6** — complex / high-blast-radius.  
5. **Opus 4.7** — rare; largest scope or executive-level planning.

Always cite **which dimensions** triggered escalation when recommending in Planner or Supervisor.
