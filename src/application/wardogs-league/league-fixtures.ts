import {
    fixtureChanges,
    fixturePhase,
    nearestFixtures,
    nextFixtureRefreshAt,
    FIXTURE_REFRESH_MS,
    NEVER,
    PANEL_WINDOW,
    type FixtureChange,
    type FixturePhase,
    type IndexTab,
} from "../../domain/wardogs-league/all-fixtures"
import {
    MAX_RETRY_AFTER_MS,
    type LeagueErrorCode,
    type LeagueRead,
    type LeagueSnapshot,
} from "../../domain/wardogs-league/contracts"
import {
    resultRecordFromSnapshot,
    sameResult,
    type LeagueResultRecord,
} from "../../domain/wardogs-league/results"
import { matchUrl } from "../../domain/wardogs-league/match-url"
import { selectTrackedSnapshot } from "./accept-snapshot"

/**
 * Collection of every League fixture (P6-B01): the shared index lists match
 * links in two tabs, each link becomes one guild-independent stored fixture,
 * and fixtures are read through the shared detail cache at a cadence that
 * follows their phase. Results found on a page feed the results store, from
 * which the table and recent results are computed.
 */

/** Admission of the latest index into the store. */
export function planIndexAdmission(
    stored: ReadonlyMap<string, { tab: IndexTab | null }>,
    index: { fixtureUrls: readonly string[]; resultUrls: readonly string[] },
    capacity: number
): {
    add: Array<{ matchId: string; tab: IndexTab }>
    retab: Array<{ matchId: string; tab: IndexTab }>
    listed: Set<string>
    skipped: number
} {
    const tabs = new Map<string, IndexTab>()
    for (const url of index.fixtureUrls) tabs.set(matchUrl(url).id, "fixtures")
    // A match listed on both tabs during one scan has just finished.
    for (const url of index.resultUrls) tabs.set(matchUrl(url).id, "results")
    const add: Array<{ matchId: string; tab: IndexTab }> = []
    const retab: Array<{ matchId: string; tab: IndexTab }> = []
    let free = Math.max(0, capacity - stored.size),
        skipped = 0
    // Upcoming fixtures are admitted before old results when space is short.
    const ordered = [...tabs].sort(
        ([, a], [, b]) => Number(a === "results") - Number(b === "results")
    )
    for (const [matchId, tab] of ordered) {
        const known = stored.get(matchId)
        if (known) {
            if (known.tab !== tab) retab.push({ matchId, tab })
        } else if (free > 0) {
            add.push({ matchId, tab })
            free--
        } else skipped++
    }
    return { add, retab, listed: new Set(tabs.keys()), skipped }
}

/** A stored fixture as the read acceptance needs it. */
export type StoredFixtureState = {
    matchId: string
    firstSeenAt: number
    tab: IndexTab | null
    snapshot: LeagueSnapshot | null
    result: LeagueResultRecord | null
    /** When Logi first saw placements; dates a result whose kickoff is unknown. */
    resultSeenAt: number | null
}

export type FixtureReadOutcome = {
    snapshot: LeagueSnapshot | null
    error: LeagueErrorCode | null
    phase: FixturePhase
    changes: FixtureChange[]
    result:
        | { kind: "keep" }
        | { kind: "upsert"; record: LeagueResultRecord }
        | { kind: "remove" }
    resultSeenAt: number | null
    nextRefreshAt: number
}

/**
 * Applies one read to a stored fixture. The last good snapshot survives
 * failed reads, older responses and lost structure (including lost
 * placements), exactly as tracked fixtures do.
 */
export function acceptFixtureRead(
    state: StoredFixtureState,
    read: LeagueRead,
    context: { now: number; inWindow: boolean }
): FixtureReadOutcome {
    const { now } = context
    const selected = selectTrackedSnapshot(state.snapshot, read.snapshot)
    const snapshot = selected.snapshot
    // Another reader refreshing the same page is not a failure of ours.
    const error: LeagueErrorCode | null = selected.rejected
        ? "invalid_html"
        : read.error === "refresh_in_progress" && snapshot
          ? null
          : read.error
    const changes =
        snapshot && snapshot !== state.snapshot
            ? fixtureChanges(state.snapshot, snapshot)
            : []
    const phase = fixturePhase(snapshot, state.tab)
    const resultSeenAt = snapshot?.results
        ? (state.resultSeenAt ?? now)
        : state.resultSeenAt
    const record = snapshot
        ? resultRecordFromSnapshot(
              snapshot,
              new Date(resultSeenAt ?? now).toISOString()
          )
        : null
    const result: FixtureReadOutcome["result"] = record
        ? state.result && sameResult(state.result, record)
            ? { kind: "keep" }
            : { kind: "upsert", record }
        : state.result
          ? { kind: "remove" }
          : { kind: "keep" }
    const scheduledAt = snapshot?.scheduledAt
        ? Date.parse(snapshot.scheduledAt)
        : null
    const cadence = nextFixtureRefreshAt({
        phase,
        scheduledAt,
        firstSeenAt: state.firstSeenAt,
        hasResult: Boolean(record),
        resultConfirmed: record?.confirmed ?? false,
        inWindow: context.inWindow,
        now,
    })
    const cacheNext = Date.parse(read.nextRefreshAt)
    const clamp = (value: number) =>
        Math.min(now + MAX_RETRY_AFTER_MS, Math.max(now + 60_000, value))
    const nextRefreshAt =
        error !== null
            ? clamp(Number.isFinite(cacheNext) ? cacheNext : now + 60_000)
            : cadence === null
              ? NEVER
              : cadence <= now + FIXTURE_REFRESH_MS.window &&
                  Number.isFinite(cacheNext)
                ? // Read again as soon as the shared cache may hold a newer page.
                  Math.max(now + 60_000, Math.min(cadence, cacheNext))
                : cadence
    return {
        snapshot,
        error,
        phase,
        changes,
        result,
        resultSeenAt,
        nextRefreshAt,
    }
}

/**
 * Whether a fixture is among the nearest ones any panel can show, which are
 * kept as fresh as the shared cache allows.
 */
export function isInPanelWindow(
    matchId: string,
    open: ReadonlyArray<{
        matchId: string
        phase: FixturePhase
        scheduledAt: string | null
        fixtureNumber: number | null
    }>,
    now: number
) {
    return nearestFixtures(open, now, PANEL_WINDOW).shown.some(
        (fixture) => fixture.matchId === matchId
    )
}

/** Claim priority: live first, then upcoming, then finished fixtures. */
export const CLAIM_PHASE_ORDER: readonly FixturePhase[] = [
    "live",
    "upcoming",
    "completed",
    "cancelled",
]

export type FixtureClaim = { id: string; fence: number; matchId: string }

export type LeagueCollectionPorts = {
    now: () => number
    /** Claims the next due fixture under a fenced lease, or null. */
    claim: () => Promise<FixtureClaim | null>
    /** Reads one match through the shared detail cache and fetch budget. */
    read: (sourceUrl: string) => Promise<LeagueRead | null>
    /** Stores the read; returns false when the lease was lost. */
    finish: (claim: FixtureClaim, read: LeagueRead) => Promise<boolean>
}

/**
 * Reads up to `limit` due fixtures, one claim at a time so no batch of leases
 * expires while earlier reads run. A failing read is stored as a network
 * error and retried later; it never discards the last good snapshot.
 */
export async function collectLeagueFixtures(
    ports: LeagueCollectionPorts,
    limit: number
): Promise<{ read: number; failed: number; lost: number }> {
    let read = 0,
        failed = 0,
        lost = 0
    for (let n = 0; n < limit; n++) {
        const claim = await ports.claim()
        if (!claim) break
        let data: LeagueRead | null
        try {
            data = await ports.read(
                `https://wardogsleague.net/matches/${claim.matchId}`
            )
        } catch {
            data = null
        }
        const now = ports.now()
        const stored: LeagueRead = data ?? {
            snapshot: null,
            stale: true,
            ageSeconds: null,
            lastAttemptAt: new Date(now).toISOString(),
            nextRefreshAt: new Date(now + 60_000).toISOString(),
            error: "network",
        }
        if (stored.error) failed++
        else read++
        if (!(await ports.finish(claim, stored))) lost++
    }
    return { read, failed, lost }
}
