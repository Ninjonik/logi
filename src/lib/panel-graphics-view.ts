import { z } from "zod"

import {
    BANNER_CROPS,
    PANEL_STYLES,
    panelMapGameSchema,
} from "@/domain/discord-publications/panel-graphics"
import { panelMapTiles } from "@/domain/discord-publications/panel-graphics-settings"

/**
 * The data of the "Grafika panelů" page (P8): what `discordPanelGraphics:get`
 * answers, parsed so the server page, the route and the browser client see
 * one shape, plus every catalogue map as a tile.
 */

const file = z
    .object({
        assetId: z.string(),
        url: z.string(),
        width: z.number(),
        height: z.number(),
        bytes: z.number(),
    })
    .nullable()
const emojiGroup = z.object({
    ready: z.number().int().min(0),
    total: z.number().int().min(0),
    complete: z.boolean(),
})
export const panelGraphicsViewSchema = z.object({
    revision: z.number().int().min(0),
    settings: z.object({
        defaultStyle: z.enum(PANEL_STYLES),
        servers: z.array(
            z.object({
                connectionId: z.string(),
                bannerAssetId: z.string().nullable(),
                crop: z.enum(BANNER_CROPS),
                useMapImage: z.boolean(),
                barColor: z.string().nullable(),
            })
        ),
        maps: z.array(
            z.object({
                game: panelMapGameSchema,
                mapKey: z.string(),
                assetId: z.string(),
            })
        ),
    }),
    clanAccent: z.string(),
    clanName: z.string().nullable(),
    clanTag: z.string(),
    servers: z.array(
        z.object({
            id: z.string(),
            gameId: panelMapGameSchema,
            name: z.string().nullable(),
            currentMap: z
                .object({ key: z.string(), name: z.string() })
                .nullable(),
            banner: file,
        })
    ),
    maps: z.array(
        z.object({ game: panelMapGameSchema, mapKey: z.string(), image: file })
    ),
    emoji: z.object({
        faction: emojiGroup,
        status: emojiGroup,
        checkedAt: z.number().nullable(),
    }),
})
export type PanelGraphicsView = z.infer<typeof panelGraphicsViewSchema>

const tileSchema = z.object({
    game: panelMapGameSchema,
    key: z.string(),
    name: z.string(),
    status: z.enum(["custom", "builtin", "none"]),
    image: z.string().nullable(),
    builtIn: z.string().nullable(),
})
export const panelGraphicsPageDataSchema = panelGraphicsViewSchema.extend({
    mapTiles: z.array(tileSchema),
})
export type PanelGraphicsPageData = z.infer<typeof panelGraphicsPageDataSchema>
export type PanelGraphicsFile = NonNullable<
    PanelGraphicsView["servers"][number]["banner"]
>

/** Parses the Convex answer and adds the map tiles; throws on a wrong shape. */
export function toPanelGraphicsPageData(raw: unknown): PanelGraphicsPageData {
    const view = panelGraphicsViewSchema.parse(raw)
    return {
        ...view,
        mapTiles: panelMapTiles(
            view.maps.flatMap((map) =>
                map.image
                    ? [
                          {
                              game: map.game,
                              mapKey: map.mapKey,
                              url: map.image.url,
                          },
                      ]
                    : []
            )
        ),
    }
}
