import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config();

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  process.env.CONVEX_SELF_HOSTED_URL ??
  process.env.CONVEX_URL;
const internalSecret = process.env.INTERNAL_AUTH_SECRET;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!convexUrl || !internalSecret || !botToken) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL/CONVEX_SELF_HOSTED_URL, INTERNAL_AUTH_SECRET, or DISCORD_BOT_TOKEN.");
}

export const env = {
  appSiteUrl: process.env.SITE_URL ?? "http://localhost:3000",
  botToken,
  convexUrl,
  internalSecret,
};
