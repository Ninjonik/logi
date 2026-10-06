import { v } from "convex/values"

import { assertInternalSecret } from "./discord_shared"
import { query } from "./_generated/server"

/**
 * What `/link` needs besides the person's linked accounts (boards L4 1.5
 * and M3 1.2): the person's open clan application in this server, so
 * unlinking an account it uses warns first (L4-B09). The "Hrál jsi u nás?"
 * search reads `clanPlayerHistory.ts`, as the application does.
 * Bot only: the internal secret is checked before anything is read.
 */
export const getLinkContext = query({
    args: { secret: v.string(), guildId: v.string(), userId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const applications = await ctx.db
            .query("membershipApplicationThreads")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .filter((q) =>
                q.and(
                    q.eq(q.field("creatorId"), args.userId),
                    q.eq(q.field("status"), "open")
                )
            )
            .take(5)
        return {
            application: applications.length
                ? {
                      answers: applications.flatMap((application) =>
                          application.answers.map((answer) => ({
                              value: answer.value,
                          }))
                      ),
                      // The game accounts given in the application windows (L4-B09).
                      accounts: applications.flatMap((application) =>
                          storedApplicationAccounts(application.accounts)
                      ),
                  }
                : null,
        }
    },
})

/** An application's accounts as stored IDs (`steam:7656…`, `xbox:Hrac17`). */
function storedApplicationAccounts(
    accounts:
        | {
              steam?: string
              epic?: string
              xbox?: string
              playstation?: string
          }
        | undefined
) {
    if (!accounts) return []
    return (["steam", "epic", "xbox", "playstation"] as const).flatMap(
        (platform) =>
            accounts[platform]?.trim()
                ? [`${platform}:${accounts[platform]!.trim()}`]
                : []
    )
}
