import {
    DEFAULT_PANEL_STYLE,
    PANEL_MAPS,
    type MapImageOverride,
    type PanelMapGame,
    type PanelStyle,
    type ServerBannerSettings,
} from "./panel-graphics"
import type {
    PanelEmojiReport,
    PanelGraphicsMap,
    PanelGraphicsServer,
    PanelGraphicsSettings,
} from "./panel-graphics-settings"
import {
    PANEL_EMOJI,
    PANEL_EMOJI_GROUP_SIZE,
    type PanelEmojiGroup,
    type PanelEmojiKey,
} from "./panel-emblems"

/**
 * The pure side of "Grafika panelů" (P8): defaults, the bot projection, the
 * clan badge, map tiles and the emoji status. `panel-graphics-settings.ts`
 * keeps the Zod schemas and re-exports everything here, so the bot's reads
 * (`discordPanelGraphics:forBot`, `discordPanelBot:guildContext`) import this
 * file and never load Zod (ARCHITECTURE.md, "Convex hot paths").
 */
export const PANEL_GRAPHICS_MAX_SERVERS = 25
export const PANEL_GRAPHICS_MAX_MAPS = 64
export const DEFAULT_SERVER_GRAPHICS: Omit<
    PanelGraphicsServer,
    "connectionId"
> = { bannerAssetId: null, crop: "center", useMapImage: true, barColor: null }
export const DEFAULT_PANEL_GRAPHICS: PanelGraphicsSettings = {
    defaultStyle: DEFAULT_PANEL_STYLE,
    servers: [],
    maps: [],
}
export const mapIdentity = (value: { game: string; mapKey: string }) =>
    `${value.game}:${value.mapKey}`

export function isDefaultServer(server: PanelGraphicsServer) {
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

/**
 * The round clan badge on banners (P7-13, P7-18, P8-07): the clan's team
 * short code from the team catalogue ("VLK") when it has one, else initials
 * of the clan name ("Vlci" → "VLC", "Váš klan" → "VK"). The P8 page, the
 * panel editor and the bot all use this one rule, so the preview is what
 * Discord shows.
 */
export function clanBadgeTag(name: string, shortCode?: string | null): string {
    const code = Array.from(
        (shortCode ?? "")
            .normalize("NFKD")
            .replace(/\p{M}/gu, "")
            .toUpperCase()
            .replace(/[^\p{L}\p{N}]/gu, "")
    )
        .slice(0, 5)
        .join("")
    if (code) return code
    const words = name
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toUpperCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)
    const tag =
        words.length > 1
            ? words
                  .slice(0, 3)
                  .map((word) => Array.from(word)[0])
                  .join("")
            : Array.from(words[0] ?? "")
                  .slice(0, 3)
                  .join("")
    return tag || "LOGI"
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

/**
 * Discord markup (`<:name:id>`) of every installed panel sign the bot
 * reported, by key, for the previews (P2-B09). Unknown keys are left out;
 * an older report without IDs gives none, so previews use plain markers.
 */
export function panelEmojiMarkup(
    report: Pick<PanelEmojiReport, "installed"> | null
): Partial<Record<PanelEmojiKey, string>> {
    const keys = new Set<string>(PANEL_EMOJI.map((emoji) => emoji.key))
    const markup: Partial<Record<PanelEmojiKey, string>> = {}
    for (const emoji of report?.installed ?? [])
        if (
            keys.has(emoji.key) &&
            /^\d{17,20}$/.test(emoji.id) &&
            /^[A-Za-z0-9_]{2,32}$/.test(emoji.name)
        )
            markup[emoji.key as PanelEmojiKey] = `<:${emoji.name}:${emoji.id}>`
    return markup
}
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
