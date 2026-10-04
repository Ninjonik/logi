import { v } from "convex/values"

export const teamGame = v.union(
    v.literal("hell_let_loose"),
    v.literal("wardogs")
)
export const matchTeamSlot = v.union(
    v.literal("a"),
    v.literal("b"),
    v.literal("c")
)
/** Server-produced presentation captured when a team is first assigned to a match. */
export const matchTeamSnapshot = v.object({
    name: v.string(),
    shortCode: v.union(v.string(), v.null()),
    logoAssetId: v.union(v.string(), v.null()),
    logoUrl: v.union(v.string(), v.null()),
    teamRevision: v.number(),
    capturedAt: v.string(),
})
export const matchTeamAssignment = v.object({
    teamId: v.string(),
    slot: matchTeamSlot,
    side: v.union(v.string(), v.null()),
    snapshot: matchTeamSnapshot,
})
/** Client input: identity, position and side only. */
export const matchTeamInput = v.object({
    teamId: v.string(),
    slot: matchTeamSlot,
    side: v.union(v.string(), v.null()),
})
export const imageAssetKind = v.union(
    v.literal("team-logo"),
    v.literal("panel-banner")
)
export const imageContentType = v.union(
    v.literal("image/png"),
    v.literal("image/jpeg"),
    v.literal("image/webp")
)
export const teamAuditOperation = v.union(
    v.literal("create"),
    v.literal("update"),
    v.literal("archive"),
    v.literal("restore"),
    v.literal("snapshot_refresh")
)
