import { assertInternalSecret } from "./discord_shared"
import { query } from "./_generated/server"
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
