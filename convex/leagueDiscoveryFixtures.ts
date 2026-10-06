import {
    ensureLeagueCollectionState,
    fixtureOrderItem,
    openLeagueFixtures,
    resultDocFields,
    resultRecordFromDoc,
    storedLeagueSnapshot,
} from "../src/infrastructure/convex/league-fixture-store"
import {
    acceptFixtureRead,
    isInPanelWindow,
    planIndexAdmission,
    CLAIM_PHASE_ORDER,
} from "../src/application/wardogs-league/league-fixtures"
import {
    fixtureExpired,
    fixturePhase,
    FIXTURE_LEASE_MS,
    MAX_LEAGUE_FIXTURES,
} from "../src/domain/wardogs-league/all-fixtures"
import { leagueReadSchema } from "../src/domain/wardogs-league/contracts"
import { internalMutation, internalQuery } from "./_generated/server"
import { leagueSeason } from "../src/domain/wardogs-league/results"
import { matchUrl } from "../src/domain/wardogs-league/match-url"
import { assertSessionGateway } from "./dashboardSessionStore"
import { leagueCollectionActive } from "./leagueTrackingStore"
import { v } from "convex/values"

/**
 * The League-wide fixture and result store behind the WD League panels.
 * Only the collector action calls these, with the internal secret.
 */
export const status = internalQuery({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        return { wanted: await leagueCollectionActive(ctx) }
    },
})

/** Admits the latest shared index scan once into the store. */
export const admitIndex = internalMutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const index = await ctx.db
            .query("leagueIndexCache")
            .withIndex("key", (q) => q.eq("key", "indexes"))
            .unique()
        const state = await ensureLeagueCollectionState(ctx)
        if (!index?.fetchedAt || index.fetchedAt === state.admittedIndexAt)
            return { added: 0, retabbed: 0, skipped: state.skipped ?? 0 }
        const rows = await ctx.db
            .query("leagueFixtures")
            .take(MAX_LEAGUE_FIXTURES)
        const plan = planIndexAdmission(
            new Map(rows.map((row) => [row.matchId, { tab: row.tab }])),
            {
                fixtureUrls: index.fixtureUrls,
                resultUrls: index.resultUrls ?? [],
            },
            MAX_LEAGUE_FIXTURES
        )
        const now = Date.now()
        let revision = state.fixturesRevision
        for (const { matchId, tab } of plan.add)
            await ctx.db.insert("leagueFixtures", {
                matchId,
                firstSeenAt: now,
                tab,
                listed: true,
                phase: fixturePhase(null, tab),
                hasResult: false,
                changes: ["discovered"],
                changedAt: now,
                nextRefreshAt: now,
                leaseUntil: 0,
                fence: 0,
                revision: ++revision,
            })
        for (const { matchId, tab } of plan.retab) {
            const row = rows.find((item) => item.matchId === matchId)!
            await ctx.db.patch(row._id, {
                tab,
                phase: fixturePhase(
                    storedLeagueSnapshot(row.snapshotJson),
                    tab
                ),
                // A match that moved to results is read soon for placements.
                nextRefreshAt: Math.min(row.nextRefreshAt, now),
                revision: ++revision,
            })
        }
        // Pagination may hide links; only a complete scan unlists fixtures.
        if (!index.incomplete)
            for (const row of rows) {
                const listed = plan.listed.has(row.matchId)
                if (row.listed !== listed)
                    await ctx.db.patch(row._id, { listed })
            }
        await ctx.db.patch(state._id, {
            admittedIndexAt: index.fetchedAt,
            skipped: plan.skipped,
            fixturesRevision: revision,
        })
        return {
            added: plan.add.length,
            retabbed: plan.retab.length,
            skipped: plan.skipped,
        }
    },
})

/** Removes expired fixtures and results older than the previous season. */
export const pruneFixtures = internalMutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const now = Date.now()
        let removed = 0
        for (const phase of [
            "completed",
            "cancelled",
            "upcoming",
            "live",
        ] as const)
            for (const row of await ctx.db
                .query("leagueFixtures")
                .withIndex("phase_scheduledAt", (q) => q.eq("phase", phase))
                .take(25))
                if (
                    row.leaseUntil <= now &&
                    fixtureExpired({
                        phase: row.phase,
                        scheduledAt: row.scheduledAt ?? null,
                        firstSeenAt: row.firstSeenAt,
                        listed: row.listed,
                        now,
                    })
                ) {
                    await ctx.db.delete(row._id)
                    removed++
                }
        const keepFrom = String(
            Number(leagueSeason(new Date(now).toISOString())) - 1
        )
        for (const doc of await ctx.db
            .query("leagueResults")
            .withIndex("occurredAt")
            .take(25))
            if (doc.season < keepFrom) {
                await ctx.db.delete(doc._id)
                removed++
            }
        return { removed }
    },
})

/**
 * A changed results parser re-reads finished pages it has not seen yet, a
 * few per run, so results published before the parser existed are found.
 */
export const markReparse = internalMutation({
    args: { secret: v.string(), resultsParser: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const now = Date.now()
        let marked = 0
        for (const row of await ctx.db
            .query("leagueFixtures")
            .withIndex("phase_hasResult", (q) =>
                q.eq("phase", "completed").eq("hasResult", false)
            )
            .take(200)) {
            if (marked >= 20) break
            if (
                row.snapshotJson &&
                row.resultsParser !== args.resultsParser &&
                row.nextRefreshAt > now &&
                row.leaseUntil <= now
            ) {
                await ctx.db.patch(row._id, { nextRefreshAt: now })
                marked++
            }
        }
        return { marked }
    },
})

/** Claims the next due fixture: live, then upcoming, then finished ones. */
export const claimFixture = internalMutation({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const now = Date.now()
        for (const phase of CLAIM_PHASE_ORDER) {
            const row = (
                await ctx.db
                    .query("leagueFixtures")
                    .withIndex("phase_nextRefreshAt", (q) =>
                        q.eq("phase", phase).lte("nextRefreshAt", now)
                    )
                    .take(10)
            ).find((item) => item.leaseUntil <= now)
            if (!row) continue
            const fence = row.fence + 1
            await ctx.db.patch(row._id, {
                fence,
                leaseUntil: now + FIXTURE_LEASE_MS,
                lastAttemptAt: now,
            })
            return { id: String(row._id), fence, matchId: row.matchId }
        }
        return null
    },
})

/** Stores one read under its fence and updates results and revisions. */
export const finishFixture = internalMutation({
    args: {
        secret: v.string(),
        id: v.id("leagueFixtures"),
        fence: v.number(),
        readJson: v.string(),
        resultsParser: v.string(),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const row = await ctx.db.get(args.id),
            now = Date.now()
        if (!row || row.fence !== args.fence || row.leaseUntil <= now)
            return false
        if (args.readJson.length > 100_000) throw new Error("Read too large.")
        const read = leagueReadSchema.parse(JSON.parse(args.readJson))
        if (
            read.snapshot &&
            (read.snapshot.id !== row.matchId ||
                read.snapshot.sourceUrl !==
                    matchUrl(`https://wardogsleague.net/matches/${row.matchId}`)
                        .url)
        )
            throw new Error("Unexpected match.")
        const resultDoc = await ctx.db
            .query("leagueResults")
            .withIndex("matchId", (q) => q.eq("matchId", row.matchId))
            .unique()
        const outcome = acceptFixtureRead(
            {
                matchId: row.matchId,
                firstSeenAt: row.firstSeenAt,
                tab: row.tab,
                snapshot: storedLeagueSnapshot(row.snapshotJson),
                result: resultDoc ? resultRecordFromDoc(resultDoc) : null,
                resultSeenAt: row.resultSeenAt ?? null,
            },
            read,
            {
                now,
                inWindow: isInPanelWindow(
                    row.matchId,
                    (await openLeagueFixtures(ctx)).map(fixtureOrderItem),
                    now
                ),
            }
        )
        const state = await ensureLeagueCollectionState(ctx)
        let { fixturesRevision, resultsRevision } = state
        // Only a page fetched during this claim proves what the current
        // results parser sees; a cached copy may predate it.
        const fetchedNow =
            read.snapshot !== null &&
            Date.parse(read.snapshot.fetchedAt) >=
                (row.lastAttemptAt ?? now) - 5_000
        const scheduledAt = outcome.snapshot?.scheduledAt
        await ctx.db.patch(row._id, {
            ...(outcome.snapshot
                ? {
                      snapshotJson: JSON.stringify(outcome.snapshot),
                      scheduledAt: scheduledAt
                          ? Date.parse(scheduledAt)
                          : undefined,
                      fixtureNumber:
                          outcome.snapshot.fixtureNumber ?? undefined,
                  }
                : {}),
            phase: outcome.phase,
            hasResult:
                outcome.result.kind === "upsert" ||
                (outcome.result.kind === "keep" && resultDoc !== null),
            resultSeenAt: outcome.resultSeenAt ?? undefined,
            ...(fetchedNow ? { resultsParser: args.resultsParser } : {}),
            ...(outcome.changes.length
                ? {
                      changes: outcome.changes,
                      changedAt: now,
                      revision: ++fixturesRevision,
                  }
                : {}),
            error: outcome.error ?? undefined,
            nextRefreshAt: outcome.nextRefreshAt,
            leaseUntil: 0,
        })
        if (outcome.result.kind === "upsert") {
            const fields = resultDocFields(
                outcome.result.record,
                ++resultsRevision
            )
            if (resultDoc) await ctx.db.replace(resultDoc._id, fields)
            else await ctx.db.insert("leagueResults", fields)
        } else if (outcome.result.kind === "remove" && resultDoc) {
            await ctx.db.delete(resultDoc._id)
            resultsRevision++
        }
        if (
            fixturesRevision !== state.fixturesRevision ||
            resultsRevision !== state.resultsRevision
        )
            await ctx.db.patch(state._id, {
                fixturesRevision,
                resultsRevision,
            })
        return true
    },
})
