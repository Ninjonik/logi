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
