import { configureSharedMatchLocal } from "../src/infrastructure/convex/configure-shared-match"
import { startIdempotentMutation } from "./apiIdempotency"
import { assertInternalSecret } from "./discord_shared"
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

export const configureLocal = mutation({
    args: {
        secret: v.string(),
        keyHash: v.string(),
        eventId: v.id("events"),
        idempotencyKey: v.string(),
        bodyHash: v.string(),
        methodPath: v.string(),
        settings: v.any(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const started = await startIdempotentMutation(ctx, args)
        if (started.kind === "unauthorized") return null
        if (started.kind === "complete") return started.result
        let status = 200
        let body: string
        try {
            const id = await configureSharedMatchLocal(
                ctx,
                started.key.guildId,
                args.eventId,
                args.settings
            )
            body = JSON.stringify({ data: { id, eventId: id } })
        } catch (error) {
            status = 400
            body = JSON.stringify({
                error: {
                    code: "validation_error",
                    message:
                        error instanceof Error
                            ? error.message
                            : "Invalid local settings.",
                },
            })
        }
        await ctx.db.patch(started.idempotencyId, {
            status,
            responseBody: body,
        })
        return { status, body }
    },
})
