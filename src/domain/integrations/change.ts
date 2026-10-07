import { allowsApiKeyRead, isApiKeyReadAccess } from "../api/key-access"
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
/** Changes and removal tombstones are kept two days; an older cursor bootstraps again. */
export const CHANGE_RETENTION_MS = 2 * 24 * 60 * 60 * 1000
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

/**
 * Whether a key can read this guild's feed: a live restricted key granted at
 * least one feed resource, or a website event-command key, whose
 * `revision_conflict` check compares against the `event-summaries` record.
 * A guild without one gets no changes, records or head writes; a key created
 * later bootstraps with `start=now`, so nothing it could read is lost.
 */
export function readsChangeFeed(key: {
    revokedAt?: string
    readAccess?: unknown
    writeAccess?: unknown
}): boolean {
    if (key.revokedAt || !isApiKeyReadAccess(key.readAccess)) return false
    const access = key.readAccess
    return (
        key.writeAccess !== undefined ||
        FEED_RESOURCES.some((resource) => allowsApiKeyRead(access, resource))
    )
}
