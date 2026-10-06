import { query, type QueryCtx } from "./_generated/server"
import { assertInternalSecret } from "./discord_shared"
import { teamDtoOf } from "./teams"
import { v } from "convex/values"

/**
 * The active catalogue teams that represent this clan (`linkedGuildId`), one
 * per game at most in practice. The new-match flow shows it as "your team".
 */
export const linked = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const rows = await ctx.db
            .query("teamDirectory")
            .withIndex("linkedGuildId", (q) =>
                q.eq("linkedGuildId", args.guildId)
            )
            .take(20)
        return await Promise.all(
            rows
                .filter((row) => !row.archivedAt && !row.mergedIntoTeamId)
                .map((row) => teamDtoOf(ctx, row))
        )
    },
})

/**
 * The short code of the clan's own catalogue team ("VLK"), for the round
 * badge on panel banners (P7-13, P8-07). Hell Let Loose first, then Wardogs;
 * null when no linked team has one.
 */
export async function clanShortCode(
    ctx: Pick<QueryCtx, "db">,
    guildId: string
): Promise<string | null> {
    const rows = await ctx.db
        .query("teamDirectory")
        .withIndex("linkedGuildId", (q) => q.eq("linkedGuildId", guildId))
        .take(20)
    const active = rows
        .filter(
            (row) =>
                !row.archivedAt &&
                !row.mergedIntoTeamId &&
                row.shortCode?.trim()
        )
        .sort(
            (a, b) =>
                a.gameId.localeCompare(b.gameId) || a.name.localeCompare(b.name)
        )
    return active[0]?.shortCode?.trim() ?? null
}
