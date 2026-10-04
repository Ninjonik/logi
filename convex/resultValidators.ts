import { v } from "convex/values"
const gameDataProvider = v.union(
    v.literal("hll_crcon"),
    v.literal("wardogs_rcon"),
    v.literal("wardogs_warcon"),
    v.literal("wardogs_public_directory")
)
const score = v.object({
    id: v.string(),
    label: v.string(),
    score: v.union(v.number(), v.null()),
})
const status = v.union(
    v.literal("provisional"),
    v.literal("confirmed"),
    v.literal("corrected")
)
const origin = v.union(
    v.literal("collected"),
    v.literal("manual"),
    v.literal("legacy_import")
)
const time = v.union(v.string(), v.null())
const source = {
    provider: gameDataProvider,
    complete: v.boolean(),
    startedAt: time,
    endedAt: time,
}
export const resultPublicPayload = v.object({
    version: v.number(),
    status,
    participants: v.array(score),
    provenance: v.object({ origin, sources: v.array(v.object(source)) }),
    reviewedAt: time,
    supersedesVersion: v.union(v.number(), v.null()),
    attribution: v.object({ verified: v.number(), unresolved: v.number() }),
})
export const resultRevision = v.object({
    version: v.number(),
    status,
    origin,
    participants: v.array(score),
    sessionLinks: v.array(
        v.object({
            ...source,
            sessionId: v.string(),
            externalId: v.string(),
            sourceDigest: v.string(),
            map: time,
        })
    ),
    players: v.array(
        v.object({
            platform: v.union(
                v.literal("steam"),
                v.literal("xbox"),
                v.literal("unknown")
            ),
            platformId: v.string(),
            logiUserId: v.union(v.string(), v.null()),
            method: v.union(v.literal("steam_openid"), v.null()),
            verifiedAt: v.union(v.number(), v.null()),
        })
    ),
    createdAt: v.string(),
    createdBy: v.union(v.string(), v.null()),
    reviewerId: v.union(v.string(), v.null()),
    reviewedAt: time,
    supersedesVersion: v.union(v.number(), v.null()),
    reason: v.union(v.string(), v.null()),
})
export const resultCommand = v.object({
    action: v.union(
        v.literal("stage"),
        v.literal("confirm"),
        v.literal("correct")
    ),
    expectedRevision: v.number(),
    sessionLinks: v.optional(v.array(v.string())),
    participants: v.optional(v.array(score)),
    reason: v.optional(v.string()),
})
