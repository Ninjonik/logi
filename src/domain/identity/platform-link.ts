import { z } from "zod"

export const verifiedPlatformLinkSchema = z
    .object({
        platform: z.literal("steam"),
        platformId: z.string().regex(/^7656119\d{10}$/),
        logiUserId: z.string().min(1),
        method: z.literal("steam_openid"),
        verifiedAt: z.number().finite().nonnegative(),
        revokedAt: z.number().finite().nonnegative().nullable(),
    })
    .strict()
export type VerifiedPlatformLink = z.infer<typeof verifiedPlatformLinkSchema>
export type LinkActorSession = { discordUserId: string; sessionHash: string }
export type LinkLocale = "en" | "cs" | "de"
export type LinkChallenge = LinkActorSession & {
    id: string
    returnOrigin: string
    locale: LinkLocale
    expiresAt: number
    status: "pending" | "verifying" | "consumed" | "failed" | "cancelled"
}
export const LINK_TTL_MS = 10 * 60_000
export function isActiveVerifiedLink(
    input: unknown
): input is VerifiedPlatformLink {
    const result = verifiedPlatformLinkSchema.safeParse(input)
    return result.success && result.data.revokedAt === null
}
export function assertLinkChallenge(
    challenge: Pick<
        LinkChallenge,
        "discordUserId" | "sessionHash" | "status" | "expiresAt"
    >,
    actor: LinkActorSession,
    now: number,
    expected: "pending" | "verifying"
) {
    if (
        challenge.discordUserId !== actor.discordUserId ||
        challenge.sessionHash !== actor.sessionHash ||
        challenge.status !== expected ||
        challenge.expiresAt <= now
    ) {
        throw new Error("Steam challenge unavailable.")
    }
}
export function steamCallbackUrl(origin: string, state: string) {
    const url = new URL(origin)
    const local =
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    if (
        (!local && url.protocol !== "https:") ||
        url.origin !== origin ||
        url.username ||
        url.password
    )
        throw new Error("Invalid canonical origin.")
    return `${origin}/api/platform-links/steam/callback?${new URLSearchParams({ state })}`
}
