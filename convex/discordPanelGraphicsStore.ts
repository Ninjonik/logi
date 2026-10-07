import {
    DEFAULT_PANEL_GRAPHICS,
    type StoredPanelGraphics,
} from "../src/domain/discord-publications/panel-graphics-projection"
import {
    panelMapDefinition,
    panelMapKey,
} from "../src/domain/discord-publications/panel-graphics"
import type { PanelGraphicsSettings } from "../src/domain/discord-publications/panel-graphics-settings"
import { projectSnapshot } from "../src/domain/game-data/policy"
import type { QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"

/**
 * The stored "Grafika panelů" row and its projections, read by the bot, the
 * `/api/v1` settings slice, `discordPanelGraphics.ts` and
 * `discordPanelGraphicsWrites.ts`. Kept apart from those modules so a
 * settings read does not bundle their function definitions.
 */
type Db = Pick<QueryCtx, "db">
export async function stored(ctx: Db, guildId: string) {
    return await ctx.db
        .query("discordPanelGraphics")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
}

export function storedOf(
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

/** The stored graphics of a workspace, as the bot and the API read them. */
export async function readStoredPanelGraphics(ctx: Db, guildId: string) {
    return storedOf(await stored(ctx, guildId))
}

export function settingsOf(
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

export async function emojiReport(ctx: Db) {
    return await ctx.db
        .query("discordApplicationEmoji")
        .withIndex("key", (q) => q.eq("key", "global"))
        .unique()
}

/** The workspace's game servers with the map each reports now, for the banner editor. */
export async function graphicsConnections(ctx: Db, guildId: string) {
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
