import { z } from "zod"

import {
    panelGraphicsPatchSchema,
    type StoredPanelGraphics,
} from "../discord-publications/panel-graphics-settings"
import {
    BANNER_CROPS,
    PANEL_MAP_GAMES,
    PANEL_STYLES,
} from "../discord-publications/panel-graphics"

import { defineClanSettingsSlice } from "./settings-slices"

/**
 * `/api/v1` clan settings slice `panelGraphics` ("Grafika panelů", P8-B07):
 * the clan's default panel style, one banner per game server and the map
 * image overrides. Images are uploaded in the dashboard only (a deliberate
 * exclusion, see `configuration-coverage.md`); the API reads and sets
 * references to the clan's existing `panel-banner` and `panel-map` assets.
 */

const image = z.object({
    assetId: z.string(),
    url: z.string(),
})
export const panelGraphicsApiSchema = z.object({
    defaultStyle: z.enum(PANEL_STYLES),
    /** Pass as `expectedRevision` to refuse a concurrent change. */
    revision: z.number().int().min(0),
    servers: z.array(
        z.object({
            connectionId: z.string(),
            banner: image.nullable(),
            crop: z.enum(BANNER_CROPS),
            useMapImage: z.boolean(),
            /** Style B bar colour `#rrggbb`; null uses the clan colour. */
            barColor: z.string().nullable(),
        })
    ),
    maps: z.array(
        z.object({
            game: z.enum(PANEL_MAP_GAMES),
            mapKey: z.string(),
            image,
        })
    ),
})
export type PanelGraphicsApiView = z.infer<typeof panelGraphicsApiSchema>

const DEFAULT_VIEW: PanelGraphicsApiView = {
    defaultStyle: "a",
    revision: 0,
    servers: [],
    maps: [],
}

/** The stored settings as the API shows them: asset IDs and public URLs only. */
export function panelGraphicsApiView(
    stored: StoredPanelGraphics | null
): PanelGraphicsApiView {
    if (!stored) return DEFAULT_VIEW
    return {
        defaultStyle: stored.defaultStyle,
        revision: stored.revision,
        servers: stored.servers.map((server) => ({
            connectionId: server.connectionId,
            banner:
                server.bannerAssetId && server.bannerUrl
                    ? { assetId: server.bannerAssetId, url: server.bannerUrl }
                    : null,
            crop: server.crop,
            useMapImage: server.useMapImage,
            barColor: server.barColor,
        })),
        maps: stored.maps.map((map) => ({
            game: map.game,
            mapKey: map.mapKey,
            image: { assetId: map.assetId, url: map.url },
        })),
    }
}

/** Plain-language API errors of the slice's store. */
export const PANEL_GRAPHICS_API_ERRORS = {
    conflict: {
        status: 409,
        code: "conflict",
        message:
            "panelGraphics.expectedRevision: the panel graphics changed since that revision.",
    },
    asset_unavailable: {
        status: 400,
        code: "validation_error",
        message:
            "panelGraphics: an image asset is not an uploaded banner (panel-banner) or map image (panel-map) of this clan.",
    },
    unknown_server: {
        status: 400,
        code: "validation_error",
        message: "panelGraphics.servers: unknown game server connection.",
    },
} as const

export const panelGraphicsSettingsSlice = defineClanSettingsSlice({
    key: "panelGraphics",
    description:
        "Discord panel graphics: the default panel style (a = generated score image, b = server banner and map thumbnail, c = compact text), one banner per game server with crop, map-image fallback and style B bar colour, and map image overrides. Images are uploaded in the dashboard; the API references existing image assets by ID.",
    schema: panelGraphicsApiSchema,
    patchSchema: panelGraphicsPatchSchema,
    external: true,
    read: ({ external }) => {
        const parsed = panelGraphicsApiSchema.safeParse(external?.panelGraphics)
        return parsed.success ? parsed.data : DEFAULT_VIEW
    },
    // Stored in `discordPanelGraphics` by `convex/clanSettingsStores.ts`.
    toPatch: () => ({}),
})
