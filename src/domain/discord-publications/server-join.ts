import { z } from "zod"

/**
 * Joining a server from Discord (P4-04, P4-44..46, P4-B10) and the server
 * password of a private panel (P4-29..31, P4-B06). Discord buttons allow only
 * http(s), so "Připojit se" opens `/join/<slug>`, which opens
 * `steam://connect/<ip:port>` and shows a manual fallback. The join page and
 * public panels never show a password.
 */

/** "203.0.113.24:7777", "[2001:db8::1]:7777" or "hll.example.net:7777". */
export const serverAddressSchema = z
    .string()
    .trim()
    .max(100)
    .refine(isServerAddress, "Use host:port, e.g. 203.0.113.24:7777.")
export function isServerAddress(value: string): boolean {
    const match = /^(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9.-]+):(\d{1,5})$/.exec(value)
    if (!match) return false
    const port = Number(match[2])
    if (port < 1 || port > 65_535) return false
    const host = match[1]!
    if (host.startsWith("[")) return host.length > 3
    if (/^\d+(\.\d+){3}$/.test(host))
        return host.split(".").every((part) => Number(part) <= 255)
    return /^(?=.{1,80}$)([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/.test(
        host
    )
}
/** The Wardogs join code (P4-35, P2-39). */
export const joinCodeSchema = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,24}$/, "Use letters, digits and dashes.")

/** The Steam link the join page opens; null for an invalid address. */
export function steamConnectUrl(address: string): string | null {
    return isServerAddress(address) ? `steam://connect/${address}` : null
}

/** URL path segment of a server: "Vlci #1 · Public" → "vlci-1". */
export function serverJoinSlugBase(name: string): string {
    const head = name.split(/\s+[·|–-]\s+/)[0] ?? name
    const slug = head
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
        .replace(/-+$/g, "")
    return slug || "server"
}
export const serverJoinSlugSchema = z
    .string()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/)
/** A free slug: the base, then "-2", "-3", … (links are global, logi.app/join/vlci-1). */
export function uniqueServerJoinSlug(
    name: string,
    taken: (slug: string) => boolean
): string {
    const base = serverJoinSlugBase(name)
    if (!taken(base)) return base
    for (let n = 2; n < 1000; n++) {
        const slug = `${base}-${n}`
        if (!taken(slug)) return slug
    }
    throw new Error("No free join link.")
}
export function serverJoinUrl(siteUrl: string, slug: string): string | null {
    if (!serverJoinSlugSchema.safeParse(slug).success) return null
    try {
        const origin = new URL(siteUrl)
        if (origin.protocol !== "https:" && origin.protocol !== "http:")
            return null
        return new URL(`/join/${slug}`, origin.origin).href
    } catch {
        return null
    }
}

// ---- Password ---------------------------------------------------------------

/** "Heslo serveru": what HLL accepts; no control characters. */
export const serverPasswordSchema = z
    .string()
    .min(1)
    .max(64)
    .refine(
        (value) => !/[\u0000-\u001f\u007f]/.test(value),
        "No control characters."
    )
/**
 * Additional authenticated data of an encrypted password: a ciphertext
 * copied to another workspace or server cannot be opened.
 */
export function serverPasswordAad(input: {
    guildId: string
    connectionId: string
}) {
    return JSON.stringify([
        "logi.panel-server-password",
        1,
        input.guildId,
        input.connectionId,
    ])
}
/** The sealed text; a JSON wrapper keeps even a one-letter password above the cipher's minimum. */
export function serverPasswordPlaintext(password: string) {
    return JSON.stringify({
        v: 1,
        password: serverPasswordSchema.parse(password),
    })
}
export function serverPasswordFromPlaintext(plaintext: string): string {
    const parsed = z
        .strictObject({ v: z.literal(1), password: serverPasswordSchema })
        .safeParse(JSON.parse(plaintext))
    if (!parsed.success) throw new Error("Invalid server password.")
    return parsed.data.password
}

/**
 * Whether the panel may show the password on this refresh: the switch is
 * on, a password is stored, the panel is one server's own panel and
 * `@everyone` cannot view the channel. Checked on every refresh (P4-B06).
 */
export function passwordShown(input: {
    kind: string
    switchOn: boolean
    stored: boolean
    everyoneCanView: boolean
}): boolean {
    return (
        input.kind === "server" &&
        input.switchOn &&
        input.stored &&
        !input.everyoneCanView
    )
}
/**
 * The admins are told once when a channel turns public while the password
 * switch is on (P4-30): on the change from shown (or not yet decided) to
 * withheld, not on every refresh.
 */
export function passwordWithheldNotice(input: {
    kind: string
    switchOn: boolean
    stored: boolean
    everyoneCanView: boolean
    alreadyNotified: boolean
}): boolean {
    return (
        input.kind === "server" &&
        input.switchOn &&
        input.stored &&
        input.everyoneCanView &&
        !input.alreadyNotified
    )
}
