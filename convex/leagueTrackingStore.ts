import { projectLeagueFixture } from "../src/domain/wardogs-league/fixture"
import { MAX_TRACKED } from "../src/domain/wardogs-league/discovery"
import { appendIntegrationChange } from "./integrationChangeLog"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"
export function trackingConfig(ctx: Pick<QueryCtx, "db">, guildId: string) {
    return ctx.db
        .query("leagueTrackingSettings")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
}
export function trackedMatch(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    matchId: string
) {
    return ctx.db
        .query("leagueTrackedMatches")
        .withIndex("identity", (q) =>
            q.eq("guildId", guildId).eq("matchId", matchId)
        )
        .unique()
}
export async function ensureTracked(
    ctx: MutationCtx,
    guildId: string,
    matchId: string
) {
    const old = await trackedMatch(ctx, guildId, matchId)
    if (old) return old
    const rows = await ctx.db
        .query("leagueTrackedMatches")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .take(MAX_TRACKED)
    if (rows.length >= MAX_TRACKED) throw new Error("Tracking limit reached.")
    const now = Date.now()
    const id = await ctx.db.insert("leagueTrackedMatches", {
        guildId,
        matchId,
        firstSeenAt: now,
        revision: now,
        pinned: false,
        automatic: false,
        tracked: false,
        announce: false,
        ignored: false,
        paused: false,
        discordRefs: [],
        state: "pending",
        nextRefreshAt: now,
        leaseUntil: 0,
        fence: 0,
    })
    return (await ctx.db.get(id))!
}
export async function updateTracked(
    ctx: MutationCtx,
    row: Doc<"leagueTrackedMatches">,
    patch: Partial<Omit<Doc<"leagueTrackedMatches">, "_id" | "_creationTime">>
) {
    const now = Date.now(),
        revision = Math.max(now, row.revision + 1)
    await ctx.db.patch(row._id, { ...patch, revision })
    const after = { ...row, ...patch, revision }
    if (row.tracked || after.tracked)
        await appendIntegrationChange(ctx, {
            guildId: row.guildId,
            gameId: "wardogs",
            resource: "league-fixtures",
            id: row.matchId,
            operation: projectLeagueFixture(after, now) ? "upsert" : "remove",
        })
    return after
}
