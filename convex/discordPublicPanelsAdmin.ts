import { publicPanelSettingsSchema } from "../src/domain/discord-publications/settings.schema"
import type { PublicPanelSaveResult } from "../src/domain/discord-publications/settings"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { attachableAsset, syncAssetReferences } from "./imageAssetStore"
import { mutation, type MutationCtx } from "./_generated/server"
import { panelSettingsInput } from "./discordPublicationTable"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

/**
 * The legacy panel form's save (`configure`), validated with Zod. It lives
 * apart from `discordPublicPanels.ts`, whose `forGuild` the bot reads every
 * 15 s per clan (ARCHITECTURE.md, "Convex hot paths").
 */
/** A banner must be this workspace's live `panel-banner` upload; the URL is read from the asset. */
async function resolveBanner(
    ctx: MutationCtx,
    guildId: string,
    bannerAssetId: string | null
): Promise<
    | { id: Id<"imageAssets"> | null; url: string | null }
    | { error: "asset_unavailable" }
> {
    if (!bannerAssetId) return { id: null, url: null }
    const asset = await attachableAsset(ctx, {
        assetId: bannerAssetId,
        guildId,
        kind: "panel-banner",
    })
    return asset
        ? { id: asset._id, url: asset.publicUrl }
        : { error: "asset_unavailable" }
}
export const configure = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actor: dashboardActor,
        settings: v.object(panelSettingsInput),
        verifiedChannel: v.object({
            id: v.string(),
            guildId: v.string(),
            type: v.number(),
            canPublish: v.boolean(),
        }),
    },
    handler: async (ctx, args): Promise<PublicPanelSaveResult> => {
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
        const connectionId = ctx.db.normalizeId(
            "gameDataConnections",
            settings.connectionId
        )
        const connection = connectionId ? await ctx.db.get(connectionId) : null
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
        // P6-34: a second results panel of one game would post every result twice.
        if (
            settings.kind === "results" &&
            rows.some(
                (row) =>
                    row._id !== old?._id &&
                    row.kind === "results" &&
                    row.gameId === connection.gameId &&
                    !row.removing
            )
        )
            throw new Error("One results panel per game.")
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
        const banner = await resolveBanner(
            ctx,
            args.guildId,
            settings.presentation?.bannerAssetId ?? null
        )
        if ("error" in banner) return { error: banner.error }
        const now = Date.now()
        const value = {
            ...settings,
            // Saving without presentation clears a previous appearance together
            // with its banner reference, so stored URL and reference stay aligned.
            presentation: settings.presentation
                ? {
                      ...settings.presentation,
                      bannerAssetId: banner.id ? String(banner.id) : null,
                      bannerUrl: banner.url,
                  }
                : undefined,
            guildId: args.guildId,
            gameId: connection.gameId,
            revision: Math.max(now, (old?.revision ?? 0) + 1),
        }
        let panelId: Id<"discordPublicPanels">
        if (old) {
            await ctx.db.patch(old._id, value)
            panelId = old._id
        } else {
            if (rows.length >= 20) throw new Error("Panel limit reached.")
            panelId = await ctx.db.insert("discordPublicPanels", {
                ...value,
                createdAt: now,
            })
        }
        // ownerId is the panel document ID: one source/feature pair keeps the
        // same row across edits, so each save replaces exactly this panel's
        // references. A referenced banner survives the unattached-upload sweep;
        // clearing it (or saving without appearance) releases it in this transaction.
        await syncAssetReferences(ctx, {
            guildId: args.guildId,
            owner: "panel",
            ownerId: String(panelId),
            assetIds: banner.id ? [banner.id] : [],
        })
        return { ok: true, id: String(panelId) }
    },
})
