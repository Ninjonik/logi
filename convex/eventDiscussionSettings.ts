import { eventDiscussionDefaults } from "../src/domain/events/discussion"
import { resolveGameScope } from "../src/domain/games/game"
import type { QueryCtx } from "./_generated/server"

export async function loadEventDiscussionDefaults(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    gameId?: string
) {
    const config = await ctx.db
        .query("discordConfigs")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
    return eventDiscussionDefaults(config, resolveGameScope(gameId))
}
