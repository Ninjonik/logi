import {
    clanBadgeTag,
    panelEmojiMarkup,
    panelEmojiStatus,
    panelGraphicsForBot,
} from "../src/domain/discord-publications/panel-graphics-projection"
import {
    emojiReport,
    graphicsConnections,
    settingsOf,
    stored,
    storedOf,
} from "./discordPanelGraphicsStore"
import { DEFAULT_CLAN_ACCENT } from "../src/domain/discord-publications/panel-graphics"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { query, type QueryCtx } from "./_generated/server"
import { assertInternalSecret } from "./discord_shared"
import type { Doc, Id } from "./_generated/dataModel"
import { getGuildByDiscordId } from "./identity"
import { clanShortCode } from "./clanTeamStore"
import { v } from "convex/values"

/**
 * Clan-wide panel graphics ("Grafika panelů", P8): the dashboard read and
 * the bot projection. The dashboard read goes through the dashboard session
 * gateway and requires a workspace admin; the bot reads the projection with
 * the internal secret on every panel pass, so this module holds no Zod. The
 * writes (`update`, `reportEmoji`, `preparePanelGraphicsChange`) live in
 * `discordPanelGraphicsWrites.ts` (ARCHITECTURE.md, "Convex hot paths").
 */

type Db = Pick<QueryCtx, "db">
const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}

/** Markup of the installed panel signs for dashboard previews (P2-B09); public IDs only. */
export async function installedPanelEmoji(ctx: Db) {
    return panelEmojiMarkup(await emojiReport(ctx))
}

/** Dashboard view of "Grafika panelů". */
export const get = query({
    args: access,
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const [row, servers, report, config, guild] = await Promise.all([
            stored(ctx, args.guildId),
            graphicsConnections(ctx, args.guildId),
            emojiReport(ctx),
            ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .unique(),
            getGuildByDiscordId(ctx, args.guildId),
        ])
        const assets = new Map<string, Doc<"imageAssets">>()
        for (const id of [
            ...(row?.servers ?? []).flatMap((s) =>
                s.bannerAssetId ? [s.bannerAssetId] : []
            ),
            ...(row?.maps ?? []).map((m) => m.assetId),
        ]) {
            const asset = await ctx.db.get(id)
            if (asset) assets.set(String(id), asset)
        }
        const file = (id: Id<"imageAssets"> | null) => {
            const asset = id ? assets.get(String(id)) : undefined
            return asset
                ? {
                      assetId: String(asset._id),
                      url: asset.publicUrl,
                      width: asset.width,
                      height: asset.height,
                      bytes: asset.bytes,
                      // P8-08: "Nahráno vlci-public.png · 1200 × 400 · 380 kB".
                      fileName: asset.fileName ?? null,
                  }
                : null
        }
        return {
            revision: row?.revision ?? 0,
            settings: settingsOf(row),
            clanAccent:
                config?.messageStyle?.accentColor ?? DEFAULT_CLAN_ACCENT,
            clanName: guild?.name ?? null,
            clanTag: clanBadgeTag(
                guild?.name ?? "",
                await clanShortCode(ctx, args.guildId)
            ),
            servers: servers.map((server) => {
                const saved = row?.servers.find(
                    (s) => s.connectionId === server.id
                )
                return {
                    ...server,
                    banner: file(saved?.bannerAssetId ?? null),
                }
            }),
            maps: (row?.maps ?? []).map((map) => ({
                game: map.game,
                mapKey: map.mapKey,
                image: file(map.assetId),
            })),
            emoji: panelEmojiStatus(report),
        }
    },
})

/** Bot projection: default style, banners and map overrides with public URLs only. */
export const forBot = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return panelGraphicsForBot(storedOf(await stored(ctx, args.guildId)))
    },
})
