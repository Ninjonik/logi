import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { projectLeagueFixture } from "../src/domain/wardogs-league/fixture"
import { assertSessionGateway } from "./dashboardSessionStore"
import { query, type QueryCtx } from "./_generated/server"
import { trackedMatch } from "./leagueTrackingStore"
import { v } from "convex/values"
export async function readLeagueFixture(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    id: string
) {
    const row = await trackedMatch(ctx, guildId, id)
    return row ? projectLeagueFixture(row, Date.now()) : null
}
export const list = query({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        guildId: v.string(),
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (
            !key ||
            key.revokedAt ||
            key.guildId !== args.guildId ||
            !isApiKeyReadAccess(key.readAccess) ||
            !allowsApiKeyRead(key.readAccess, "league-fixtures", "wardogs")
        )
            return null
        if (
            !Number.isInteger(args.limit) ||
            args.limit < 1 ||
            args.limit > 100 ||
            (args.cursor?.length ?? 0) > 4096
        )
            throw new Error("Invalid pagination.")
        const page = await ctx.db
            .query("leagueTrackedMatches")
            .withIndex("published", (q) =>
                q.eq("guildId", args.guildId).eq("tracked", true)
            )
            .paginate({ cursor: args.cursor, numItems: args.limit })
        return {
            items: page.page.flatMap((row) => {
                const value = projectLeagueFixture(row, Date.now())
                return value ? [value] : []
            }),
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})
