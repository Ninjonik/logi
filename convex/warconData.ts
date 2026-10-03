"use node"
import {
    serveWarconRead,
    type WarconServed,
    type WarconPrepared,
} from "../src/application/game-data/read-warcon"
import { createProviderHttp } from "../src/infrastructure/game-data/provider-http"
import { warconQuerySchema } from "../src/domain/game-data/warcon-query"
import { readWarcon } from "../src/infrastructure/game-data/warcon"
import { makeFunctionReference } from "convex/server"
import { dashboardActor } from "./dashboardActor"
import { action } from "./_generated/server"
import { v } from "convex/values"

export const read = action({
    args: {
        secret: v.string(),
        guildId: v.string(),
        connectionId: v.string(),
        queryJson: v.string(),
        keyHash: v.optional(v.string()),
        actor: v.optional(dashboardActor),
        panelId: v.optional(v.id("discordPublicPanels")),
    },
    handler: async (ctx, args): Promise<WarconServed> => {
        if (
            !process.env.INTERNAL_AUTH_SECRET ||
            args.secret !== process.env.INTERNAL_AUTH_SECRET
        )
            throw new Error("Unauthorized.")
        if (args.queryJson.length > 1500)
            throw new Error("Invalid Warcon query.")
        const query = warconQuerySchema.parse(JSON.parse(args.queryJson))
        return serveWarconRead(args.connectionId, query, {
            now: Date.now,
            prepare: () =>
                ctx.runMutation(
                    makeFunctionReference<
                        "mutation",
                        typeof args,
                        WarconPrepared
                    >("warconReads:reserve"),
                    args
                ),
            read: (source, input) =>
                readWarcon(
                    source,
                    input,
                    createProviderHttp(source, {
                        resolveSecret: (ref) => process.env[ref],
                        now: Date.now,
                    }),
                    Date.now
                ),
            finish: (claim, value) =>
                ctx.runMutation(
                    makeFunctionReference<"mutation">("warconReads:finish"),
                    {
                        ...args,
                        ...claim,
                        ...(value.envelope
                            ? { envelopeJson: JSON.stringify(value.envelope) }
                            : {
                                  errorCategory: value.errorCategory,
                                  retryAfterMs: value.retryAfterMs,
                              }),
                    }
                ),
        })
    },
})
