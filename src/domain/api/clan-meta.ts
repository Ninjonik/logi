/**
 * The counts of `/api/v1/clan/meta` come from a per-clan summary document
 * that `clanMeta:refreshClanMeta` recomputes at most once per interval, off
 * the request path; the request itself reads the key, the clan, its enabled
 * games and that one document, never the clan's tables (ARCHITECTURE.md,
 * "Convex hot paths"). This module holds the freshness rule the mutation and
 * the web gateway share and the projection from the stored tallies to the
 * counts the endpoint has always returned.
 */
export const CLAN_META_INTERVAL_MS = 60_000

/** The stored tallies; plain identifiers, so they can live in a document. */
export type ClanMetaTallies = {
    events: number
    groups: number
    rosters: number
    assignments: number
    users: number
    calendarItems: number
    stratmaps: number
    topicPresets: number
    squadPresets: number
    matches: number
    articles: number
    apiKeys: number
}

/** The counts as the endpoint returns them, keyed by API resource name. */
export type ClanMetaCounts = {
    events: number
    groups: number
    rosters: number
    assignments: number
    users: number
    "calendar-items": number
    stratmaps: number
    "topic-presets": number
    "squad-presets": number
    matches: number
    articles: number
    settings: number
    "api-keys": number
}

export type ClanMetaFreshness = "missing" | "stale" | "fresh"

/**
 * Whether a stored summary can be served as is. `missing` when the clan has
 * none yet (the first call after a deploy computes it synchronously), `stale`
 * when it is older than the interval or its time is unreadable (served, and
 * refreshed off the request path), `fresh` otherwise.
 */
export function clanMetaFreshness(
    computedAt: string | null | undefined,
    now: number,
    intervalMs = CLAN_META_INTERVAL_MS
): ClanMetaFreshness {
    if (!computedAt) return "missing"
    const at = Date.parse(computedAt)
    return !Number.isFinite(at) || now - at >= intervalMs ? "stale" : "fresh"
}

/**
 * The tallies of one scan. `rosters` counts the published events that have
 * a roster; `users` the distinct people with an assignment in the clan.
 */
export function tallyClanMeta(scan: {
    events: number
    groups: number
    rosters: number
    assignments: ReadonlyArray<{ userId: string }>
    calendarItems: number
    stratmaps: number
    topicPresets: number
    squadPresets: number
    matches: number
    articles: number
    apiKeys: number
}): ClanMetaTallies {
    return {
        events: scan.events,
        groups: scan.groups,
        rosters: scan.rosters,
        assignments: scan.assignments.length,
        users: new Set(scan.assignments.map((entry) => entry.userId)).size,
        calendarItems: scan.calendarItems,
        stratmaps: scan.stratmaps,
        topicPresets: scan.topicPresets,
        squadPresets: scan.squadPresets,
        matches: scan.matches,
        articles: scan.articles,
        apiKeys: scan.apiKeys,
    }
}

/** The stored tallies in the endpoint's shape; `settings` is always one. */
export function projectClanMetaCounts(
    tallies: ClanMetaTallies
): ClanMetaCounts {
    return {
        events: tallies.events,
        groups: tallies.groups,
        rosters: tallies.rosters,
        assignments: tallies.assignments,
        users: tallies.users,
        "calendar-items": tallies.calendarItems,
        stratmaps: tallies.stratmaps,
        "topic-presets": tallies.topicPresets,
        "squad-presets": tallies.squadPresets,
        matches: tallies.matches,
        articles: tallies.articles,
        settings: 1,
        "api-keys": tallies.apiKeys,
    }
}
