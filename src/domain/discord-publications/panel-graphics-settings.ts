import { z } from "zod"

import {
    BANNER_CROPS,
    DEFAULT_PANEL_STYLE,
    PANEL_HEX_COLOR,
    PANEL_MAPS,
    panelMapDefinition,
    panelMapGameSchema,
    panelStyleSchema,
    type MapImageOverride,
    type PanelMapGame,
    type PanelStyle,
    type ServerBannerSettings,
} from "./panel-graphics"
import {
    PANEL_EMOJI,
    PANEL_EMOJI_GROUP_SIZE,
    type PanelEmojiGroup,
} from "./panel-emblems"

/**
 * Clan-wide panel graphics (P8 "Grafika panelů"): the default style, one
 * banner per server and map image overrides. Asset IDs come from the client;
 * persistence verifies each one and stores its public URL itself.
 */

export const PANEL_GRAPHICS_MAX_SERVERS = 25
export const PANEL_GRAPHICS_MAX_MAPS = 64
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
export const DEFAULT_SERVER_GRAPHICS: Omit<
    PanelGraphicsServer,
    "connectionId"
> = { bannerAssetId: null, crop: "center", useMapImage: true, barColor: null }

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

const mapIdentity = (value: { game: string; mapKey: string }) =>
    `${value.game}:${value.mapKey}`
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
export const DEFAULT_PANEL_GRAPHICS: PanelGraphicsSettings = {
    defaultStyle: DEFAULT_PANEL_STYLE,
    servers: [],
    maps: [],
}

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

function isDefaultServer(server: PanelGraphicsServer) {
    return (
        server.bannerAssetId === DEFAULT_SERVER_GRAPHICS.bannerAssetId &&
        server.crop === DEFAULT_SERVER_GRAPHICS.crop &&
        server.useMapImage === DEFAULT_SERVER_GRAPHICS.useMapImage &&
        server.barColor === DEFAULT_SERVER_GRAPHICS.barColor
    )
}
/** Settings for one server, defaulted. */
export function serverGraphics(
    settings: Pick<PanelGraphicsSettings, "servers">,
    id: string
): PanelGraphicsServer {
    return (
        settings.servers.find((server) => server.connectionId === id) ?? {
            connectionId: id,
            ...DEFAULT_SERVER_GRAPHICS,
        }
    )
}
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
/** Number of fields a patch changes, for the "N neuložené změny" save bar. */
export function panelGraphicsChangeCount(
    current: PanelGraphicsSettings,
    next: PanelGraphicsSettings
): number {
    let changes = current.defaultStyle === next.defaultStyle ? 0 : 1
    const ids = new Set([
        ...current.servers.map((s) => s.connectionId),
        ...next.servers.map((s) => s.connectionId),
    ])
    for (const id of ids) {
        const a = serverGraphics(current, id),
            b = serverGraphics(next, id)
        for (const field of [
            "bannerAssetId",
            "crop",
            "useMapImage",
            "barColor",
        ] as const)
            if (a[field] !== b[field]) changes++
    }
    const before = new Map(current.maps.map((m) => [mapIdentity(m), m.assetId]))
    const after = new Map(next.maps.map((m) => [mapIdentity(m), m.assetId]))
    for (const key of new Set([...before.keys(), ...after.keys()]))
        if (before.get(key) !== after.get(key)) changes++
    return changes
}

/** Stored form: every asset reference carries the URL persistence verified. */
export type StoredPanelGraphics = {
    defaultStyle: PanelStyle
    servers: Array<
        PanelGraphicsServer & {
            bannerPublicId: string | null
            bannerUrl: string | null
        }
    >
    maps: Array<PanelGraphicsMap & { publicId: string; url: string }>
    revision: number
}
export type PanelGraphicsForBot = {
    defaultStyle: PanelStyle
    revision: number
    servers: Array<{
        connectionId: string
        banner: ServerBannerSettings
        barColor: string | null
    }>
    mapOverrides: MapImageOverride[]
}
/** Bot projection: references and public URLs only, never storage IDs. */
export function panelGraphicsForBot(
    stored: StoredPanelGraphics | null
): PanelGraphicsForBot {
    return {
        defaultStyle: stored?.defaultStyle ?? DEFAULT_PANEL_STYLE,
        revision: stored?.revision ?? 0,
        servers: (stored?.servers ?? []).map((server) => ({
            connectionId: server.connectionId,
            banner: {
                publicId: server.bannerPublicId,
                url: server.bannerUrl,
                crop: server.crop,
                useMapImage: server.useMapImage,
            },
            barColor: server.barColor,
        })),
        mapOverrides: (stored?.maps ?? []).map((map) => ({
            game: map.game,
            mapKey: map.mapKey,
            publicId: map.publicId,
            url: map.url,
        })),
    }
}
/** Banner settings the bot applies to one server; defaults when the clan set none. */
export function serverBannerFor(
    graphics: PanelGraphicsForBot,
    connectionId: string
): { banner: ServerBannerSettings; barColor: string | null } {
    const found = graphics.servers.find((s) => s.connectionId === connectionId)
    return found
        ? { banner: found.banner, barColor: found.barColor }
        : {
              banner: {
                  publicId: null,
                  url: null,
                  crop: DEFAULT_SERVER_GRAPHICS.crop,
                  useMapImage: DEFAULT_SERVER_GRAPHICS.useMapImage,
              },
              barColor: null,
          }
}

export type PanelMapTile = {
    game: PanelMapGame
    key: string
    name: string
    status: "custom" | "builtin" | "none"
    /** Image to show: the override URL, the built-in path, or null. */
    image: string | null
    builtIn: string | null
}
/** "Obrázky map" tiles: every catalogue map with its current image (P8-16..18). */
export function panelMapTiles(
    overrides: readonly { game: PanelMapGame; mapKey: string; url: string }[]
): PanelMapTile[] {
    return PANEL_MAPS.map((map) => {
        const override = overrides.find(
            (o) => o.game === map.game && o.mapKey === map.key
        )
        return {
            game: map.game,
            key: map.key,
            name: map.name,
            status: override ? "custom" : map.builtIn ? "builtin" : "none",
            image: override?.url ?? map.builtIn,
            builtIn: map.builtIn,
        }
    })
}
/** Search by name (accents ignored) and filter by game (P8-15). */
export function filterPanelMapTiles(
    tiles: readonly PanelMapTile[],
    filter: { query?: string; game?: PanelMapGame | "all" }
): PanelMapTile[] {
    const fold = (value: string) =>
        value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase()
    const query = fold(filter.query?.trim() ?? "")
    return tiles.filter(
        (tile) =>
            (!filter.game ||
                filter.game === "all" ||
                tile.game === filter.game) &&
            (!query || fold(tile.name).includes(query))
    )
}

/** What the bot reported after provisioning application emoji. */
export const panelEmojiReportSchema = z.strictObject({
    applicationId: z.string().regex(/^\d{17,20}$/),
    ready: z.array(z.string().max(32)).max(PANEL_EMOJI.length),
    failed: z.array(z.string().max(32)).max(PANEL_EMOJI.length),
    checkedAt: z.number().int().min(0),
})
export type PanelEmojiReport = z.infer<typeof panelEmojiReportSchema>
export type PanelEmojiStatus = Record<
    PanelEmojiGroup,
    { ready: number; total: number; complete: boolean }
> & { checkedAt: number | null }
/** "Nahráno do Discordu ✓ · 12 emoji" per group (P8-20, P8-24, P8-B04). */
export function panelEmojiStatus(
    report: Pick<PanelEmojiReport, "ready" | "checkedAt"> | null
): PanelEmojiStatus {
    const ready = new Set(report?.ready ?? [])
    const group = (name: PanelEmojiGroup) => {
        const total = PANEL_EMOJI_GROUP_SIZE[name]
        const count = PANEL_EMOJI.filter(
            (emoji) => emoji.group === name && ready.has(emoji.key)
        ).length
        return { ready: count, total, complete: count === total }
    }
    return {
        faction: group("faction"),
        status: group("status"),
        checkedAt: report?.checkedAt ?? null,
    }
}
