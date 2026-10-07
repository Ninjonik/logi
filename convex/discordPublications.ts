import { publicationIsCurrent } from "../src/domain/discord-publications/publication-freshness"
import { publicationKeyRange } from "../src/domain/discord-publications/keys"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { publicationState } from "./discordPublicationTable"
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
        /**
         * The rendered hash and the target channel. With them a message that
         * Discord already shows, confirmed recently, is reported `current`
         * without a write (`publicationIsCurrent`); without them every claim
         * takes the lease, as older bots expect.
         */
        hash: v.optional(v.string()),
        channelId: v.optional(v.union(v.string(), v.null())),
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
        if (args.key.startsWith("league:")) {
            const id = ctx.db.normalizeId(
                    "leagueTrackedMatches",
                    args.key.slice(7)
                ),
                row = id ? await ctx.db.get(id) : null
            const settings = row
                ? await ctx.db
                      .query("leagueTrackingSettings")
                      .withIndex("guildId", (q) => q.eq("guildId", row.guildId))
                      .unique()
                : null
            if (
                !row ||
                !settings ||
                row.guildId !== args.guildId ||
                Math.max(settings.revision, row.revision) !== args.revision
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
        if (
            row &&
            args.hash !== undefined &&
            args.channelId !== undefined &&
            publicationIsCurrent(row, {
                revision: args.revision,
                channelId: args.channelId,
                hash: args.hash,
                now,
            })
        )
            return {
                id: String(row._id),
                fence: row.fence,
                channelId: row.channelId,
                messageId: row.messageId,
                pending: row.pending,
                hash: row.hash,
                current: true as const,
            }
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
/**
 * A guild's managed publications whose key starts with `prefix`, through a
 * range of the `guild_key` index; every one for an empty prefix. The table
 * grows for as long as the clan exists, so a reader on a timer passes the
 * narrowest prefix it needs (ARCHITECTURE.md, "Convex hot paths").
 */
export async function publicationsWithPrefix(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    prefix: string
) {
    const range = publicationKeyRange(prefix)
    return await ctx.db
        .query("discordPublications")
        .withIndex("guild_key", (q) =>
            range
                ? q
                      .eq("guildId", guildId)
                      .gte("key", range.start)
                      .lt("key", range.end)
                : q.eq("guildId", guildId)
        )
        .collect()
}

/** One managed publication of a guild by its exact key. */
export async function publicationByKey(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    key: string
) {
    return await ctx.db
        .query("discordPublications")
        .withIndex("guild_key", (q) => q.eq("guildId", guildId).eq("key", key))
        .unique()
}

/** The bot's view of a guild's bindings; `prefix` narrows them to one owner's keys. */
export const bindings = query({
    args: {
        secret: v.string(),
        guildId: v.string(),
        prefix: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        authorize(args.secret)
        if ((args.prefix?.length ?? 0) > 150)
            throw new Error("Invalid publication.")
        return await publicationsWithPrefix(
            ctx,
            args.guildId,
            args.prefix ?? ""
        )
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
/**
 * Releases the lease. A successful publish passes its final `state`, which
 * is stored in the same write under the same fence and lease check as
 * `save`, so a publish costs the claim and this one write; an error keeps
 * the stored state and records the wait before the next attempt.
 */
export const finish = mutation({
    args: {
        secret: v.string(),
        id: v.id("discordPublications"),
        fence: v.number(),
        error: v.optional(v.string()),
        retryAfterMs: v.optional(v.number()),
        state: v.optional(v.object(publicationState)),
    },
    handler: async (ctx, args) => {
        authorize(args.secret)
        const row = await ctx.db.get(args.id)
        if (!row || row.fence !== args.fence) return
        if (args.state && !args.error && row.leaseUntil <= Date.now())
            throw new Error("Publication lease expired.")
        await ctx.db.patch(args.id, {
            ...(args.state && !args.error ? args.state : {}),
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
