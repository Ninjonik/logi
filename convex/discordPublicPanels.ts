import { publicPanelSettingsSchema } from "../src/domain/discord-publications/settings"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { projectSnapshot } from "../src/domain/game-data/policy"
import { panelSettings } from "./discordPublicationTable"
import { mutation, query } from "./_generated/server"
import { catalogSources } from "./gameDataCatalog"
import { getGuildByDiscordId } from "./identity"
import { v } from "convex/values"

function secretGuard(secret: string) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
}
export const configure = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actor: dashboardActor,
        settings: v.object(panelSettings),
        verifiedChannel: v.object({
            id: v.string(),
            guildId: v.string(),
            type: v.number(),
            canPublish: v.boolean(),
        }),
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const settings = publicPanelSettingsSchema.parse(args.settings)
        const channel = args.verifiedChannel
        if (
            channel.id !== settings.channelId ||
            channel.guildId !== args.guildId ||
            ![0, 5].includes(channel.type) ||
            (settings.enabled && !channel.canPublish)
        )
            throw new Error("Channel cannot publish.")
        const id = ctx.db.normalizeId(
            "gameDataConnections",
            settings.connectionId
        )
        const connection = id ? await ctx.db.get(id) : null
        if (!connection || connection.guildId !== args.guildId)
            throw new Error("Source not found.")
        if (settings.reportCategoryId) {
            const config = await ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique()
            if (
                settings.kind === "results" ||
                !["hll_crcon", "wardogs_warcon"].includes(
                    connection.provider
                ) ||
                !config?.ticketSettings?.enabled ||
                !config.ticketSettings.ticketParentChannelId ||
                !config.ticketSettings.categories.some(
                    (c) => c.id === settings.reportCategoryId
                )
            )
                throw new Error(
                    "Configure a private ticket destination and category first."
                )
        }
        const rows = await ctx.db
            .query("discordPublicPanels")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .take(21)
        const old = rows.find(
            (row) =>
                row.connectionId === settings.connectionId &&
                row.kind === settings.kind
        )
        if (
            settings.enabled &&
            settings.kind !== "results" &&
            rows.some(
                (row) =>
                    row._id !== old?._id &&
                    row.enabled &&
                    row.kind !== "results" &&
                    row.connectionId === settings.connectionId &&
                    row.channelId === settings.channelId
            )
        )
            throw new Error(
                "Use a different channel for a separate scoreboard."
            )
        const now = Date.now()
        const value = {
            ...settings,
            guildId: args.guildId,
            gameId: connection.gameId,
            revision: Math.max(now, (old?.revision ?? 0) + 1),
        }
        if (old) {
            await ctx.db.patch(old._id, value)
            return String(old._id)
        }
        if (rows.length >= 20) throw new Error("Panel limit reached.")
        return String(
            await ctx.db.insert("discordPublicPanels", {
                ...value,
                createdAt: now,
            })
        )
    },
})
export const list = query({
    args: { secret: v.string(), guildId: v.string(), actor: dashboardActor },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const panels = await ctx.db
            .query("discordPublicPanels")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .take(20)
        const publications = await ctx.db
            .query("discordPublications")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .collect()
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()
        return {
            reportCategories: config?.ticketSettings?.enabled
                ? config.ticketSettings.categories.map((c) => ({
                      id: c.id,
                      label: c.label || c.id,
                      parentChannelId:
                          config.ticketSettings!.ticketParentChannelId ?? null,
                  }))
                : [],
            panels: panels.map((p) => ({
                ...p,
                publications: publications
                    .filter(
                        (b) =>
                            b.key === `panel:${p._id}` ||
                            b.key.startsWith(`panel:${p._id}:`)
                    )
                    .map((b) => ({
                        key: b.key,
                        channelId: b.channelId,
                        messageId: b.messageId,
                        lastSuccessAt: b.lastSuccessAt,
                        error: b.error,
                        pending: Boolean(b.pending),
                        retryAt: b.retryAt,
                    })),
            })),
        }
    },
})
/** Bot-only projection: no credentials, identity links or provider admin URLs. */
export const forGuild = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        secretGuard(args.secret)
        const panels = await ctx.db
            .query("discordPublicPanels")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .take(20)
        const sources = await catalogSources(ctx)
        return Promise.all(
            panels.map(async (panel) => {
                const id = ctx.db.normalizeId(
                    "gameDataConnections",
                    panel.connectionId
                )
                const connection = id ? await ctx.db.get(id) : null
                const configured =
                    connection &&
                    sources.some(
                        (s) =>
                            s.guildId === args.guildId &&
                            s.ref === connection.sourceRef &&
                            JSON.stringify(s) === connection.sourceFingerprint
                    )
                return {
                    ...panel,
                    snapshot:
                        connection &&
                        connection.guildId === args.guildId &&
                        connection.enabled &&
                        configured
                            ? projectSnapshot(
                                  { ...connection, id: String(connection._id) },
                                  Date.now()
                              )
                            : null,
                }
            })
        )
    },
})
export const resultsPage = query({
    args: {
        secret: v.string(),
        panelId: v.id("discordPublicPanels"),
        cursor: v.union(v.string(), v.null()),
    },
    handler: async (ctx, args) => {
        secretGuard(args.secret)
        const panel = await ctx.db.get(args.panelId)
        const guild = panel
            ? await getGuildByDiscordId(ctx, panel.guildId)
            : null
        if (!panel || panel.kind !== "results" || !guild) return null
        const page = await ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", String(guild._id)))
            .paginate({ cursor: args.cursor, numItems: 100 })
        return {
            cursor: page.isDone ? null : page.continueCursor,
            events: page.page
                .filter((e) => (e.gameId ?? "hell_let_loose") === panel.gameId)
                .map((e) => ({
                    id: String(e._id),
                    name: e.name,
                    map: e.map ?? null,
                    updatedAt: e.updatedAt ?? e.createdAt,
                    result:
                        e.reviewedResultGameId === panel.gameId &&
                        e.reviewedResult?.status !== "provisional"
                            ? (e.reviewedResult ?? null)
                            : null,
                })),
        }
    },
})
