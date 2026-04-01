/**
 * Startup Configuration Validation
 *
 * Validates required environment variables at process start.
 * Exits the process with a descriptive error when critical config is missing.
 * Non-critical variables emit a warning but do not block startup.
 */

interface ConfigSpec {
  key: string;
  required: boolean;
  description: string;
  /** Optional validation function. Returns error message on failure, undefined on success. */
  validate?: (value: string) => string | undefined;
}

const CONFIG_SPECS: ConfigSpec[] = [
  // ── Always required ──────────────────────────────────────────────────────
  {
    key: "DATABASE_URL",
    required: true,
    description: "PostgreSQL connection string (Neon serverless)",
    validate: (v) => {
      if (!v.startsWith("postgresql://") && !v.startsWith("postgres://")) {
        return "Must be a valid postgresql:// or postgres:// URL";
      }
    },
  },
  {
    key: "SESSION_SECRET",
    required: true,
    description: "Express session secret (min 32 chars)",
    validate: (v) => {
      if (v.length < 32) {
        return "Must be at least 32 characters long for security";
      }
    },
  },

  // ── WeChat auth (Mini Program login) ────────────────────────────────────
  {
    key: "WECHAT_APPID",
    required: true,
    description: "WeChat Mini Program App ID",
  },
  {
    key: "WECHAT_SECRET",
    required: true,
    description: "WeChat Mini Program App Secret",
  },

  // ── Optional but warn if absent in production ────────────────────────────
  {
    key: "DEEPSEEK_API_KEY",
    required: false,
    description: "DeepSeek AI API key (AI features will be degraded without it)",
  },
];

/**
 * Validate all config specifications.
 * In non-production environments, missing REQUIRED vars are warnings (not fatal).
 * In production, missing REQUIRED vars cause process.exit(1).
 */
export function validateConfig(): void {
  const env = process.env;
  const nodeEnv = env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const spec of CONFIG_SPECS) {
    const value = env[spec.key];
    const missing = value === undefined || value.trim() === "";

    if (missing) {
      const msg = `${spec.key} is not set — ${spec.description}`;
      if (spec.required) {
        if (isProduction) {
          errors.push(`[FATAL] ${msg}`);
        } else {
          warnings.push(`[WARN]  ${msg}`);
        }
      } else {
        warnings.push(`[WARN]  ${msg}`);
      }
      continue;
    }

    if (spec.validate) {
      const validationError = spec.validate(value!);
      if (validationError) {
        const msg = `${spec.key} is invalid: ${validationError}`;
        if (spec.required && isProduction) {
          errors.push(`[FATAL] ${msg}`);
        } else {
          warnings.push(`[WARN]  ${msg}`);
        }
      }
    }
  }

  // Emit warnings
  for (const w of warnings) {
    console.warn(`[config] ${w}`);
  }

  // Fatal errors — only in production
  if (errors.length > 0) {
    console.error("\n[config] Startup aborted — required configuration is missing or invalid:");
    for (const e of errors) {
      console.error(`  ${e}`);
    }
    console.error(
      "\n  Set these environment variables and restart. See docs/LAUNCH_CONFIG.md for details.\n"
    );
    process.exit(1);
  }

  if (warnings.length > 0 && !isProduction) {
    console.warn(
      "[config] Some optional or required (non-production) config is missing. " +
        "This may cause feature degradation. See docs/LAUNCH_CONFIG.md.\n"
    );
  }
}
