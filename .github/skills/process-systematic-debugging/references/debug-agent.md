# Integration with the `debug` agent

When the `debug` agent is spawned, it loads `process-systematic-debugging` automatically. The agent should:

1. Follow Phases 1–4 (reproduce → isolate → hypothesize → verify) before proposing any fix.
2. End Phase 4 with a structured hypothesis + evidence summary.
3. Only enter Phase 5 (fix and validate) after the user or Supervisor confirms the hypothesis.
