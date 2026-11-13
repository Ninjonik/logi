import {
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import { queueEventDiscordDeletion } from "./eventDeletionQueue"
import { assertInternalSecret } from "./discord_shared"
import { v } from "convex/values"

const scope = {
    secret: v.string(),
    guildId: v.string(),
    eventId: v.string(),
    key: v.string(),
}
const ownership = {
    ...scope,
    id: v.id("discordEventResources"),
    fence: v.number(),
    resourceId: v.union(v.string(), v.null()),
}
async function eventFor(
    ctx: Pick<QueryCtx, "db">,
    args: { guildId: string; eventId: string; key: string }
) {
    const id = ctx.db.normalizeId("events", args.eventId)
    const event = id ? await ctx.db.get(id) : null
    if (
        !event ||
        event.guildId !== args.guildId ||
        event.isDraft ||
        event.sharedAccessRevoked ||
        !/^(signup-thread:[^:]+|scheduled-event|voice-category|voice-squad:.+)$/.test(
            args.key
        ) ||
        args.key.length > 200
    )
        throw new Error("Invalid event resource scope")
    return event
}
async function owned(
    ctx: MutationCtx,
    args: {
        id: string
        fence: number
        guildId: string
        eventId: string
        key: string
    }
) {
    const id = ctx.db.normalizeId("discordEventResources", args.id)
    const row = id ? await ctx.db.get(id) : null
    if (
        !row ||
        row.guildId !== args.guildId ||
        String(row.eventId) !== args.eventId ||
        row.key !== args.key ||
        row.fence !== args.fence ||
        row.leaseUntil <= Date.now()
    )
        throw new Error("Event resource lease expired")
    return row
}
export const claim = mutation({
    args: scope,
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const event = await eventFor(ctx, args)
        let row = await ctx.db
            .query("discordEventResources")
            .withIndex("eventId_key", (q) =>
                q.eq("eventId", event._id).eq("key", args.key)
            )
            .unique()
        const now = Date.now()
        if (row?.leaseUntil && row.leaseUntil > now)
            throw new Error("Event resource busy")
        if (row?.state === "rejected") return { rejected: true as const }
        if (row?.state === "started" || row?.state === "uncertain") {
            await ctx.db.patch(row._id, { state: "uncertain", leaseUntil: 0 })
            return { blocked: true as const }
        }
        if (
            row &&
            (row.retryAt > now || (row.attempts >= 5 && row.state !== "bound"))
        )
            throw new Error(
                "Event resource backoff or attempt budget exhausted"
            )
        if (!row) {
            const sync = await ctx.db
                .query("discordEventSyncs")
                .withIndex("eventId", (q) => q.eq("eventId", event._id))
                .unique()
            const legacy = Boolean(sync && sync.resourceProtocol !== 1)
            const id = await ctx.db.insert("discordEventResources", {
                eventId: event._id,
                guildId: args.guildId,
                key: args.key,
                resourceId: null,
                state: legacy ? "uncertain" : "ready",
                fence: 0,
                leaseUntil: 0,
                retryAt: 0,
                attempts: 0,
                updatedAt: now,
            })
            if (legacy) return { blocked: true as const }
            row = (await ctx.db.get(id))!
        }
        const fence = row.fence + 1
        await ctx.db.patch(row._id, {
            fence,
            leaseUntil: now + 120000,
            updatedAt: now,
        })
        return { id: String(row._id), fence, resourceId: row.resourceId }
    },
})
export const begin = mutation({
    args: ownership,
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const event = await eventFor(ctx, args)
        if (event.status === "concluded")
            throw new Error("Event concluded before resource creation")
        const row = await owned(ctx, args)
        if (!["ready", "bound"].includes(row.state))
            throw new Error("Resource create already started")
        // A confirmed missing/retired bound resource starts a fresh bounded budget.
        await ctx.db.patch(row._id, {
            state: "started",
            resourceId: null,
            attempts: row.state === "bound" ? 1 : row.attempts + 1,
            updatedAt: Date.now(),
        })
    },
})
export const finish = mutation({
    args: { ...ownership, resourceId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await owned(ctx, args)
        if (!["ready", "started", "bound"].includes(row.state))
            throw new Error("Invalid resource receipt")
        await ctx.db.patch(row._id, {
            state: "bound",
            resourceId: args.resourceId,
            leaseUntil: 0,
            retryAt: 0,
            updatedAt: Date.now(),
        })
        if (!(await ctx.db.get(row.eventId))) {
            await queueEventDiscordDeletion(ctx, String(row.eventId), {
                guildId: row.guildId,
                messages: [],
                roleIds: [],
                scheduledEventIds:
                    row.key === "scheduled-event" ? [args.resourceId] : [],
                channelIds:
                    row.key === "scheduled-event" ? [] : [args.resourceId],
            })
        } else {
            // The receipt and normal sync binding commit together, before the
            // outer event pass can fail or the event can be concluded/deleted.
            const sync = await ctx.db
                .query("discordEventSyncs")
                .withIndex("eventId", (q) => q.eq("eventId", row.eventId))
                .unique()
            if (sync && sync.guildId !== row.guildId)
                throw new Error("Invalid event sync scope")
            const binding =
                row.key === "scheduled-event"
                    ? { scheduledEventId: args.resourceId }
                    : row.key.startsWith("signup-thread:")
                      ? { signupThreadId: args.resourceId }
                      : {
                            squadVoiceChannelIds: [
                                ...new Set([
                                    ...(sync?.squadVoiceChannelIds ?? []),
                                    args.resourceId,
                                ]),
                            ],
                        }
            const now = new Date().toISOString()
            if (sync)
                await ctx.db.patch(sync._id, { ...binding, updatedAt: now })
            else
                await ctx.db.insert("discordEventSyncs", {
                    eventId: row.eventId,
                    guildId: row.guildId,
                    resourceProtocol: 1,
                    topicMessageIds: [],
                    ...binding,
                    createdAt: now,
                    updatedAt: now,
                })
        }
    },
})
export const fail = mutation({
    args: { ...ownership, rejected: v.boolean() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await owned(ctx, args)
        const uncertain = row.state === "started" && !args.rejected
        await ctx.db.patch(row._id, {
            state: uncertain
                ? "uncertain"
                : row.state === "started"
                  ? args.key === "voice-category"
                      ? "rejected"
                      : "ready"
                  : row.state,
            leaseUntil: 0,
            retryAt: Date.now() + Math.min(300000, 15000 * 2 ** row.attempts),
            updatedAt: Date.now(),
        })
    },
})
export const inspect = query({
    args: { secret: v.string(), guildId: v.string(), eventId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const id = ctx.db.normalizeId("events", args.eventId)
        const event = id ? await ctx.db.get(id) : null
        if (!event || event.guildId !== args.guildId)
            throw new Error("Invalid event scope")
        const rows = await ctx.db
            .query("discordEventResources")
            .withIndex("eventId_key", (q) => q.eq("eventId", event._id))
            .take(201)
        if (rows.length > 200)
            throw new Error("Event resource count requires operator review")
        return rows
    },
})

/** Operator evidence only: never infer absence from a partial Discord listing. */
export const reconcile = mutation({
    args: {
        ...scope,
        action: v.union(v.literal("adopt"), v.literal("proven_absent")),
        discordId: v.optional(v.string()),
        operator: v.string(),
        evidence: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const event = await eventFor(ctx, args)
        if (
            !args.operator.trim() ||
            args.operator.length > 200 ||
            args.evidence.trim().length < 10 ||
            args.evidence.length > 2000 ||
            (args.action === "adopt" &&
                !/^\d{16,22}$/.test(args.discordId ?? ""))
        )
            throw new Error("Operator and resource evidence required")
        let row = await ctx.db
            .query("discordEventResources")
            .withIndex("eventId_key", (q) =>
                q.eq("eventId", event._id).eq("key", args.key)
            )
            .unique()
        if (row && row.leaseUntil > Date.now())
            throw new Error("Event resource busy")
        if (row?.state === "bound")
            throw new Error(
                "Resource already bound; verify the stored resource first"
            )
        if (row && row.attempts >= 5 && args.action === "proven_absent")
            throw new Error("Resource attempt budget exhausted")
        const patch = {
            state:
                args.action === "adopt"
                    ? ("bound" as const)
                    : ("ready" as const),
            resourceId: args.action === "adopt" ? args.discordId! : null,
            leaseUntil: 0,
            retryAt: 0,
            updatedAt: Date.now(),
            fence: (row?.fence ?? 0) + 1,
        }
        if (!row) {
            const id = await ctx.db.insert("discordEventResources", {
                ...patch,
                guildId: args.guildId,
                eventId: event._id,
                key: args.key,
                attempts: 0,
            })
            row = (await ctx.db.get(id))!
        } else await ctx.db.patch(row._id, patch)
        await ctx.db.insert("discordEventResourceAudits", {
            resourceId: row._id,
            operator: args.operator,
            evidence: args.evidence,
            action: args.action,
            ...(args.discordId ? { discordId: args.discordId } : {}),
            createdAt: Date.now(),
        })
        return { id: String(row._id), state: patch.state }
    },
})
export const audit = query({
    args: { ...scope, cursor: v.union(v.string(), v.null()) },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const event = await eventFor(ctx, args)
        const row = await ctx.db
            .query("discordEventResources")
            .withIndex("eventId_key", (q) =>
                q.eq("eventId", event._id).eq("key", args.key)
            )
            .unique()
        if (!row) throw new Error("Resource journal not found")
        return ctx.db
            .query("discordEventResourceAudits")
            .withIndex("resourceId", (q) => q.eq("resourceId", row._id))
            .paginate({ cursor: args.cursor, numItems: 50 })
    },
})
