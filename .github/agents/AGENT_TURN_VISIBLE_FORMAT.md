# Agent turn visible format (shared)

Agents that persist a turn with **`record-summary`** must align the **chat-visible** narrative with the **executive briefing** in:

- [`../skills/orchestration-turn-reporting/SKILL.md`](../skills/orchestration-turn-reporting/SKILL.md) — **Executive briefing** section

**Shape:** one-line header, **Observation**, **Implication / Context**, **Next Step**, optional **Bottom Line:**. Use a `!` prefix on urgent observations when appropriate.

**JSON:** Same skill; include **`turnStatus`** (`ready` \| `blocked` \| `done`) when the agent ends a discrete unit of work.

**Structured deliverables:** Research briefs, execution plans, QA reports, migration notes, and similar sections remain the **primary** artifact for detail. The executive briefing is the **stakeholder-readable** layer when orchestration records the turn—map facts from the structured deliverable into the briefing sections; avoid raw jargon unless the user needs it.

**Supervisor:** Uses the extended template in [`supervisor.agent.md`](./supervisor.agent.md) (Turn status, Routing, model hints) on top of the same briefing spine.
