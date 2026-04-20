import { defineConfig } from "drizzle-kit";
import { resolve } from "path";
import { fileURLToPath } from "url";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  out: "./migrations",
  schema: resolve(__dirname, "../../packages/shared/src/schema.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
