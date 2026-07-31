import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL("../../.github/workflows/staging-momo-shift-hotfix.yml", import.meta.url),
  "utf8",
);

test("staging Momo shift hotfix stays one-time and staging-only", () => {
  assert.match(workflow, /branches: \[main\]/);
  assert.match(workflow, /paths:\s*\n\s+- \.github\/workflows\/staging-momo-shift-hotfix\.yml/);
  assert.match(workflow, /postgres-staging/);
  assert.match(workflow, /-d joyjoin_staging/);
  assert.match(workflow, /current_database\(\) <> 'joyjoin_staging'/);
});

test("staging Momo shift hotfix uses an exact fail-closed target", () => {
  assert.match(workflow, /plan\.service_date = DATE '2026-07-31'/);
  assert.match(workflow, /plan\.status = 'published'/);
  assert.match(workflow, /shift\.status = 'published'/);
  assert.match(workflow, /npc\.slug = 'momo'/);
  assert.match(workflow, /shift\.starts_at = TIMESTAMPTZ '2026-07-31 16:30:00\+08'/);
  assert.match(workflow, /target_count <> 1/);
  assert.match(workflow, /shift changed concurrently/);
});

test("staging Momo shift hotfix is transactional, audited, and independently verified", () => {
  assert.match(workflow, /BEGIN;/);
  assert.match(workflow, /COMMIT;/);
  assert.match(workflow, /ends_at = TIMESTAMPTZ '2026-07-31 21:00:00\+08'/);
  assert.match(workflow, /ops-hotfix-20260731-momo-endsat-2100/);
  assert.match(workflow, /FLASH_PUBLISHED_SHIFT_CORRECTED/);
  assert.match(workflow, /verified_count <> 1/);
  assert.match(workflow, /STAGING_MOMO_SHIFT_HOTFIX_VERIFY_FAILED/);
  assert.ok(
    workflow.indexOf("STAGING_MOMO_SHIFT_HOTFIX_VERIFY_FAILED") < workflow.indexOf("COMMIT;"),
    "verification must fail before the transaction commits",
  );
});
