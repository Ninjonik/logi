import {
    matchesWatchedTeams,
    trackingDeadline,
} from "../../domain/wardogs-league/discovery"
export type TrackingState =
    "pending" | "tracked" | "unmatched" | "ignored" | "paused" | "archived"
/**
 * League-wide collection (all fixtures, the table and recent results) runs
 * while at least one workspace keeps Wardogs League enabled or has an active
 * WD League panel. Disabling everywhere stops collection (L3-55); stored
 * fixtures and results stay readable.
 */
export function leagueCollectionWanted(
    workspaces: ReadonlyArray<{ enabled: boolean }>,
    activeLeaguePanels = 0
) {
    return workspaces.some((value) => value.enabled) || activeLeaguePanels > 0
}
export function trackingDecision(
    row: {
        firstSeenAt: number
        pinned: boolean
        discordRefs: unknown[]
        ignored: boolean
        paused: boolean
    },
    snapshot: {
        scheduledAt: string | null
        teams: Array<{ code: string; profileUrl: string }> | null
    },
    teams: string[],
    now: number
): {
    tracked: boolean
    automatic: boolean
    state: TrackingState
    announce: boolean
} {
    const automatic = matchesWatchedTeams(snapshot, teams)
    const explicit = row.pinned || row.discordRefs.length > 0
    const tracked = !row.ignored && (automatic || explicit)
    const state: TrackingState = row.ignored
        ? "ignored"
        : !tracked
          ? "unmatched"
          : row.paused
            ? "paused"
            : now >= trackingDeadline(snapshot, row.firstSeenAt)
              ? "archived"
              : "tracked"
    return {
        tracked,
        automatic,
        state,
        announce:
            tracked &&
            (explicit ||
                (snapshot.scheduledAt !== null &&
                    Date.parse(snapshot.scheduledAt) >= row.firstSeenAt)),
    }
}
