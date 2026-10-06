import type { StoredPanelGraphics } from "../src/domain/discord-publications/panel-graphics-settings"
import type { QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"

/**
 * The stored "Grafika panelů" row and its projection, read by the bot, the
 * `/api/v1` settings slice and `discordPanelGraphics.ts`. Kept apart from
 * that module so a settings read does not bundle its dashboard functions.
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
