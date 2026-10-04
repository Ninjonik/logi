"use node"

import { internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

/** One bounded score batch per action; continuations are durable scheduler jobs. */
export const run = internalAction({
    args: { eventId: v.id("events") },
    handler: async (ctx, args) => {
        await ctx.runMutation(internal.eventScoreQueue.processBatch, {
            eventId: args.eventId,
        })
    },
})
