#!/usr/bin/env node
/**
 * WeChat Pay Configuration Verification Script
 * 
 * Checks that all required WeChat Pay v3 credentials are present and valid
 * before enabling payments in production. Run this on the server to verify.
 * 
 * Usage:
 *   node --env-file=../../.env --import tsx/esm src/scripts/verify-wechat-pay-config.ts
 */

import { getConfigValidationIssues } from "../lib/configValidation";

function main() {
  console.log("[verify] WeChat Pay Configuration Check");
  console.log("=========================================");

  // Check PAYMENTS_ENABLED
  const paymentsEnabled = process.env.PAYMENTS_ENABLED === "true";
  console.log(`\n[1] PAYMENTS_ENABLED: ${paymentsEnabled ? "✅ true" : "❌ false (or not set)"}`);
  
  if (!paymentsEnabled) {
    console.log("    ⚠️  Payments are disabled. Set PAYMENTS_ENABLED=true when ready.");
  }

  // Check required keys
  const requiredKeys = [
    "WECHAT_PAY_APP_ID",
    "WECHAT_PAY_MCH_ID",
    "WECHAT_PAY_SERIAL_NO",
    "WECHAT_PAY_PRIVATE_KEY",
    "WECHAT_PAY_APIV3_KEY",
  ];

  const optionalKeys = [
    "WECHAT_PAY_PLATFORM_CERT",
    "WECHAT_PAY_PLATFORM_PUBLIC_KEY",
  ];

  console.log("\n[2] Required Credentials:");
  let allRequired = true;
  for (const key of requiredKeys) {
    const value = process.env[key];
    const present = value && value.trim() !== "";
    console.log(`    ${present ? "✅" : "❌"} ${key}: ${present ? "Set" : "MISSING"}`);
    if (!present) allRequired = false;
  }

  console.log("\n[3] Optional Credentials (for webhook signature verification):");
  for (const key of optionalKeys) {
    const value = process.env[key];
    const present = value && value.trim() !== "";
    console.log(`    ${present ? "✅" : "⚠️"} ${key}: ${present ? "Set" : "Not set (webhook verification may fail)"}`);
  }

  // Check API v3 key length
  const apiV3Key = process.env.WECHAT_PAY_APIV3_KEY;
  if (apiV3Key) {
    const byteLength = Buffer.byteLength(apiV3Key, "utf8");
    console.log(`\n[4] WECHAT_PAY_APIV3_KEY length: ${byteLength} bytes ${byteLength === 32 ? "✅" : "❌ (must be exactly 32)"}`);
  }

  // Check AppID consistency
  const wechatAppId = process.env.WECHAT_APPID;
  const wechatPayAppId = process.env.WECHAT_PAY_APP_ID;
  console.log(`\n[5] AppID Consistency:`);
  console.log(`    WECHAT_APPID:       ${wechatAppId || "❌ NOT SET"}`);
  console.log(`    WECHAT_PAY_APP_ID:  ${wechatPayAppId || "❌ NOT SET"}`);
  if (wechatAppId && wechatPayAppId) {
    const match = wechatAppId.trim() === wechatPayAppId.trim();
    console.log(`    Match: ${match ? "✅" : "❌ MISMATCH - must be identical for Mini Program JSAPI"}`);
  }

  // Check webhook URL
  const appUrl = process.env.APP_URL;
  const notifyUrl = process.env.WECHAT_PAY_NOTIFY_URL;
  const resolvedNotifyUrl = notifyUrl || (appUrl ? `${appUrl.replace(/\/$/, "")}/api/webhooks/wechat-pay` : undefined);
  console.log(`\n[6] Webhook URL: ${resolvedNotifyUrl || "❌ NOT CONFIGURED"}`);
  if (resolvedNotifyUrl) {
    const isHttps = resolvedNotifyUrl.startsWith("https://");
    console.log(`    HTTPS: ${isHttps ? "✅" : "❌ (must be HTTPS for production)"}`);
  }

  // Check private key format
  const privateKey = process.env.WECHAT_PAY_PRIVATE_KEY;
  if (privateKey) {
    const hasHeader = privateKey.includes("-----BEGIN PRIVATE KEY-----");
    const hasFooter = privateKey.includes("-----END PRIVATE KEY-----");
    console.log(`\n[7] Private Key Format: ${hasHeader && hasFooter ? "✅ PEM format" : "❌ Invalid format"}`);
  }

  // Run full config validation
  console.log("\n[8] Running full config validation...");
  const issues = getConfigValidationIssues(process.env, { productionMode: true });
  
  if (issues.errors.length > 0) {
    console.log("\n❌ ERRORS (will block server startup):");
    issues.errors.forEach(e => console.log(`   ${e}`));
  }
  if (issues.warnings.length > 0) {
    console.log("\n⚠️  WARNINGS:");
    issues.warnings.forEach(w => console.log(`   ${w}`));
  }
  if (issues.errors.length === 0 && issues.warnings.length === 0) {
    console.log("\n✅ All configuration checks passed!");
  }

  // Summary
  console.log("\n=========================================");
  if (allRequired && paymentsEnabled && issues.errors.length === 0) {
    console.log("✅ WeChat Pay is ready to go live!");
    console.log("   Next: Toggle paymentsEnabled=true in admin feature flags");
  } else {
    console.log("❌ Configuration incomplete. Fix the issues above before going live.");
  }
}

main();
