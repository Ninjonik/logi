import type { QueryCtx } from "./_generated/server"

/**
 * The read of a workspace's Wardogs League settings, apart from
 * `leagueTrackingStore.ts` (admission, eviction and the change feed) so the
 * panel read the bot makes every minute per clan bundles nothing but this
 * (ARCHITECTURE.md, "Convex hot paths").
 */
export function trackingConfig(ctx: Pick<QueryCtx, "db">, guildId: string) {
    return ctx.db
        .query("leagueTrackingSettings")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
}
