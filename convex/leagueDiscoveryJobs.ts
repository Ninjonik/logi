"use node"
import {
    INDEX_URLS,
    indexDueForWorkspace,
} from "../src/domain/wardogs-league/discovery"
import { fetchLeagueIndex } from "../src/infrastructure/wardogs-league/fetch-match"
import type { Served } from "../src/application/wardogs-league/read-match"
import { LeagueError } from "../src/domain/wardogs-league/contracts"
import type { Doc, Id } from "./_generated/dataModel"
import { makeFunctionReference } from "convex/server"
import { internalAction } from "./_generated/server"
const mutation = (name: string) =>
    makeFunctionReference<"mutation">(`leagueDiscoveryQueue:${name}`)
export const collectDue = internalAction({
    args: {},
    handler: async (ctx) => {
        await ctx.runMutation(mutation("pruneReferences"), {})
        const claim: { id: Id<"leagueIndexCache">; fence: number } | null =
            await ctx.runMutation(mutation("claimScan"), {})
        if (claim) {
            try {
                const pages = []
                for (const url of INDEX_URLS) {
                    const delay: number = await ctx.runMutation(
                        mutation("reserveIndexFetch"),
                        {}
                    )
                    if (delay > 0) throw new LeagueError("rate_limited", delay)
                    pages.push(await fetchLeagueIndex(url))
                }
                const all = [...new Set(pages.flatMap((p) => p.matchUrls))]
                await ctx.runMutation(mutation("finishScan"), {
                    ...claim,
                    matchUrls: all.slice(0, 500),
                    fixtureUrls: pages[0].matchUrls,
                    incomplete:
                        all.length > 500 || pages.some((p) => p.incomplete),
                })
            } catch (error) {
                await ctx.runMutation(mutation("finishScan"), {
                    ...claim,
                    error:
                        error instanceof LeagueError ? error.code : "network",
                    retryAfterMs:
                        error instanceof LeagueError
                            ? error.retryAfterMs
                            : undefined,
                })
            }
        }
        const status: {
            settings: Doc<"leagueTrackingSettings">[]
            index: Doc<"leagueIndexCache"> | null
        } = await ctx.runQuery(
            makeFunctionReference<"query">("leagueDiscoveryQueue:status"),
            {}
        )
        const index = status.index,
            fetchedAt = index?.fetchedAt
        if (index && fetchedAt) {
            for (const settings of status.settings) {
                if (!indexDueForWorkspace(settings, fetchedAt)) continue
                for (
                    let at = 0;
                    at < Math.max(index.matchUrls.length, 1);
                    at += 50
                ) {
                    await ctx.runMutation(mutation("enqueueIndex"), {
                        guildId: settings.guildId,
                        revision: settings.revision,
                        indexAt: index.fetchedAt,
                        urls: index.matchUrls.slice(at, at + 50),
                        fixtureUrls: index.fixtureUrls,
                        complete: at + 50 >= index.matchUrls.length,
                    })
                }
            }
        }
        // Claim immediately before each read so no worker holds a batch of expiring leases.
        for (let n = 0; n < 8; n++) {
            const job: {
                id: Id<"leagueTrackedMatches">
                fence: number
                settingsRevision: number
                guildId: string
                matchId: string
            } | null = await ctx.runMutation(mutation("claimDue"), {})
            if (!job) break
            let data: Served
            try {
                data = await ctx.runAction(
                    makeFunctionReference<"action">("leagueMatchData:read"),
                    {
                        secret: process.env.INTERNAL_AUTH_SECRET,
                        guildId: job.guildId,
                        sourceUrl: `https://wardogsleague.net/matches/${job.matchId}`,
                    }
                )
            } catch {
                data = {
                    kind: "data",
                    data: {
                        snapshot: null,
                        stale: true,
                        ageSeconds: null,
                        error: "network",
                        lastAttemptAt: new Date().toISOString(),
                        nextRefreshAt: new Date(
                            Date.now() + 60_000
                        ).toISOString(),
                    },
                }
            }
            if (data.kind === "data")
                await ctx.runMutation(mutation("finishRead"), {
                    id: job.id,
                    fence: job.fence,
                    settingsRevision: job.settingsRevision,
                    readJson: JSON.stringify(data.data),
                })
        }
    },
})
