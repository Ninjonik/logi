import { publicationState } from "./discordPublicationTable"
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
function authorize(secret: string) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
}
export const claim = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        key: v.string(),
        revision: v.number(),
        legacyChannelId: v.optional(v.string()),
        legacyMessageId: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        authorize(args.secret)
        if (args.key.length > 150 || !Number.isFinite(args.revision))
            throw new Error("Invalid publication.")
        if (args.key.startsWith("panel:")) {
            const id = ctx.db.normalizeId(
                "discordPublicPanels",
                args.key.split(":")[1]
            )
            const panel = id ? await ctx.db.get(id) : null
            if (
                !panel ||
                panel.guildId !== args.guildId ||
                panel.revision !== args.revision
            )
                return null
        }
        let row = await ctx.db
            .query("discordPublications")
            .withIndex("guild_key", (q) =>
                q.eq("guildId", args.guildId).eq("key", args.key)
            )
            .unique()
        const now = Date.now()
        if (
            row &&
            (row.leaseUntil > now ||
                row.retryAt > now ||
                row.revision > args.revision)
        )
            return null
        if (!row) {
            const id = await ctx.db.insert("discordPublications", {
                guildId: args.guildId,
                key: args.key,
                revision: args.revision,
                channelId: args.legacyMessageId
                    ? (args.legacyChannelId ?? null)
                    : null,
                messageId: args.legacyChannelId
                    ? (args.legacyMessageId ?? null)
                    : null,
                pending: null,
                hash: null,
                fence: 0,
                leaseUntil: 0,
                retryAt: 0,
                lastSuccessAt: null,
                error: null,
            })
            row = (await ctx.db.get(id))!
        }
        const fence = row.fence + 1
        await ctx.db.patch(row._id, {
            fence,
            leaseUntil: now + 120_000,
            revision: args.revision,
        })
        return {
            id: String(row._id),
            fence,
            channelId: row.channelId,
            messageId: row.messageId,
            pending: row.pending,
            hash: row.hash,
        }
    },
})
export const bindings = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        authorize(args.secret)
        return ctx.db
            .query("discordPublications")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .collect()
    },
})
export const save = mutation({
    args: {
        secret: v.string(),
        id: v.id("discordPublications"),
        fence: v.number(),
        ...publicationState,
    },
    handler: async (ctx, { secret, id, fence, ...state }) => {
        authorize(secret)
        const row = await ctx.db.get(id)
        if (!row || row.fence !== fence || row.leaseUntil <= Date.now())
            throw new Error("Publication lease expired.")
        await ctx.db.patch(id, state)
    },
})
export const finish = mutation({
    args: {
        secret: v.string(),
        id: v.id("discordPublications"),
        fence: v.number(),
        error: v.optional(v.string()),
        retryAfterMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        authorize(args.secret)
        const row = await ctx.db.get(args.id)
        if (!row || row.fence !== args.fence) return
        await ctx.db.patch(args.id, {
            leaseUntil: 0,
            error: args.error?.slice(0, 240) ?? null,
            retryAt: args.error
                ? Date.now() +
                  Math.max(
                      30_000,
                      Math.min(args.retryAfterMs ?? 60_000, 3_600_000)
                  )
                : 0,
            lastSuccessAt: args.error ? row.lastSuccessAt : Date.now(),
        })
    },
})
