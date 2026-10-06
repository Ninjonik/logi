"use node"

import { actionCredential } from "../src/infrastructure/game-data/credential-resolver"
import type { ResolvedSource } from "../src/domain/game-data/credentials"
import type { ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"

/**
 * The key for one claimed run, decrypted only while its generation is
 * current. Shared by the collector, the HLL live read and the Warcon read
 * actions; kept apart from `gameDataCollector.ts` so the two live reads do
 * not bundle every provider's parser (ARCHITECTURE.md, "Convex hot paths").
 */
export function runCredential(
    ctx: Pick<ActionCtx, "runQuery" | "runMutation">,
    source: ResolvedSource,
    run: { connectionId: string; generation: number }
) {
    return actionCredential(source, {
        loadEnvelope: () =>
            ctx.runQuery(internal.gameDataCredentials.envelope, run),
        reportFailure: (category) =>
            ctx.runMutation(internal.gameDataCredentials.reportFailure, {
                ...run,
                category,
            }),
    })
}
