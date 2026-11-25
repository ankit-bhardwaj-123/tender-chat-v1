import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next, so it loads .env itself (dotenv above).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/backend/database/schema.ts",
  out: "./src/backend/database/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
