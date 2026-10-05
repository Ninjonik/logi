import {
    acceptFixtureRead,
    isInPanelWindow,
    planIndexAdmission,
    CLAIM_PHASE_ORDER,
    type FixtureClaim,
    type LeagueCollectionPorts,
} from "@/application/wardogs-league/league-fixtures"
import {
    fixturePhase,
    MAX_LEAGUE_FIXTURES,
    type FixtureChange,
    type FixturePhase,
    type IndexTab,
} from "@/domain/wardogs-league/all-fixtures"
import {
    CACHE_MS,
    type LeagueRead,
    type LeagueSnapshot,
} from "@/domain/wardogs-league/contracts"
import {
    resultRecordFromSnapshot,
    type LeagueResultRecord,
} from "@/domain/wardogs-league/results"
import type { LeaguePanelSource } from "@/application/wardogs-league/league-panels"
import type { StoredLeagueFixture } from "@/domain/wardogs-league/panels"

type Team = NonNullable<LeagueSnapshot["teams"]>[number]
const team = (
    code: string,
    name: string,
    faction: string,
    nations: string[],
    members: number
): Team => ({
    code,
    name,
    profileUrl: `https://wardogsleague.net/teams/${code}`,
    nations,
    displayedMemberCount: members,
    faction,
    readyCheck: "Ready check not run yet",
})
/** Teams of the design board, with the captured fixture's three first. */
export const LEAGUE_TEAMS = {
    VLK: team("VLK", "Valkyria", "Valkyra", ["CZE", "SVK"], 48),
    ROG: team("ROG", "Team Rogue", "Manticore", ["FRA"], 53),
    BAMC: team(
        "BAMC",
        "Batallón de Asalto, Maniobra y Combate",
        "Lonestar",
        ["ESP"],
        123
    ),
    OSP: team("OSP", "Ospreys", "Valkyra", ["GBR"], 37),
    KOS: team("KOS", "Kosáci", "Manticore", ["CZE"], 29),
    TRN: team("TRN", "Tarantula", "Lonestar", ["DEU"], 31),
    MNT: team("MNT", "Mountain Rangers", "Lonestar", ["AUT"], 26),
    DEF: team("DEF", "Defiant", "Valkyra", ["NLD"], 41),
    HAV: team("HAV", "Havran Squad", "Manticore", ["POL"], 34),
} as const

/**
 * A snapshot shaped like the captured Scheduled page (fixture #38, VLK · ROG
 * · BAMC on Zestafona), for tests. Results are synthetic: no completed page
 * has been captured.
 */
export function leagueSnapshotFixture(
    overrides: Partial<LeagueSnapshot> = {}
): LeagueSnapshot {
    const id = overrides.id ?? "cmuqt8ep605e1lf018w2nlywu"
    return {
        id,
        sourceUrl: `https://wardogsleague.net/matches/${id}`,
        parserVersion: "wardogs-league-html/1",
        title: "VLK · ROG · BAMC",
        fixtureNumber: 38,
        type: "Friendly",
        status: "Scheduled",
        scheduledAt: "2026-10-10T18:30:00.000Z",
        request: null,
        teams: [LEAGUE_TEAMS.VLK, LEAGUE_TEAMS.ROG, LEAGUE_TEAMS.BAMC],
        map: {
            name: "Zestafona",
            zone: "SmallFactory",
            lighting: "DayLateGrayFog",
        },
        hosting: { mode: "Self-hosted", teamCode: "VLK" },
        moderator: "Awaiting",
        mapVote: {
            status: "Open",
            closesAt: "2026-10-03T10:19:33.154Z",
            ballots: null,
        },
        rules: { summary: "0 of 3 picked", choices: null },
        readyCheck: "Not started",
        progress: [
            { label: "Locked", state: "done", detail: "from REQ #65" },
            { label: "Rules agreed", state: "current", detail: "0/3" },
            { label: "Map vote", state: "not_started", detail: "15h left" },
            {
                label: "Moderator claimed",
                state: "not_started",
                detail: "Awaiting",
            },
            { label: "Host server", state: "not_started", detail: "VLK hosts" },
            {
                label: "Ready check",
                state: "not_started",
                detail: "Not started",
            },
            { label: "Live", state: "not_started", detail: null },
            { label: "Placements", state: "not_started", detail: "0/3" },
            { label: "Confirmed", state: "not_started", detail: null },
        ],
        scoringRule: "1st 3 · 2nd 2 · 3rd 1",
        results: null,
        warnings: ["results_not_supported"],
        fetchedAt: "2026-10-02T18:32:33.561Z",
        ...overrides,
    }
}

/** A completed snapshot with synthetic placements, one team code per place. */
export function completedLeagueSnapshot(input: {
    id: string
    fixtureNumber: number
    scheduledAt: string | null
    podium: [
        keyof typeof LEAGUE_TEAMS,
        keyof typeof LEAGUE_TEAMS,
        keyof typeof LEAGUE_TEAMS,
    ]
    type?: string
    scoringRule?: string | null
    confirmed?: boolean
    fetchedAt?: string
}): LeagueSnapshot {
    return leagueSnapshotFixture({
        id: input.id,
        title: input.podium.join(" · "),
        fixtureNumber: input.fixtureNumber,
        type: input.type ?? "League",
        status: "Completed",
        scheduledAt: input.scheduledAt,
        teams: input.podium.map((code) => LEAGUE_TEAMS[code]),
        hosting: { mode: "Self-hosted", teamCode: input.podium[0] },
        scoringRule:
            input.scoringRule === undefined
                ? "1st 3 · 2nd 2 · 3rd 1"
                : input.scoringRule,
        results: {
            placements: input.podium.map((teamCode, index) => ({
                place: index + 1,
                teamCode,
            })),
            confirmed: input.confirmed ?? true,
        },
        warnings: [],
        fetchedAt: input.fetchedAt ?? "2026-10-09T12:00:00.000Z",
    })
}

/** A successful read of a snapshot through the shared cache. */
export function leagueReadOf(
    snapshot: LeagueSnapshot | null,
    now: number,
    error: LeagueRead["error"] = null
): LeagueRead {
    return {
        snapshot,
        stale: error !== null,
        ageSeconds: snapshot
            ? Math.max(
                  0,
                  Math.floor((now - Date.parse(snapshot.fetchedAt)) / 1000)
              )
            : null,
        lastAttemptAt: new Date(now).toISOString(),
        nextRefreshAt: new Date(now + CACHE_MS).toISOString(),
        error,
    }
}

export type InMemoryLeagueFixture = {
    id: string
    matchId: string
    firstSeenAt: number
    tab: IndexTab | null
    listed: boolean
    snapshot: LeagueSnapshot | null
    phase: FixturePhase
    result: LeagueResultRecord | null
    resultSeenAt: number | null
    error: string | null
    nextRefreshAt: number
    leaseUntil: number
    fence: number
    revision: number
    changes: FixtureChange[]
}

/**
 * The League-wide fixture and result store kept in memory, wired to the same
 * application rules as the Convex adapter. For use-case tests only.
 */
export class InMemoryLeagueStore {
    fixtures = new Map<string, InMemoryLeagueFixture>()
    results = new Map<string, LeagueResultRecord>()
    resultsRevision = 0
    fixturesRevision = 0
    private sequence = 0

    constructor(
        public current: number,
        private capacity = MAX_LEAGUE_FIXTURES
    ) {}

    now = () => this.current

    admit(index: { fixtureUrls: string[]; resultUrls: string[] }) {
        const plan = planIndexAdmission(this.fixtures, index, this.capacity)
        for (const { matchId, tab } of plan.add)
            this.fixtures.set(matchId, {
                id: `fixture-${++this.sequence}`,
                matchId,
                firstSeenAt: this.current,
                tab,
                listed: true,
                snapshot: null,
                phase: fixturePhase(null, tab),
                result: null,
                resultSeenAt: null,
                error: null,
                nextRefreshAt: this.current,
                leaseUntil: 0,
                fence: 0,
                revision: ++this.fixturesRevision,
                changes: [],
            })
        for (const { matchId, tab } of plan.retab) {
            const row = this.fixtures.get(matchId)!
            row.tab = tab
            row.phase = fixturePhase(row.snapshot, tab)
            row.nextRefreshAt = this.current
        }
        for (const row of this.fixtures.values())
            row.listed = plan.listed.has(row.matchId)
        return plan
    }

    private open() {
        return [...this.fixtures.values()]
            .filter((row) => row.phase === "live" || row.phase === "upcoming")
            .map((row) => ({
                matchId: row.matchId,
                phase: row.phase,
                scheduledAt: row.snapshot?.scheduledAt ?? null,
                fixtureNumber: row.snapshot?.fixtureNumber ?? null,
            }))
    }

    collectionPorts(
        read: (url: string) => Promise<LeagueRead | null>
    ): LeagueCollectionPorts {
        return {
            now: this.now,
            read,
            claim: async () => {
                const due = [...this.fixtures.values()]
                    .filter(
                        (row) =>
                            row.nextRefreshAt <= this.current &&
                            row.leaseUntil <= this.current
                    )
                    .sort(
                        (a, b) =>
                            CLAIM_PHASE_ORDER.indexOf(a.phase) -
                                CLAIM_PHASE_ORDER.indexOf(b.phase) ||
                            a.nextRefreshAt - b.nextRefreshAt
                    )[0]
                if (!due) return null
                due.fence++
                due.leaseUntil = this.current + 30_000
                return { id: due.id, fence: due.fence, matchId: due.matchId }
            },
            finish: async (claim: FixtureClaim, data: LeagueRead) => {
                const row = this.fixtures.get(claim.matchId)
                if (
                    !row ||
                    row.id !== claim.id ||
                    row.fence !== claim.fence ||
                    row.leaseUntil <= this.current
                )
                    return false
                const outcome = acceptFixtureRead(row, data, {
                    now: this.current,
                    inWindow: isInPanelWindow(
                        row.matchId,
                        this.open(),
                        this.current
                    ),
                })
                Object.assign(row, {
                    snapshot: outcome.snapshot,
                    phase: outcome.phase,
                    error: outcome.error,
                    resultSeenAt: outcome.resultSeenAt,
                    nextRefreshAt: outcome.nextRefreshAt,
                    leaseUntil: 0,
                    changes: outcome.changes.length
                        ? outcome.changes
                        : row.changes,
                    revision: outcome.changes.length
                        ? ++this.fixturesRevision
                        : row.revision,
                })
                if (outcome.result.kind === "upsert") {
                    row.result = outcome.result.record
                    this.results.set(row.matchId, outcome.result.record)
                    this.resultsRevision++
                } else if (outcome.result.kind === "remove") {
                    row.result = null
                    this.results.delete(row.matchId)
                    this.resultsRevision++
                }
                return true
            },
        }
    }

    panelSource(): LeaguePanelSource {
        return {
            openFixtures: async () =>
                [...this.fixtures.values()]
                    .filter(
                        (row) =>
                            row.snapshot &&
                            (row.phase === "live" || row.phase === "upcoming")
                    )
                    .map((row) => ({
                        matchId: row.matchId,
                        phase: row.phase,
                        snapshot: row.snapshot!,
                        stale:
                            row.error !== null ||
                            this.current -
                                Date.parse(row.snapshot!.fetchedAt) >=
                                CACHE_MS,
                        revision: row.revision,
                    })),
            seasonResults: async (season) =>
                [...this.results.values()].filter(
                    (record) => record.season === season
                ),
            resultsSince: async (since) =>
                [...this.results.values()].filter(
                    (record) => Date.parse(record.occurredAt) >= since
                ),
            revisions: async () => ({
                results: this.resultsRevision,
                fixtures: this.fixturesRevision,
            }),
        }
    }
}

type BoardCode = keyof typeof LEAGUE_TEAMS
/** The board's recent results #33–#37 (P6-18) as stored results. */
export function boardLeagueResults(): LeagueResultRecord[] {
    const rows: Array<
        [number, string, [BoardCode, BoardCode, BoardCode], string]
    > = [
        [33, "2026-10-03T18:00:00.000Z", ["ROG", "VLK", "DEF"], "League"],
        [34, "2026-10-04T18:00:00.000Z", ["OSP", "BAMC", "MNT"], "League"],
        [35, "2026-10-06T18:00:00.000Z", ["ROG", "HAV", "KOS"], "League"],
        [36, "2026-10-07T18:00:00.000Z", ["VLK", "MNT", "TRN"], "Friendly"],
        [37, "2026-10-08T18:00:00.000Z", ["BAMC", "OSP", "DEF"], "League"],
    ]
    return rows.map(([fixtureNumber, scheduledAt, podium, type]) => {
        const record = resultRecordFromSnapshot(
            completedLeagueSnapshot({
                id: `m${fixtureNumber}`,
                fixtureNumber,
                scheduledAt,
                podium,
                type,
            }),
            scheduledAt
        )
        if (!record) throw new Error("Synthetic result missing.")
        return record
    })
}

/** The board's upcoming fixtures #38–#43 (P6-22..29), read a minute before `now`. */
export function boardLeagueFixtures(now: number): StoredLeagueFixture[] {
    const fixture = (
        fixtureNumber: number,
        scheduledAt: string,
        codes: [BoardCode, BoardCode, BoardCode],
        type: string,
        extra: Partial<LeagueSnapshot> = {}
    ): StoredLeagueFixture => ({
        matchId: `f${fixtureNumber}`,
        phase: "upcoming",
        stale: false,
        revision: fixtureNumber,
        snapshot: leagueSnapshotFixture({
            id: `f${fixtureNumber}`,
            sourceUrl: `https://wardogsleague.net/matches/f${fixtureNumber}`,
            fixtureNumber,
            type,
            scheduledAt,
            teams: codes.map((code) => LEAGUE_TEAMS[code]),
            hosting: { mode: "Self-hosted", teamCode: codes[0] },
            mapVote: {
                status: "Open",
                closesAt: new Date(now + 15 * 3600_000).toISOString(),
                ballots: null,
            },
            fetchedAt: new Date(now - 60_000).toISOString(),
            ...extra,
        }),
    })
    const quiet = { map: null, mapVote: null }
    return [
        fixture(
            38,
            "2026-10-10T18:30:00.000Z",
            ["VLK", "ROG", "BAMC"],
            "Friendly"
        ),
        fixture(
            39,
            "2026-10-11T16:00:00.000Z",
            ["OSP", "KOS", "TRN"],
            "League",
            {
                map: null,
                moderator: "Kowalski",
                rules: { summary: "2 of 3 picked", choices: null },
            }
        ),
        fixture(
            40,
            "2026-10-11T19:00:00.000Z",
            ["MNT", "DEF", "HAV"],
            "League",
            {
                map: null,
                mapVote: { status: "Not open", closesAt: null, ballots: null },
                rules: { summary: "1 of 3 picked", choices: null },
            }
        ),
        fixture(
            41,
            "2026-10-13T18:00:00.000Z",
            ["ROG", "HAV", "TRN"],
            "Friendly",
            quiet
        ),
        fixture(
            42,
            "2026-10-15T18:00:00.000Z",
            ["VLK", "MNT", "OSP"],
            "League",
            {
                ...quiet,
                hosting: { mode: "Self-hosted", teamCode: "MNT" },
            }
        ),
        fixture(
            43,
            "2026-10-17T17:00:00.000Z",
            ["BAMC", "DEF", "KOS"],
            "League",
            quiet
        ),
    ]
}
