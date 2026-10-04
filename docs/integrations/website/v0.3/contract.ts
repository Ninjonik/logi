/** Consumer-owned normalized models, not Logi wire responses. Handoff 0.3.0. */
export type WebsiteGame = "hell-let-loose" | "wardogs"
export type ExternalReference = {
    source: "logi"
    sourceInstanceId: string
    guildId: string
    gameId: WebsiteGame
    kind: "event" | "match" | "member" | "server" | "integration"
    externalId: string
}
export type Projection<T> = T & {
    ref: ExternalReference
    observedAt: string
    sourceUpdatedAt: string | null
    freshness: "fresh" | "stale" | "unavailable"
    publication: "approved" | "unreviewed" | "withdrawn"
}
export type EventSummary = Projection<{
    title: string
    titleLocale: "cs" | "en" | null
    kind: "match" | "training" | null
    status: string | null
    startsAt: string | null
    endsAt: string | null
    detailUrl: string | null
    signupUrl: string | null
}>
export type MatchSummary = Projection<{
    eventRef: ExternalReference
    opponents: string[]
    map: string | null
    rounds: Array<{ home: number | null; away: number | null }>
    homeScore: number | null
    awayScore: number | null
    resultState: "unknown" | "provisional" | "confirmed" | "corrected"
    provenance: string | null
    confirmedAt: string | null
}>
export type PublicMember = Projection<{
    displayName: string
    biography: string | null
    avatarUrl: string | null
    games: WebsiteGame[]
    consentCheckedAt: string | null
    consentValidUntil: string | null
}>
export type ServerSnapshot = Projection<{
    displayName: string
    state: "online" | "offline" | "unknown"
    map: string | null
    players: number | null
    capacity: number | null
}>
export type IntegrationHealth = Projection<{
    capabilities: string[]
    lastAttemptAt: string | null
    lastCompletedSweepAt: string | null
    errorCategory: "authority" | "timeout" | "rate_limit" | "upstream" | null
    backlogCount: number | null
}>
