import { wakeWebhookGuild, scheduleWebhookDrain } from "./webhookQueue"
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

import { validateWebhookUrl } from "../src/domain/webhooks/url"

const secret = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"
const assertSecret = (value: string) => {
    if (value !== secret) throw new Error("Unauthorized.")
}

const eventTypes = v.array(v.string())
const now = () => new Date().toISOString()

export const list = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        return (
            await ctx.db
                .query("webhookSubscriptions")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect()
        ).map(({ secret: _secret, _id, ...hook }) => ({
            id: String(_id),
            ...hook,
        }))
    },
})

export const create = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        url: v.string(),
        eventTypes,
        signingSecret: v.string(),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const error = validateWebhookUrl(
            args.url,
            process.env.NODE_ENV === "production"
        )
        if (error) throw new Error(error)
        const createdAt = now()
        return await ctx.db.insert("webhookSubscriptions", {
            guildId: args.guildId,
            url: args.url,
            eventTypes: [...new Set(args.eventTypes)].slice(0, 20),
            secret: args.signingSecret,
            enabled: true,
            createdAt,
            updatedAt: createdAt,
        })
    },
})

export const update = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        webhookId: v.id("webhookSubscriptions"),
        url: v.optional(v.string()),
        eventTypes: v.optional(eventTypes),
        enabled: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const hook = await ctx.db.get(args.webhookId)
        if (!hook || hook.guildId !== args.guildId)
            throw new Error("Webhook not found.")
        if (args.url) {
            const error = validateWebhookUrl(
                args.url,
                process.env.NODE_ENV === "production"
            )
            if (error) throw new Error(error)
        }
        await ctx.db.patch(args.webhookId, {
            ...(args.url ? { url: args.url } : {}),
            ...(args.eventTypes
                ? { eventTypes: [...new Set(args.eventTypes)].slice(0, 20) }
                : {}),
            ...(args.enabled === undefined ? {} : { enabled: args.enabled }),
            updatedAt: now(),
        })
    },
})

/** Replaces a signing secret and returns it once to the trusted dashboard route. */
export const rotateSecret = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        webhookId: v.id("webhookSubscriptions"),
        signingSecret: v.string(),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const hook = await ctx.db.get(args.webhookId)
        if (!hook || hook.guildId !== args.guildId)
            throw new Error("Webhook not found.")
        await ctx.db.patch(args.webhookId, {
            secret: args.signingSecret,
            updatedAt: now(),
        })
    },
})

/** Dashboard history is tenant-scoped and intentionally never returns secrets. */
export const listDeliveries = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        webhookId: v.id("webhookSubscriptions"),
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const hook = await ctx.db.get(args.webhookId)
        if (!hook || hook.guildId !== args.guildId)
            throw new Error("Webhook not found.")
        const result = await ctx.db
            .query("webhookDeliveries")
            .withIndex("webhookId", (q) => q.eq("webhookId", hook._id))
            .paginate({ cursor: args.cursor, numItems: args.limit })
        return {
            data: result.page.map(({ _id, ...delivery }) => ({
                id: String(_id),
                ...delivery,
            })),
            nextCursor: result.isDone ? null : result.continueCursor,
        }
    },
})

export const remove = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        webhookId: v.id("webhookSubscriptions"),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const hook = await ctx.db.get(args.webhookId)
        if (!hook || hook.guildId !== args.guildId)
            throw new Error("Webhook not found.")
        await ctx.db.delete(args.webhookId)
    },
})

export const enqueueTest = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        webhookId: v.id("webhookSubscriptions"),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const hook = await ctx.db.get(args.webhookId)
        if (!hook || hook.guildId !== args.guildId)
            throw new Error("Webhook not found.")
        const createdAt = now()
        const id = await ctx.db.insert("webhookDeliveries", {
            webhookId: hook._id,
            guildId: args.guildId,
            eventType: "webhook.test",
            payload: JSON.stringify({
                id: crypto.randomUUID(),
                type: "webhook.test",
                createdAt,
                guildId: args.guildId,
                resource: { test: true },
            }),
            attempt: 0,
            status: "pending",
            nextAttemptAt: Date.now(),
            createdAt,
        })
        await wakeWebhookGuild(ctx, args.guildId)
        await scheduleWebhookDrain(ctx)
        return id
    },
})

export { claimDueDelivery, finishDelivery } from "./webhookQueue"
