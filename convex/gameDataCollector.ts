"use node"

import {
    warconProvider,
    readWarconSession,
    readWarconSessionPage,
} from "../src/infrastructure/game-data/warcon"
import {
    ProviderError,
    type ClaimedConnection,
    type GameDataProvider,
} from "../src/domain/game-data/contracts"
import {
    readHllSession,
    readHllSessionPage,
} from "../src/infrastructure/game-data/hll-sessions"
import { wardogsDirectoryProvider } from "../src/infrastructure/game-data/wardogs-public-directory"
import { createProviderHttp } from "../src/infrastructure/game-data/provider-http"
import { wardogsRconProvider } from "../src/infrastructure/game-data/wardogs-rcon"
import { collectSnapshot } from "../src/application/game-data/collect-snapshot"
import { collectSessions } from "../src/application/game-data/collect-sessions"
import { hllCrconProvider } from "../src/infrastructure/game-data/hll-crcon"
import { retryDelay } from "../src/domain/game-data/policy"
import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"

const providers: Record<ClaimedConnection["provider"], GameDataProvider> = {
    hll_crcon: hllCrconProvider,
    wardogs_rcon: wardogsRconProvider,
    wardogs_warcon: warconProvider,
    wardogs_public_directory: wardogsDirectoryProvider,
}

export const collectDue = internalAction({
    args: {},
    handler: async (ctx): Promise<{ processed: number }> => {
        const connection = await ctx.runMutation(
            internal.gameData.claimNext,
            {}
        )
        if (!connection) return { processed: 0 }
        const provider = providers[connection.provider] ?? {
            readSnapshot: async () => {
                throw new ProviderError("unsupported")
            },
        }
        await collectSnapshot(connection, {
            provider,
            http: createProviderHttp(connection, {
                resolveSecret: (ref) => process.env[ref],
                now: Date.now,
            }),
            now: Date.now,
            repository: {
                finish: async (result) =>
                    ctx.runMutation(internal.gameData.finishSnapshot, {
                        id: connection.id as import("./_generated/dataModel").Id<"gameDataConnections">,
                        generation: connection.generation,
                        fence: connection.fence,
                        result,
                    }),
            },
        })
        // A bounded action collects one source; the cron also recovers expired claims.
        await ctx.scheduler.runAfter(
            0,
            internal.gameDataCollector.collectDue,
            {}
        )
        return { processed: 1 }
    },
})

export const collectHistoryDue = internalAction({
    args: {},
    handler: async (ctx): Promise<{ processed: number }> => {
        const claim = await ctx.runMutation(
            internal.gameDataHistory.claimNext,
            {}
        )
        if (!claim) return { processed: 0 }
        const token = {
            runId: claim.runId,
            generation: claim.generation,
            fence: claim.fence,
        }
        const http = createProviderHttp(claim.connection, {
            resolveSecret: (ref) => process.env[ref],
            now: Date.now,
        })
        try {
            const readSession =
                claim.connection.provider === "wardogs_warcon"
                    ? readWarconSession
                    : readHllSession
            const readPage =
                claim.connection.provider === "wardogs_warcon"
                    ? readWarconSessionPage
                    : readHllSessionPage
            if (claim.revisitId) {
                const session = await readSession(
                    claim.connection,
                    claim.revisitId,
                    http
                )
                await ctx.runMutation(internal.gameDataHistory.commit, {
                    ...token,
                    result: {
                        session,
                        progress: claim.progress,
                        completed: false,
                        revisit: true,
                    },
                })
            } else {
                await collectSessions(claim.progress, {
                    readPage: (page) => readPage(claim.connection, page, http),
                    readSession: (id) =>
                        readSession(claim.connection, id, http),
                    commit: (result) =>
                        ctx.runMutation(internal.gameDataHistory.commit, {
                            ...token,
                            result,
                        }),
                })
            }
        } catch (error) {
            // Storage failures leave the lease/checkpoint intact for cron recovery.
            if (!(error instanceof ProviderError)) throw error
            const delay = retryDelay(
                error.category,
                claim.attempt,
                error.retryAfterMs
            )
            await ctx.runMutation(internal.gameDataHistory.fail, {
                ...token,
                errorCategory: error.category,
                nextAttemptAt: delay === null ? null : Date.now() + delay,
            })
        }
        await ctx.scheduler.runAfter(
            0,
            internal.gameDataCollector.collectHistoryDue,
            {}
        )
        return { processed: 1 }
    },
})
