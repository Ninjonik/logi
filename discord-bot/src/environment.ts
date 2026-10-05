import { fileURLToPath } from "node:url"
import path from "node:path"

import dotenv from "dotenv"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..", "..")

dotenv.config({ path: path.join(repoRoot, ".env.local") })
dotenv.config()

const convexUrl =
    process.env.NEXT_PUBLIC_CONVEX_URL ??
    process.env.CONVEX_SELF_HOSTED_URL ??
    process.env.CONVEX_URL
const internalSecret = process.env.INTERNAL_AUTH_SECRET
const botToken = process.env.DISCORD_BOT_TOKEN

if (!convexUrl || !internalSecret || !botToken) {
    throw new Error(
        "Missing NEXT_PUBLIC_CONVEX_URL/CONVEX_SELF_HOSTED_URL, INTERNAL_AUTH_SECRET, or DISCORD_BOT_TOKEN."
    )
}

const appSiteUrl = process.env.SITE_URL ?? "http://localhost:3000"
/**
 * The version the bot reports in its heartbeat ("verze 1.0.268", P1-04):
 * an operator-set build label, else the package version. Never a secret.
 */
const versionLabel = (
    process.env.LOGI_BOT_VERSION ??
    process.env.npm_package_version ??
    "1.0.0"
)
    .replace(/[^A-Za-z0-9._+-]/g, "")
    .slice(0, 40)

export const env = {
    leagueMessageContent: process.env.LOGI_LEAGUE_MESSAGE_CONTENT === "true",
    appSiteUrl,
    botVersion: versionLabel || "1.0.0",
    // The public URL is embedded in Discord. A colocated bot can use a private
    // origin to pre-render images without relying on public hairpin routing.
    internalAppSiteUrl: process.env.INTERNAL_SITE_URL ?? appSiteUrl,
    botToken,
    convexUrl,
    internalSecret,
    statusApiUrl:
        process.env.LOGI_STATUS_API_URL ?? "http://127.0.0.1:8303/api/services",
}
