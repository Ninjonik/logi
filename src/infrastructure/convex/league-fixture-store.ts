import { readLeagueSnapshotPayload } from "@/domain/wardogs-league/snapshot-payload"
import type { LeaguePanelSource } from "@/application/wardogs-league/league-panels"
import type { MutationCtx, QueryCtx } from "../../../convex/_generated/server"
import type { LeagueResultRecord } from "@/domain/wardogs-league/results"
import type { LeagueSnapshot } from "@/domain/wardogs-league/contracts"
import { fixtureStale } from "@/domain/wardogs-league/all-fixtures"
import type { Doc } from "../../../convex/_generated/dataModel"

type Db = Pick<QueryCtx, "db">
export const LEAGUE_COLLECTION_KEY = "league"
/** Caller label of League-wide reads in the shared detail cache; not a guild. */
export const LEAGUE_WIDE_READER = "league-wide"

/**
 * A stored page, or null when absent or written by an obsolete parser
 * contract. The League jobs validated it before storing; the panel reads
 * walk it on every pass, so it is read back through the guard, not Zod.
 */
export function storedLeagueSnapshot(json: string | undefined) {
    return readLeagueSnapshotPayload(json)
}

/** The stored result as the panels compute with it; the schema validated it on write. */
export function resultRecordFromDoc(
    doc: Doc<"leagueResults">
): LeagueResultRecord {
    return {
        matchId: doc.matchId,
        sourceUrl: doc.sourceUrl,
        fixtureNumber: doc.fixtureNumber,
        type: doc.type,
        occurredAt: new Date(doc.occurredAt).toISOString(),
        season: doc.season,
        pointsRule: doc.pointsRule,
        pointsRuleSource: doc.pointsRuleSource,
        confirmed: doc.confirmed,
        placements: doc.placements,
    }
}

export function resultDocFields(record: LeagueResultRecord, revision: number) {
    return {
        matchId: record.matchId,
        sourceUrl: record.sourceUrl,
        fixtureNumber: record.fixtureNumber,
        type: record.type,
        occurredAt: Date.parse(record.occurredAt),
        season: record.season,
        pointsRule: record.pointsRule,
        pointsRuleSource: record.pointsRuleSource,
        confirmed: record.confirmed,
        placements: record.placements,
        revision,
    }
}

export async function leagueCollectionState(ctx: Db) {
    return ctx.db
        .query("leagueCollectionState")
        .withIndex("key", (q) => q.eq("key", LEAGUE_COLLECTION_KEY))
        .unique()
}

export async function ensureLeagueCollectionState(ctx: MutationCtx) {
    const row = await leagueCollectionState(ctx)
    if (row) return row
    const id = await ctx.db.insert("leagueCollectionState", {
        key: LEAGUE_COLLECTION_KEY,
        fixturesRevision: 0,
        resultsRevision: 0,
    })
    return (await ctx.db.get(id))!
}

/** Live and upcoming fixtures; bounded because the store is bounded. */
export async function openLeagueFixtures(ctx: Db) {
    const rows: Doc<"leagueFixtures">[] = []
    for (const phase of ["live", "upcoming"] as const)
        rows.push(
            ...(await ctx.db
                .query("leagueFixtures")
                .withIndex("phase_scheduledAt", (q) => q.eq("phase", phase))
                .take(300))
        )
    return rows
}

export function fixtureOrderItem(row: Doc<"leagueFixtures">) {
    return {
        matchId: row.matchId,
        phase: row.phase,
        scheduledAt:
            row.scheduledAt === undefined
                ? null
                : new Date(row.scheduledAt).toISOString(),
        fixtureNumber: row.fixtureNumber ?? null,
    }
}

/** The read port of the WD League panels over the shared Convex store. */
export function convexLeaguePanelSource(
    ctx: Db,
    now: number
): LeaguePanelSource {
    return {
        openFixtures: async () =>
            (await openLeagueFixtures(ctx)).flatMap((row) => {
                const snapshot: LeagueSnapshot | null = storedLeagueSnapshot(
                    row.snapshotJson
                )
                return snapshot
                    ? [
                          {
                              matchId: row.matchId,
                              phase: row.phase,
                              snapshot,
                              stale: fixtureStale({
                                  fetchedAt: snapshot.fetchedAt,
                                  error: row.error ?? null,
                                  now,
                              }),
                              revision: row.revision,
                          },
                      ]
                    : []
            }),
        seasonResults: async (season) =>
            (
                await ctx.db
                    .query("leagueResults")
                    .withIndex("season_occurredAt", (q) =>
                        q.eq("season", season)
                    )
                    .take(2000)
            ).map(resultRecordFromDoc),
        resultsSince: async (since) =>
            (
                await ctx.db
                    .query("leagueResults")
                    .withIndex("occurredAt", (q) => q.gte("occurredAt", since))
                    .take(500)
            ).map(resultRecordFromDoc),
        revisions: async () => {
            const state = await leagueCollectionState(ctx)
            return {
                results: state?.resultsRevision ?? 0,
                fixtures: state?.fixturesRevision ?? 0,
            }
        },
    }
}
