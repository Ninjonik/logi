import { assertInternalSecret } from "./discord_shared"
import { query } from "./_generated/server"
import { v } from "convex/values"

export const overview = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const [users, guilds, events] = await Promise.all([
            ctx.db.query("users").collect(),
            ctx.db.query("guilds").collect(),
            ctx.db.query("events").collect(),
        ])

        return {
            players: users.length,
            teams: guilds.length,
            matches: events.filter(
                (event) => (event.kind ?? "match") === "match"
            ).length,
            operations: events.length,
        }
    },
})
