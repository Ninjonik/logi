import { z } from "zod"

import {
    DEFAULT_SERVER_GRAPHICS,
    isDefaultServer,
    mapIdentity,
    PANEL_GRAPHICS_MAX_MAPS,
    PANEL_GRAPHICS_MAX_SERVERS,
    serverGraphics,
} from "./panel-graphics-projection"
import {
    BANNER_CROPS,
    PANEL_HEX_COLOR,
    panelMapDefinition,
    type PanelMapGame,
    type PanelStyle,
} from "./panel-graphics"
import { panelMapGameSchema, panelStyleSchema } from "./panel-graphics.schema"
import { PANEL_EMOJI } from "./panel-emblems"

/**
 * Clan-wide panel graphics (P8 "Grafika panelů"): the default style, one
 * banner per server and map image overrides. Asset IDs come from the client;
 * persistence verifies each one and stores its public URL itself.
 *
 * This file holds the Zod schemas and the patch builders that validate with
 * them; the pure projections live in `panel-graphics-projection.ts` and are
 * re-exported here for their existing importers.
 */
export {
    clanBadgeTag,
    DEFAULT_PANEL_GRAPHICS,
    DEFAULT_SERVER_GRAPHICS,
    filterPanelMapTiles,
    PANEL_GRAPHICS_MAX_MAPS,
    PANEL_GRAPHICS_MAX_SERVERS,
    panelEmojiMarkup,
    panelEmojiStatus,
    panelGraphicsChangeCount,
    panelGraphicsForBot,
    panelMapTiles,
    serverBannerFor,
    serverGraphics,
    type PanelEmojiStatus,
    type PanelGraphicsForBot,
    type PanelMapTile,
    type StoredPanelGraphics,
} from "./panel-graphics-projection"

const assetId = z.string().min(1).max(100)
const connectionId = z.string().min(1).max(100)
const hex = z
    .string()
    .regex(PANEL_HEX_COLOR)
    .transform((value) => value.toLowerCase())

export const panelGraphicsServerSchema = z.strictObject({
    connectionId,
    bannerAssetId: assetId.nullable(),
    crop: z.enum(BANNER_CROPS),
    useMapImage: z.boolean(),
    /** Style B bar colour; null uses the clan colour. */
    barColor: hex.nullable(),
})
export type PanelGraphicsServer = z.infer<typeof panelGraphicsServerSchema>

const mapRef = {
    game: panelMapGameSchema,
    mapKey: z.string().min(1).max(40),
}
const knownMap = (value: { game: PanelMapGame; mapKey: string }) =>
    panelMapDefinition(value.game, value.mapKey) !== null
export const panelGraphicsMapSchema = z
    .strictObject({ ...mapRef, assetId })
    .refine(knownMap, "Unknown map.")
export type PanelGraphicsMap = z.infer<typeof panelGraphicsMapSchema>

export const panelGraphicsSettingsSchema = z.strictObject({
    defaultStyle: panelStyleSchema,
    servers: z
        .array(panelGraphicsServerSchema)
        .max(PANEL_GRAPHICS_MAX_SERVERS)
        .refine(
            (rows) =>
                new Set(rows.map((row) => row.connectionId)).size ===
                rows.length,
            "Each server appears once."
        ),
    maps: z
        .array(panelGraphicsMapSchema)
        .max(PANEL_GRAPHICS_MAX_MAPS)
        .refine(
            (rows) => new Set(rows.map(mapIdentity)).size === rows.length,
            "Each map appears once."
        ),
})
export type PanelGraphicsSettings = z.infer<typeof panelGraphicsSettingsSchema>

/**
 * A partial change. Server fields left out keep their value; `assetId: null`
 * on a map restores Logi's built-in image; `reset` puts a server back to the
 * defaults (no banner, centre crop, map image on, clan colour).
 */
export const panelGraphicsPatchSchema = z
    .strictObject({
        defaultStyle: panelStyleSchema.optional(),
        servers: z
            .array(
                z.strictObject({
                    connectionId,
                    reset: z.literal(true).optional(),
                    bannerAssetId: assetId.nullable().optional(),
                    crop: z.enum(BANNER_CROPS).optional(),
                    useMapImage: z.boolean().optional(),
                    barColor: hex.nullable().optional(),
                })
            )
            .max(PANEL_GRAPHICS_MAX_SERVERS)
            .optional(),
        maps: z
            .array(
                z
                    .strictObject({ ...mapRef, assetId: assetId.nullable() })
                    .refine(knownMap, "Unknown map.")
            )
            .max(PANEL_GRAPHICS_MAX_MAPS)
            .optional(),
        /** Optimistic concurrency: the revision the client edited. */
        expectedRevision: z.number().int().min(0).optional(),
    })
    .refine(
        (patch) =>
            patch.defaultStyle !== undefined ||
            (patch.servers?.length ?? 0) > 0 ||
            (patch.maps?.length ?? 0) > 0,
        "Nothing to change."
    )
export type PanelGraphicsPatch = z.infer<typeof panelGraphicsPatchSchema>

/**
 * Applies a patch. Servers that end up at their defaults and restored maps
 * are dropped, so the stored document stays small and "no change" is equal.
 */
export function applyPanelGraphicsPatch(
    current: PanelGraphicsSettings,
    patch: PanelGraphicsPatch
): PanelGraphicsSettings {
    const servers = new Map(
        current.servers.map((server) => [server.connectionId, server])
    )
    for (const change of patch.servers ?? []) {
        const base: PanelGraphicsServer = change.reset
            ? { connectionId: change.connectionId, ...DEFAULT_SERVER_GRAPHICS }
            : serverGraphics(current, change.connectionId)
        const next: PanelGraphicsServer = {
            connectionId: change.connectionId,
            bannerAssetId:
                change.bannerAssetId !== undefined
                    ? change.bannerAssetId
                    : base.bannerAssetId,
            crop: change.crop ?? base.crop,
            useMapImage: change.useMapImage ?? base.useMapImage,
            barColor:
                change.barColor !== undefined ? change.barColor : base.barColor,
        }
        if (isDefaultServer(next)) servers.delete(change.connectionId)
        else servers.set(change.connectionId, next)
    }
    const maps = new Map(current.maps.map((map) => [mapIdentity(map), map]))
    for (const change of patch.maps ?? []) {
        const key = mapIdentity(change)
        if (change.assetId === null) maps.delete(key)
        else
            maps.set(key, {
                game: change.game,
                mapKey: change.mapKey,
                assetId: change.assetId,
            })
    }
    return panelGraphicsSettingsSchema.parse({
        defaultStyle: patch.defaultStyle ?? current.defaultStyle,
        servers: [...servers.values()],
        maps: [...maps.values()],
    })
}
/**
 * The smallest patch that turns `saved` into `draft` (the "Uložit" button),
 * or null when nothing changed. `revision` guards against a concurrent save.
 */
export function panelGraphicsPatchFrom(
    saved: PanelGraphicsSettings,
    draft: PanelGraphicsSettings,
    revision?: number
): PanelGraphicsPatch | null {
    const patch: {
        defaultStyle?: PanelStyle
        servers: Array<
            Partial<Omit<PanelGraphicsServer, "connectionId">> & {
                connectionId: string
            }
        >
        maps: Array<{
            game: PanelMapGame
            mapKey: string
            assetId: string | null
        }>
    } = { servers: [], maps: [] }
    if (saved.defaultStyle !== draft.defaultStyle)
        patch.defaultStyle = draft.defaultStyle
    const ids = new Set([
        ...saved.servers.map((s) => s.connectionId),
        ...draft.servers.map((s) => s.connectionId),
    ])
    for (const id of ids) {
        const before = serverGraphics(saved, id),
            after = serverGraphics(draft, id)
        const change: (typeof patch.servers)[number] = { connectionId: id }
        if (before.bannerAssetId !== after.bannerAssetId)
            change.bannerAssetId = after.bannerAssetId
        if (before.crop !== after.crop) change.crop = after.crop
        if (before.useMapImage !== after.useMapImage)
            change.useMapImage = after.useMapImage
        if (before.barColor !== after.barColor) change.barColor = after.barColor
        if (Object.keys(change).length > 1) patch.servers.push(change)
    }
    const before = new Map(saved.maps.map((m) => [mapIdentity(m), m]))
    const after = new Map(draft.maps.map((m) => [mapIdentity(m), m]))
    for (const key of new Set([...before.keys(), ...after.keys()])) {
        const was = before.get(key),
            now = after.get(key)
        if (was?.assetId === now?.assetId) continue
        const map = (now ?? was)!
        patch.maps.push({
            game: map.game,
            mapKey: map.mapKey,
            assetId: now?.assetId ?? null,
        })
    }
    if (
        patch.defaultStyle === undefined &&
        !patch.servers.length &&
        !patch.maps.length
    )
        return null
    return panelGraphicsPatchSchema.parse({
        ...(patch.defaultStyle ? { defaultStyle: patch.defaultStyle } : {}),
        ...(patch.servers.length ? { servers: patch.servers } : {}),
        ...(patch.maps.length ? { maps: patch.maps } : {}),
        ...(revision !== undefined ? { expectedRevision: revision } : {}),
    })
}

/** What the bot reported after provisioning application emoji. */
export const panelEmojiReportSchema = z.strictObject({
    applicationId: z.string().regex(/^\d{17,20}$/),
    ready: z.array(z.string().max(32)).max(PANEL_EMOJI.length),
    failed: z.array(z.string().max(32)).max(PANEL_EMOJI.length),
    checkedAt: z.number().int().min(0),
    /**
     * The installed emoji themselves (public IDs and names), so dashboard
     * previews show them as Discord does (P2-B09). Absent from older bots.
     */
    installed: z
        .array(
            z.strictObject({
                key: z.string().max(32),
                id: z.string().regex(/^\d{17,20}$/),
                name: z.string().regex(/^[A-Za-z0-9_]{2,32}$/),
            })
        )
        .max(PANEL_EMOJI.length)
        .optional(),
})
export type PanelEmojiReport = z.infer<typeof panelEmojiReportSchema>
