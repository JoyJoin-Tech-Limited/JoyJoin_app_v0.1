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

interface ConfigIssueBuckets {
  errors: string[];
  warnings: string[];
}

export const DIRECT_MINI_PROGRAM_APP_ID_MISMATCH_MESSAGE =
  "WECHAT_PAY_APP_ID must match WECHAT_APPID for the direct mini-program JSAPI flow";

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

function isPaymentsEnabled(env: NodeJS.ProcessEnv): boolean {
  return (env.PAYMENTS_ENABLED ?? "false").toLowerCase() === "true";
}

export function getDirectMiniProgramAppIdConsistencyIssue(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (!isPaymentsEnabled(env)) {
    return null;
  }

  const miniProgramAppId = env.WECHAT_APPID?.trim();
  const wechatPayAppId = env.WECHAT_PAY_APP_ID?.trim();

  if (!miniProgramAppId || !wechatPayAppId) {
    return null;
  }

  return miniProgramAppId === wechatPayAppId
    ? null
    : DIRECT_MINI_PROGRAM_APP_ID_MISMATCH_MESSAGE;
}

function collectBaseConfigIssues(
  env: NodeJS.ProcessEnv,
  isProduction: boolean,
): ConfigIssueBuckets {
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

    if (value !== undefined && value !== null && spec.validate) {
      const validationError = spec.validate(value);
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

  return { errors, warnings };
}

function collectPaymentConfigIssues(
  env: NodeJS.ProcessEnv,
  isProduction: boolean,
): ConfigIssueBuckets {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPaymentsEnabled(env)) {
    return { errors, warnings };
  }

  const paymentRequiredKeys = [
    "WECHAT_PAY_APP_ID",
    "WECHAT_PAY_MCH_ID",
    "WECHAT_PAY_SERIAL_NO",
    "WECHAT_PAY_PRIVATE_KEY",
    "WECHAT_PAY_APIV3_KEY",
    "WECHAT_PAY_PLATFORM_CERT",
  ] as const;

  for (const key of paymentRequiredKeys) {
    const value = env[key];
    const missing = value === undefined || value.trim() === "";
    if (!missing) continue;

    const msg = `${key} is required when PAYMENTS_ENABLED=true`;
    if (isProduction) {
      errors.push(`[FATAL] ${msg}`);
    } else {
      warnings.push(`[WARN]  ${msg}`);
    }
  }

  const apiv3Key = env.WECHAT_PAY_APIV3_KEY;
  if (apiv3Key && Buffer.byteLength(apiv3Key, "utf8") !== 32) {
    const msg = "WECHAT_PAY_APIV3_KEY must be exactly 32 bytes";
    if (isProduction) {
      errors.push(`[FATAL] ${msg}`);
    } else {
      warnings.push(`[WARN]  ${msg}`);
    }
  }

  const directMiniProgramAppIdIssue = getDirectMiniProgramAppIdConsistencyIssue(env);
  if (directMiniProgramAppIdIssue) {
    if (isProduction) {
      errors.push(`[FATAL] ${directMiniProgramAppIdIssue}`);
    } else {
      warnings.push(`[WARN]  ${directMiniProgramAppIdIssue}`);
    }
  }

  return { errors, warnings };
}

export function getConfigValidationIssues(
  env: NodeJS.ProcessEnv = process.env,
  options?: { productionMode?: boolean },
): ConfigIssueBuckets {
  const isProduction =
    options?.productionMode ?? (env.NODE_ENV ?? "development") === "production";

  const base = collectBaseConfigIssues(env, isProduction);
  const payment = collectPaymentConfigIssues(env, isProduction);

  return {
    errors: [...base.errors, ...payment.errors],
    warnings: [...base.warnings, ...payment.warnings],
  };
}

export function getReadinessConfigErrors(
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const issues = getConfigValidationIssues(env, { productionMode: true });
  return issues.errors.map((issue) =>
    issue.replace(/^\[FATAL\]\s*/, ""),
  );
}

interface ValidateConfigOptions {
  exitOnFatal?: boolean;
}

/**
 * Validate all config specifications.
 * In non-production environments, missing REQUIRED vars are warnings (not fatal).
 * In production, missing REQUIRED vars cause process.exit(1).
 */
export function validateConfig(
  options?: ValidateConfigOptions,
): ConfigIssueBuckets {
  const env = process.env;
  const nodeEnv = env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";
  const { errors, warnings } = getConfigValidationIssues(env, {
    productionMode: isProduction,
  });

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
    if (options?.exitOnFatal ?? true) {
      process.exit(1);
    }

    console.error(
      "[config] Continuing startup so /api/health stays reachable; /api/readyz will report not_ready until config is fixed.\n"
    );
  }

  if (warnings.length > 0 && !isProduction) {
    console.warn(
      "[config] Some optional or required (non-production) config is missing. " +
        "This may cause feature degradation. See docs/LAUNCH_CONFIG.md.\n"
    );
  }

  return { errors, warnings };
}
