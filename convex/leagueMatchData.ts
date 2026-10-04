"use node"
import {
    readLeagueMatch,
    type Served,
    type Prepared,
    type CacheState,
} from "../src/application/wardogs-league/read-match"
import { fetchLeagueMatch } from "../src/infrastructure/wardogs-league/fetch-match"
import { makeFunctionReference } from "convex/server"
import { action } from "./_generated/server"
import { v } from "convex/values"
export const read = action({
    args: {
        secret: v.string(),
        guildId: v.string(),
        sourceUrl: v.string(),
        keyHash: v.optional(v.string()),
    },
    handler: async (ctx, args): Promise<Served> => {
        if (
            !process.env.INTERNAL_AUTH_SECRET ||
            args.secret !== process.env.INTERNAL_AUTH_SECRET
        )
            throw new Error("Unauthorized.")
        return readLeagueMatch(args.sourceUrl, {
            now: Date.now,
            reserve: () =>
                ctx.runMutation(
                    makeFunctionReference<"mutation", typeof args, Prepared>(
                        "leagueMatches:reserve"
                    ),
                    args
                ),
            fetch: fetchLeagueMatch,
            finish: (claim, result) =>
                ctx.runMutation(
                    makeFunctionReference<
                        "mutation",
                        typeof args &
                            typeof claim & {
                                snapshotJson?: string
                                error?: string
                                retryAfterMs?: number
                            },
                        CacheState | null
                    >("leagueMatches:finish"),
                    {
                        ...args,
                        ...claim,
                        ...("snapshot" in result
                            ? { snapshotJson: JSON.stringify(result.snapshot) }
                            : result),
                    }
                ),
        })
    },
})
