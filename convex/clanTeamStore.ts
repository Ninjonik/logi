import type { QueryCtx } from "./_generated/server"

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
