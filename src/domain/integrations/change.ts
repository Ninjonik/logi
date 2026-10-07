export const SYNC_RESOURCES = [
    "server-game-history",
    "league-fixtures",
    "member-summaries",
    "roster-summaries",
    "player-stat-summaries",
    "membership-summaries",
    "event-summaries",
    "match-summaries",
    "result-summaries",
    "server-snapshots",
    "integration-health",
    "teams",
] as const
export type SyncResource = (typeof SYNC_RESOURCES)[number]
/**
 * Live state the feed no longer carries. `/clan/changes` and
 * `/clan/sync-records` still accept the names, so existing website requests
 * keep working and receive no items; the state is read from
 * `/api/v1/clan/server-snapshots` and `/api/v1/clan/integration-health`.
 */
export const RETIRED_SYNC_RESOURCES = [
    "server-snapshots",
    "integration-health",
] as const
/** The resources a writer may append to the feed. */
export type FeedResource = Exclude<
    SyncResource,
    (typeof RETIRED_SYNC_RESOURCES)[number]
>
export const FEED_RESOURCES = SYNC_RESOURCES.filter(
    (resource): resource is FeedResource =>
        !(RETIRED_SYNC_RESOURCES as readonly string[]).includes(resource)
)
export type IntegrationChange = {
    revision: string
    guildId: string
    gameId: string
    resource: SyncResource
    id: string
    operation: "upsert" | "remove"
}
// The wire schemas (`integrationChangeSchema`, `syncRecordSchema`) live in
// `change.schema.ts`: this module stays free of Zod for the mutation wrapper.

export function revisionOrder(revision: string): string {
    if (!/^(0|[1-9][0-9]{0,127})$/.test(revision))
        throw new Error("Invalid revision.")
    return revision.padStart(128, "0")
}
export function nextRevision(revision: string): string {
    revisionOrder(revision)
    const next = (BigInt(revision) + BigInt(1)).toString()
    revisionOrder(next)
    return next
}
