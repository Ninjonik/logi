import {
    clanMetaFreshness,
    projectClanMetaCounts,
    tallyClanMeta,
} from "../src/domain/api/clan-meta"
import { mutation, type MutationCtx } from "./_generated/server"
import { allowsApiKeyRead } from "../src/domain/api/key-access"
import { withoutDrafts } from "../src/domain/events/drafts"
import { assertInternalSecret } from "./discord_shared"
import { getGuildByDiscordId } from "./identity"
import { v } from "convex/values"

/**
 * The summary behind `/api/v1/clan/meta`, in a module of its own so that
 * neither the per-request read (`publicApiReads:getClanMeta`) nor the
 * website's writes pay for this module's graph, and so that the scan below
 * runs only here: at most once per clan and `CLAN_META_INTERVAL_MS`, off
 * the request path (ARCHITECTURE.md, "Convex hot paths").
 */

/** The one scan: every per-clan table the counts cover, through its guild index. */
async function scanClanMeta(ctx: MutationCtx, guildId: string) {
    const events = withoutDrafts(
        await ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect()
    )
    const [
        groups,
        assignments,
        calendarItems,
        stratmaps,
        topicPresets,
        squadPresets,
        matches,
        articles,
        apiKeys,
        rosters,
    ] = await Promise.all([
        ctx.db
            .query("groups")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        ctx.db
            .query("userAssignments")
            .withIndex("serverId", (q) => q.eq("serverId", guildId))
            .collect(),
        ctx.db
            .query("calendarItems")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        ctx.db
            .query("stratmaps")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        ctx.db
            .query("topicPresets")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        ctx.db
            .query("squadPresets")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        ctx.db
            .query("matchStats")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        ctx.db
            .query("articles")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        ctx.db
            .query("apiKeys")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        // One row per published event; the first wins so that a duplicate
        // roster never fails the refresh.
        Promise.all(
            events.map((event) =>
                ctx.db
                    .query("rosters")
                    .withIndex("eventId", (q) => q.eq("eventId", event._id))
                    .first()
            )
        ),
    ])
    return tallyClanMeta({
        events: events.length,
        groups: groups.length,
        rosters: rosters.filter(Boolean).length,
        assignments,
        calendarItems: calendarItems.length,
        stratmaps: stratmaps.length,
        topicPresets: topicPresets.length,
        squadPresets: squadPresets.length,
        matches: matches.length,
        articles: articles.length,
        apiKeys: apiKeys.length,
    })
}

/**
 * Recomputes and stores the clan's summary for the key's clan. The gateway
 * calls it synchronously only for a clan without a summary and otherwise
 * off the request path, at most once per clan and interval per process;
 * the stored time is checked again here so concurrent calls write once.
 * Returns the summary the request should serve, or null for a key that
 * `getClanMeta` would reject.
 */
export const refreshClanMeta = mutation({
    args: { secret: v.string(), keyHash: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const key = await ctx.db
            .query("apiKeys")
            .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
            .unique()
        if (!key || key.revokedAt) return null
        if (!allowsApiKeyRead(key.readAccess, "meta")) return null
        const guild = await getGuildByDiscordId(ctx, key.guildId)
        if (!guild) return null
        const guildId = key.guildId
        const existing = await ctx.db
            .query("clanMetaSummaries")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .unique()
        const now = Date.now()
        if (existing && clanMetaFreshness(existing.computedAt, now) === "fresh")
            return {
                counts: projectClanMetaCounts(existing.tallies),
                computedAt: existing.computedAt,
            }
        const tallies = await scanClanMeta(ctx, guildId)
        const computedAt = new Date(now).toISOString()
        if (existing)
            await ctx.db.patch(existing._id, {
                tallies,
                computedAt,
                revision: existing.revision + 1,
            })
        else
            await ctx.db.insert("clanMetaSummaries", {
                guildId,
                tallies,
                computedAt,
                revision: 1,
            })
        return { counts: projectClanMetaCounts(tallies), computedAt }
    },
})
