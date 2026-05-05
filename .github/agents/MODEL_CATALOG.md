# Model catalog (canonical)

**Single source of truth** for execution-model names, premium-request cost multipliers, and suitability heuristics used by:

- [`.github/AI_WORKFLOW_POLICY.md`](../AI_WORKFLOW_POLICY.md) — planning policy
- [`.github/agents/planner.agent.md`](./planner.agent.md) — `## Model Recommendation for Execution`
- [`.github/agents/supervisor.agent.md`](./supervisor.agent.md) — `### Model Assignment` and per-step model hints
- [`.github/skills/first-principles-velocity/SKILL.md`](../skills/first-principles-velocity/SKILL.md) — critical-path framing + pairing tiers to task shape

**Maintenance:** When this pool or multipliers change, update **this file** and adjust references in the policy and agent files in the **same PR**—do not fork a second table elsewhere.

---

## Active model pool

The repo's coding agents are powered by **DeepSeek V4**, **Kimi K2.6**, and **GLM 5.1**. Opus, GPT, Sonnet, and Claude models are no longer in active use and should not be referenced in routing recommendations.

### Baseline table

| Model Name | Cost (Premium Request Units) | Best Suited For |
| --- | --- | --- |
| DeepSeek V4 Flash | 0.33x | Trivial tasks, single-file edits, syntax fixes, low-blast-radius changes. Fastest and cheapest. |
| DeepSeek V4 Pro | 1.00x | Standard feature implementation, complex logic, multi-file coordination, high-stakes changes. Default coding model. |
| Kimi K2.6 | 2.50x | Multi-file coordination, Agent Swarm decomposition, strong instruction following, interleaved thinking between tool calls. |
| GLM 5.1 | 3.00x | Complex systems engineering, architecture design, long-horizon agentic tasks, large-scale refactors. |

Optimize for outcome quality first, then token efficiency. Do not default to the cheapest model for non-trivial work, and do not spend premium capacity on trivial work.

---

## Dimensions for selection (use every time)

Route work by **shape**, not vibes:

| Dimension | Lean cheaper | Lean stronger |
| --- | --- | --- |
| **Ambiguity** | Spec is explicit, acceptance obvious | Requirements fuzzy, many valid designs |
| **Blast radius** | One file / one function | Cross-cutting contracts, auth, money, data integrity |
| **Coordination** | Single owner, linear steps | Many files, parallel workstreams, orchestration |
| **Tooling depth** | Read-only or a few commands | Long tool chains, multi-step agents |
| **Reasoning depth** | Mechanical edit, known pattern | Architecture, novel invariants, adversarial edge cases |
| **Latency budget** | User wants instant iteration | Correctness matters more than seconds-to-first-token |
| **Context mass** | Small prompt, narrow files | Very large repos or huge diffs in one pass |

When two dimensions disagree (e.g. "small edit" but **high blast radius**), **escalate** tier.

---

## DeepSeek V4 (backbone coding model)

### DeepSeek V4 Flash — $0.14/1M input, $0.28/1M output

Cost-efficient tier for **mechanical** work: renames, obvious fixes, formatting, single-shot answers where a mistake is cheap to undo. **1M context window** — largest in class. No thinking mode (fast path). Avoid for ambiguous specs, security-sensitive edits, or multi-step refactors.

**Known tool-calling quirks** (shared across DeepSeek, GLM, and Qwen — handled by `toolInputRepair.ts`):
1. Sends `null` for optional fields instead of omitting them
2. Emits arrays as JSON strings: `"[\"a\",\"b\"]"` instead of `["a","b"]`
3. Wraps single args in `{}` where schema expects an array
4. Passes bare strings where arrays are expected
5. Emits markdown auto-links in file paths: `[file.md](http://file.md)`

The tool-input repair layer (validate-then-repair) handles these transparently. See `apps/server/src/ai/toolInputRepair.ts`.

### DeepSeek V4 Pro — $1.74/1M input, $3.48/1M output

Default **professional / implementation** tier (1.00x). **1M context window** (4× Kimi, 8× GLM) — ideal for large-repo analysis and multi-file refactors. Supports thinking mode via `reasoning_effort: 'high' | 'max'`. Use for standard feature work, multi-file edits with moderate complexity, and most "ship this PR" engineering. Prefer over Flash when **implicit requirements**, **cross-file consistency**, or **tool orchestration** matter.

*Provider context:* DeepSeek V4 supports 1M context, JSON output, tool calls, and thinking mode via `extra_body.thinking`.

---

## Kimi K2.6 (Moonshot AI — multi-file coordination)

### Kimi K2.6 — $0.16/1M input (cache hit) / $0.95/1M (cache miss), $4.00/1M output

Strong alternative for **multi-file coordination** and tasks that benefit from agent decomposition. **262K context window**. Unique **Agent Swarm** capability: decomposes complex tasks into parallel sub-tasks executed by dynamically instantiated domain-specific agents. Toggleable thinking mode supports interleaved reasoning between tool call steps.

**Strengths:**
- "Significantly improved instruction compliance and self-correction" (per Moonshot)
- "Stronger and more stable long-term code writing"
- Agent Swarm excels at coordinating multi-file changes

**Best for:** Multi-file feature implementations, parallel audits, tasks where agentic decomposition benefits the outcome.

**Limitations:** 256K context (vs DeepSeek's 1M). Higher output cost ($4.00/1M). Cache-hit input ($0.16) is competitive with DeepSeek Flash.

*Provider context:* Moonshot AI. Model ID: `kimi-k2.6`. API compatible with OpenAI SDK.

---

## GLM 5.1 (Zhipu AI / Z.AI — systems engineering)

### GLM 5.1 — Subscription-based (Z.AI Coding Plan)

Purpose-built for **complex systems engineering** and **long-horizon agentic tasks**. **744B total / 40B active parameters** (MoE architecture). **~128K context window** with DeepSeek Sparse Attention (DSA). Trained on 28.5T tokens. Supports reasoning parser (`--reasoning-parser glm45`) and tool-call parser (`--tool-call-parser glm47`).

**Strengths:**
- Designed for "complex systems" — architecture, multi-file orchestration, debugging complex issues
- Subscription pricing via Z.AI Coding Plan makes bulk coding work extremely economical (~1% of standard API pricing)
- Anthropic-protocol compatible — can be used as Opus/Sonnet replacement in Claude Code configurations

**Best for:** Architecture design, large refactors, systems-level debugging, bulk coding work (subscription economics).

**Limitations:** Smallest context window (~128K). Per-call reasoning effort is not parameterized (server-side parser config). Subscription model doesn't map cleanly to per-request cost multipliers.

*Provider context:* Zhipu AI / Z.AI. Model IDs: `glm-5.1-fp8`, `glm-5-fp8`. Pricing: Z.AI Coding Plan (Lite/Pro/Max tiers).

---

## Task Shape → Model routing

| Task Shape | Model | Why |
|--- |--- |--- |
| Bounded single-file edit, low blast radius | **DeepSeek V4 Flash** | Cheapest, fastest, sufficient |
| Standard feature work, moderate complexity | **DeepSeek V4 Pro** | Default coding tier, 1M context |
| Multi-file feature implementation | **Kimi K2.6** | Agent Swarm excels at coordination |
| Architecture design / systems refactor | **GLM 5.1** | Purpose-built for systems engineering |
| Large-repo analysis / audit (>128K context) | **DeepSeek V4 Pro** | Only model with 1M context |
| High-stakes (auth, payment, migration) | **DeepSeek V4 Pro** (thinking + max) | Proven reasoning depth + largest context |
| Bulk cheap coding work | **GLM 5.1** (Coding Plan) | Subscription economics win at scale |
| Research / exploration (read-heavy) | **Kimi K2.6** or **DeepSeek V4 Pro** | Both handle long context well |

---

## Tool-input repair coverage

All models in this catalog may exhibit the tool-calling quirks documented for DeepSeek V4 (the 4 failure modes + markdown auto-links). The `toolInputRepair.ts` repair layer is **provider-agnostic** and applies to all models. Repair-rate telemetry is tracked per (model, tool) so regressions are detected before users report them.

When evaluating a model's coding quality, account for the repair layer: a model that "fails" on a tool call may actually have the correct intent and only needs input repair. The repair layer handles this transparently.

---

## Escalation ladder (suggested)

1. **DeepSeek V4 Flash** — only after confirming the task is truly low-risk and atomic.
2. **DeepSeek V4 Pro** — default shipping tier for real engineering.
3. **Kimi K2.6** — multi-file coordination, agent swarm decomposition needed.
4. **GLM 5.1** — complex systems / architecture / bulk coding.

Always cite **which dimensions** triggered escalation when recommending in Planner or Supervisor.
