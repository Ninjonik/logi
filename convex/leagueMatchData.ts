"use node"
import {
    readLeagueMatch,
    type Served,
    type Prepared,
    type CacheState,
} from "../src/application/wardogs-league/read-match"
import { fetchLeagueMatch } from "../src/infrastructure/wardogs-league/fetch-match"
import { action, type ActionCtx } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import { v } from "convex/values"
type ReadArgs = {
    secret: string
    guildId: string
    sourceUrl: string
    keyHash?: string
}
/**
 * One detail read through the shared five-minute cache, fetch budget and
 * provider cooldown. Used by the public action and by the League-wide
 * fixture collector, so both never fetch the same page twice.
 */
export function sharedLeagueRead(
    ctx: Pick<ActionCtx, "runMutation">,
    args: ReadArgs
): Promise<Served> {
    return readLeagueMatch(args.sourceUrl, {
        now: Date.now,
        reserve: () =>
            ctx.runMutation(
                makeFunctionReference<"mutation", ReadArgs, Prepared>(
                    "leagueMatches:reserve"
                ),
                args
            ),
        fetch: fetchLeagueMatch,
        finish: (claim, result) =>
            ctx.runMutation(
                makeFunctionReference<
                    "mutation",
                    ReadArgs &
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
}
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
        return sharedLeagueRead(ctx, args)
    },
})
