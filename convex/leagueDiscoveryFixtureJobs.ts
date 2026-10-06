"use node"
import {
    collectLeagueFixtures,
    type FixtureClaim,
} from "../src/application/wardogs-league/league-fixtures"
import { RESULTS_PARSER_ID } from "../src/infrastructure/wardogs-league/parse-results"
import { LEAGUE_WIDE_READER } from "../src/infrastructure/convex/league-fixture-store"
import { FIXTURE_READS_PER_RUN } from "../src/domain/wardogs-league/all-fixtures"
import { makeFunctionReference } from "convex/server"
import { internalAction } from "./_generated/server"
import { sharedLeagueRead } from "./leagueMatchData"

const ref = (name: string) =>
    makeFunctionReference<"mutation">(`leagueDiscoveryFixtures:${name}`)

/**
 * One-minute League-wide collection for the WD League panels (P6-B01,
 * P6-B06): admit the shared index scan, prune, then read a bounded number
 * of due fixtures through the shared detail cache and fetch budget.
 */
export const collectDue = internalAction({
    args: {},
    handler: async (ctx) => {
        const secret = process.env.INTERNAL_AUTH_SECRET
        if (!secret) return
        const status: { wanted: boolean } = await ctx.runQuery(
            makeFunctionReference<"query">("leagueDiscoveryFixtures:status"),
            { secret }
        )
        if (!status.wanted) return
        await ctx.runMutation(ref("admitIndex"), { secret })
        await ctx.runMutation(ref("pruneFixtures"), { secret })
        await ctx.runMutation(ref("markReparse"), {
            secret,
            resultsParser: RESULTS_PARSER_ID,
        })
        await collectLeagueFixtures(
            {
                now: Date.now,
                claim: (): Promise<FixtureClaim | null> =>
                    ctx.runMutation(ref("claimFixture"), { secret }),
                read: async (sourceUrl) => {
                    const served = await sharedLeagueRead(ctx, {
                        secret,
                        guildId: LEAGUE_WIDE_READER,
                        sourceUrl,
                    })
                    return served.kind === "data" ? served.data : null
                },
                finish: (claim, read): Promise<boolean> =>
                    ctx.runMutation(ref("finishFixture"), {
                        secret,
                        id: claim.id,
                        fence: claim.fence,
                        readJson: JSON.stringify(read),
                        resultsParser: RESULTS_PARSER_ID,
                    }),
            },
            FIXTURE_READS_PER_RUN
        )
    },
})
