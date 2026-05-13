# Icebreaker AI — LLM-as-judge (deferred)

Production implementation is **not** shipped. When prioritized:

- Run as a **batch or queue worker** only — never on the synchronous request path ([`docs/ai/ai/AI_INTEGRATION_PLAN.md`](../ai/AI_INTEGRATION_PLAN.md) evaluator policy).
- Inputs must be **non-PII** (hashes, phase, `promptVersion`, optional anonymized style tags — not raw user quotes).
- Outputs should join **`social_icebreaker_ai_feedback`** human ratings for calibration, not replace them.

Canonical human rubric: [`icebreaker-ai-quality-protocol.md`](./icebreaker-ai-quality-protocol.md).
