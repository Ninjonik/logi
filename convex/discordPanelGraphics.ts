import {
    applyPanelGraphicsPatch,
    clanBadgeTag,
    DEFAULT_PANEL_GRAPHICS,
    panelEmojiReportSchema,
    panelEmojiStatus,
    panelGraphicsForBot,
    panelGraphicsPatchSchema,
    panelGraphicsSettingsSchema,
    type PanelGraphicsPatch,
    type PanelGraphicsSettings,
    type StoredPanelGraphics,
} from "../src/domain/discord-publications/panel-graphics-settings"
import {
    DEFAULT_CLAN_ACCENT,
    panelMapDefinition,
    panelMapKey,
} from "../src/domain/discord-publications/panel-graphics"
import {
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { attachableAsset, syncAssetReferences } from "./imageAssets"
import { projectSnapshot } from "../src/domain/game-data/policy"
import { assertInternalSecret } from "./discord_shared"
import type { Doc, Id } from "./_generated/dataModel"
import { getGuildByDiscordId } from "./identity"
import { clanShortCode } from "./clanTeams"
import { v } from "convex/values"

/**
 * Clan-wide panel graphics ("Grafika panelů", P8). Dashboard reads and
 * writes go through the dashboard session gateway and require a workspace
 * admin; the bot reads the projection and reports emoji with the internal
 * secret. Banners and map images must be this workspace's own uploads.
 */

type Db = Pick<QueryCtx, "db">
const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}

async function stored(ctx: Db, guildId: string) {
    return await ctx.db
        .query("discordPanelGraphics")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
}
function settingsOf(
    row: Doc<"discordPanelGraphics"> | null
): PanelGraphicsSettings {
    return row
        ? {
              defaultStyle: row.defaultStyle,
              servers: row.servers.map((server) => ({
                  connectionId: server.connectionId,
                  bannerAssetId: server.bannerAssetId
                      ? String(server.bannerAssetId)
                      : null,
                  crop: server.crop,
                  useMapImage: server.useMapImage,
                  barColor: server.barColor,
              })),
              maps: row.maps.map((map) => ({
                  game: map.game,
                  mapKey: map.mapKey,
                  assetId: String(map.assetId),
              })),
          }
        : DEFAULT_PANEL_GRAPHICS
}
function storedOf(
    row: Doc<"discordPanelGraphics"> | null
): StoredPanelGraphics | null {
    return row
        ? {
              defaultStyle: row.defaultStyle,
              revision: row.revision,
              servers: row.servers.map((server) => ({
                  connectionId: server.connectionId,
                  bannerAssetId: server.bannerAssetId
                      ? String(server.bannerAssetId)
                      : null,
                  bannerPublicId: server.bannerPublicId,
                  bannerUrl: server.bannerUrl,
                  crop: server.crop,
                  useMapImage: server.useMapImage,
                  barColor: server.barColor,
              })),
              maps: row.maps.map((map) => ({
                  game: map.game,
                  mapKey: map.mapKey,
                  assetId: String(map.assetId),
                  publicId: map.publicId,
                  url: map.url,
              })),
          }
        : null
}
async function emojiReport(ctx: Db) {
    return await ctx.db
        .query("discordApplicationEmoji")
        .withIndex("key", (q) => q.eq("key", "global"))
        .unique()
}
async function connections(ctx: Db, guildId: string) {
    const rows = await ctx.db
        .query("gameDataConnections")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .take(50)
    const now = Date.now()
    return rows.map((row) => {
        const snapshot = projectSnapshot({ ...row, id: String(row._id) }, now)
        const key = panelMapKey(row.gameId, snapshot.map)
        return {
            id: String(row._id),
            gameId: row.gameId,
            // Only the observed display name; no provider IDs, URLs or credentials.
            name: snapshot.displayName ?? null,
            // The map the server reports now; its image stands in for a missing banner.
            currentMap: key
                ? {
                      key,
                      name: panelMapDefinition(row.gameId, key)?.name ?? key,
                  }
                : null,
        }
    })
}

/** The stored graphics of a workspace, as the bot and the API read them. */
export async function readStoredPanelGraphics(ctx: Db, guildId: string) {
    return storedOf(await stored(ctx, guildId))
}

/** Dashboard view of "Grafika panelů". */
export const get = query({
    args: access,
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const [row, servers, report, config, guild] = await Promise.all([
            stored(ctx, args.guildId),
            connections(ctx, args.guildId),
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

type UpdateResult =
    | { ok: true; revision: number }
    | {
          error: "conflict" | "asset_unavailable" | "unknown_server"
      }

async function verifiedAsset(
    ctx: MutationCtx,
    guildId: string,
    assetId: string,
    kind: "panel-banner" | "panel-map"
) {
    return await attachableAsset(ctx, { assetId, guildId, kind })
}

export type PanelGraphicsChange =
    | { ok: true; commit(updatedBy: string): Promise<number> }
    | { error: "conflict" | "asset_unavailable" | "unknown_server" }

/**
 * Validates a partial change against the stored settings, this workspace's
 * game servers and its own uploads, without writing. `commit` then stores it
 * and keeps the asset references in step. Used by the dashboard and by
 * `/api/v1` clan settings, so both apply exactly the same rules.
 */
export async function preparePanelGraphicsChange(
    ctx: MutationCtx,
    guildId: string,
    patch: PanelGraphicsPatch
): Promise<PanelGraphicsChange> {
    const row = await stored(ctx, guildId)
    const revision = row?.revision ?? 0
    if (
        patch.expectedRevision !== undefined &&
        patch.expectedRevision !== revision
    )
        return { error: "conflict" }
    const next = applyPanelGraphicsPatch(settingsOf(row), patch)
    const known = new Set((await connections(ctx, guildId)).map((c) => c.id))
    if ((patch.servers ?? []).some((server) => !known.has(server.connectionId)))
        return { error: "unknown_server" }
    const servers: Doc<"discordPanelGraphics">["servers"] = []
    // A removed game server's banner settings are dropped with this save.
    for (const server of next.servers.filter((s) =>
        known.has(s.connectionId)
    )) {
        const asset = server.bannerAssetId
            ? await verifiedAsset(
                  ctx,
                  guildId,
                  server.bannerAssetId,
                  "panel-banner"
              )
            : null
        if (server.bannerAssetId && !asset)
            return { error: "asset_unavailable" }
        servers.push({
            connectionId: server.connectionId,
            bannerAssetId: asset?._id ?? null,
            bannerPublicId: asset?.publicId ?? null,
            bannerUrl: asset?.publicUrl ?? null,
            crop: server.crop,
            useMapImage: server.useMapImage,
            barColor: server.barColor,
        })
    }
    const maps: Doc<"discordPanelGraphics">["maps"] = []
    for (const map of next.maps) {
        const asset = await verifiedAsset(
            ctx,
            guildId,
            map.assetId,
            "panel-map"
        )
        if (!asset) return { error: "asset_unavailable" }
        maps.push({
            game: map.game,
            mapKey: map.mapKey,
            assetId: asset._id,
            publicId: asset.publicId,
            url: asset.publicUrl,
        })
    }
    // Defence in depth: the stored document always passes the domain schema.
    panelGraphicsSettingsSchema.parse(next)
    return {
        ok: true,
        commit: async (updatedBy) => {
            const value = {
                guildId,
                defaultStyle: next.defaultStyle,
                servers,
                maps,
                revision: revision + 1,
                updatedAt: Date.now(),
                updatedBy,
            }
            if (row) await ctx.db.patch(row._id, value)
            else await ctx.db.insert("discordPanelGraphics", value)
            // Referenced banners and map images survive the unattached-upload
            // sweep; removed ones are released in this same transaction.
            await syncAssetReferences(ctx, {
                guildId,
                owner: "panelGraphics",
                ownerId: guildId,
                assetIds: [
                    ...servers.flatMap((s) =>
                        s.bannerAssetId ? [s.bannerAssetId] : []
                    ),
                    ...maps.map((m) => m.assetId),
                ],
            })
            return value.revision
        },
    }
}

/** Applies a partial change after verifying every server and asset. */
export const update = mutation({
    args: { ...access, patch: v.any() },
    handler: async (ctx, args): Promise<UpdateResult> => {
        const admin = await authorizeDashboardAdmin(ctx, args)
        const patch = panelGraphicsPatchSchema.parse(args.patch)
        const change = await preparePanelGraphicsChange(
            ctx,
            args.guildId,
            patch
        )
        if (!("ok" in change)) return change
        return {
            ok: true,
            revision: await change.commit(admin.session.subject),
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

/** The bot reports which application emoji are installed (P8-20, P8-24). */
export const reportEmoji = mutation({
    args: { secret: v.string(), report: v.any() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const report = panelEmojiReportSchema.parse(args.report)
        const row = await emojiReport(ctx)
        const value = { key: "global" as const, ...report }
        if (row) await ctx.db.patch(row._id, value)
        else await ctx.db.insert("discordApplicationEmoji", value)
        return panelEmojiStatus(report)
    },
})
