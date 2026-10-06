import { readFileSync } from "node:fs"

/** What the heartbeat schema accepts: letters, digits, `.`, `_`, `+`, `-`; at most 40. */
function label(value: string | null | undefined) {
    return (value ?? "").replace(/[^A-Za-z0-9._+-]/g, "").slice(0, 40)
}

/** The `version` of a `package.json`; null when the file is missing or broken. */
export function readPackageVersion(path: string | URL): string | null {
    try {
        const parsed = JSON.parse(readFileSync(path, "utf8")) as {
            version?: unknown
        }
        return typeof parsed.version === "string" ? parsed.version : null
    } catch {
        return null
    }
}

/**
 * The release the bot reports in its heartbeat ("verze 1.1.0", P1-04, P1-06):
 * `LOGI_BOT_VERSION` when the operator sets one, otherwise the version of
 * the package the bot ships in. The dashboard names it when the bot speaks
 * an older panel protocol than `REQUIRED_PANEL_PROTOCOL`. Never a secret.
 */
export function resolveBotVersion(input: {
    override?: string | null
    packageVersion: string | null
}) {
    return label(input.override) || label(input.packageVersion) || "unknown"
}
