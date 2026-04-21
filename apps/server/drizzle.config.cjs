"use strict";

const path = require("path");
const { defineConfig } = require("drizzle-kit");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

/** Schema path is anchored to this file so `drizzle-kit push` works from repo root or apps/server. */
const schemaPath = path.join(__dirname, "../../packages/shared/src/schema.ts");

module.exports = defineConfig({
  out: "./migrations",
  schema: schemaPath,
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
