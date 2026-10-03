import { isActiveVerifiedLink } from "../identity/platform-link"
import { z } from "zod"
export const linkedPlayerSchema = z
    .object({
        platform: z.enum(["steam", "xbox", "unknown"]),
        platformId: z.string().min(1).max(200),
        logiUserId: z.string().nullable(),
        method: z.literal("steam_openid").nullable(),
        verifiedAt: z.number().nullable(),
    })
    .strict()
export type LinkedPlayer = z.infer<typeof linkedPlayerSchema>
export function resolveLinkedPlayer(
    platform: LinkedPlayer["platform"],
    platformId: string,
    verifiedLinks: unknown[]
): LinkedPlayer {
    const matches = verifiedLinks
        .filter(isActiveVerifiedLink)
        .filter(
            (link) =>
                link.platform === platform && link.platformId === platformId
        )
    const link = matches.length === 1 ? matches[0] : null
    return {
        platform,
        platformId,
        logiUserId: link?.logiUserId ?? null,
        method: link?.method ?? null,
        verifiedAt: link?.verifiedAt ?? null,
    }
}
