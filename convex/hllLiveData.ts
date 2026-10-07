"use node"
import {
    serveHllLive,
    type HllPrepared,
    type HllServed,
} from "../src/application/game-data/read-hll-live"
import { createProviderHttp } from "../src/infrastructure/game-data/provider-http"
import { readHllLive } from "../src/infrastructure/game-data/hll-live"
import { runCredential } from "./gameDataRunCredential"
import { makeFunctionReference } from "convex/server"
import { hllLiveAccess } from "./hllLiveReads"
import { action } from "./_generated/server"

export const read = action({
    args: hllLiveAccess,
    handler: async (ctx, args): Promise<HllServed> => {
        if (
            !process.env.INTERNAL_AUTH_SECRET ||
            args.secret !== process.env.INTERNAL_AUTH_SECRET
        )
            throw new Error("Unauthorized.")
        return serveHllLive(args.connectionId, {
            now: Date.now,
            prepare: () =>
                ctx.runMutation(
                    makeFunctionReference<"mutation", typeof args, HllPrepared>(
                        "hllLiveReads:reserve"
                    ),
                    args
                ),
            read: (source, previous, claim) =>
                readHllLive(
                    createProviderHttp(source, {
                        now: Date.now,
                        credential: runCredential(ctx, source, {
                            connectionId: args.connectionId,
                            generation: claim.generation,
                        }),
                    }),
                    Date.now,
                    previous
                ),
            finish: (claim, data) =>
                ctx.runMutation(
                    makeFunctionReference<"mutation">("hllLiveReads:finish"),
                    { ...args, ...claim, dataJson: JSON.stringify(data) }
                ),
        })
    },
})
