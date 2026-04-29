# Workflow

## Agent turn

1. Read `.git/.orchestration/context.json` when available.
2. Review your own recent summaries and any supervisor feedback addressed to your agent.
3. Do the work.
4. End with one compact summary JSON object **and** a visible note in **executive briefing** format.
5. If you have execute and are responsible for persistence, call the recorder **before** handing back. Otherwise return the JSON for the caller to record.

## Supervisor turn

1. Gather child summary JSON objects.
2. Persist any child summaries that were not already recorded.
3. Build one canonical `supervisor_turn_report` JSON object with key bullets, cross-agent insights, and categorized next steps.
4. Persist the supervisor report.
5. Return the visible note: **executive briefing** + **Turn status** + **Recommended Orchestration Strategy** when applicable.
6. Use the last 5 reports and relevant child summaries to refine the next routing decision.
