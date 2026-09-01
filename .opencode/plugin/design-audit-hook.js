// Edit-time design audit hook.
//
// Runs scripts/devtools/design-audit.mjs on a frontend file right after the
// agent edits it, and appends findings to the tool output so the agent sees
// violations while it is still working — instead of at commit or CI time.
//
// Kill switch: DESIGN_AUDIT_HOOK=0. Fails open: a broken hook never stalls
// the agent and never mutates the tool result on internal errors.

import { execFileSync } from "node:child_process";
import path from "node:path";

const SCANNER = "scripts/devtools/design-audit.mjs";
const SCAN_EXTS = new Set([".tsx", ".ts", ".jsx", ".scss", ".css", ".less"]);
const FRONTEND_ROOTS = ["apps/mini-program/src", "apps/admin-client/src"];
const TIMEOUT_MS = 20_000;

function summarize(scannerOutput) {
  return scannerOutput
    .split("\n")
    .filter((l) => /❌|⚠️|ℹ️|📄|Errors:/.test(l))
    .slice(0, 40)
    .join("\n");
}

export default async ({ directory }) => {
  return {
    "tool.execute.after": async (input, output) => {
      try {
        if (process.env.DESIGN_AUDIT_HOOK === "0") return;
        if (input.tool !== "edit" && input.tool !== "write") return;

        const filePath = input?.args?.filePath ?? input?.args?.path;
        if (typeof filePath !== "string" || !filePath) return;

        const rel = path.relative(directory, filePath).split(path.sep).join("/");
        if (rel.startsWith("..")) return;
        if (!SCAN_EXTS.has(path.extname(rel))) return;
        if (!FRONTEND_ROOTS.some((root) => rel.startsWith(root + "/") || rel === root)) return;

        execFileSync(
          process.execPath,
          [path.join(directory, SCANNER), rel],
          { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: TIMEOUT_MS },
        );
        // Exit 0 — no error-severity findings; stay silent (warnings are
        // advisory and would flood the loop on legitimate patterns).
      } catch (err) {
        if (err && err.status === 1 && typeof err.stdout === "string" && err.stdout) {
          output.output +=
            "\n\n[design-audit] ERROR findings in the file you just edited — fix before continuing:\n" +
            summarize(err.stdout) +
            "\n(Rules: scripts/devtools/design-audit.mjs. For alignment/baseline issues see .github/skills/ui-layout-audit/references/render-integrity-checklist.md)";
        }
        // Any other failure (timeout, missing scanner, etc.): fail open.
      }
    },
  };
};
