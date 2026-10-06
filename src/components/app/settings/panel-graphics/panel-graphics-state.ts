import {
    PANEL_HEX_COLOR,
    resolvePanelBanner,
    resolvePanelMapImage,
    type BannerCrop,
    type PanelMapGame,
} from "@/domain/discord-publications/panel-graphics"
import {
    serverGraphics,
    type PanelGraphicsSettings,
} from "@/domain/discord-publications/panel-graphics-settings"
import type {
    PanelGraphicsFile,
    PanelGraphicsPageData,
} from "@/lib/panel-graphics-view"

/**
 * Derived state of the "Grafika panelů" page: which image a server's banner
 * card shows and what its chip says, using the same resolution rules as the
 * bot (`resolvePanelBanner`, `resolvePanelMapImage`).
 */

/** Images known to the page: the saved ones plus uploads of this visit. */
export type KnownFile = PanelGraphicsFile & { name?: string }
export type KnownFiles = Readonly<Record<string, KnownFile>>

export function knownFiles(
    data: PanelGraphicsPageData
): Record<string, KnownFile> {
    const files: Record<string, KnownFile> = {}
    for (const server of data.servers)
        if (server.banner)
            files[server.banner.assetId] = {
                ...server.banner,
                ...(server.banner.fileName
                    ? { name: server.banner.fileName }
                    : {}),
            }
    for (const map of data.maps)
        if (map.image) files[map.image.assetId] = map.image
    return files
}

export type BannerPreview =
    | { kind: "asset"; url: string; crop: BannerCrop }
    | { kind: "builtin"; path: string; crop: BannerCrop }
    | { kind: "override"; url: string; crop: BannerCrop }
    | null

/** The chip and image of one server's banner card. */
export function bannerCard(input: {
    connectionId: string
    gameId: PanelMapGame
    currentMapKey: string | null
    draft: PanelGraphicsSettings
    files: KnownFiles
}): { chip: "custom" | "map" | "none"; preview: BannerPreview } {
    const server = serverGraphics(input.draft, input.connectionId)
    const banner = server.bannerAssetId
        ? input.files[server.bannerAssetId]
        : undefined
    const overrides = input.draft.maps.flatMap((map) => {
        const file = input.files[map.assetId]
        return file
            ? [
                  {
                      game: map.game,
                      mapKey: map.mapKey,
                      publicId: "",
                      url: file.url,
                  },
              ]
            : []
    })
    const mapImage = resolvePanelMapImage({
        game: input.gameId,
        mapKey: input.currentMapKey,
        overrides,
    })
    const resolved = resolvePanelBanner({
        panelBannerUrl: null,
        server: {
            publicId: null,
            url: banner?.url ?? null,
            crop: server.crop,
            useMapImage: server.useMapImage,
        },
        mapImage,
    })
    if (server.bannerAssetId)
        return {
            chip: "custom",
            preview: banner
                ? { kind: "asset", url: banner.url, crop: server.crop }
                : null,
        }
    if (resolved?.kind === "map")
        return {
            chip: "map",
            preview:
                resolved.image.kind === "override"
                    ? {
                          kind: "override",
                          url: resolved.image.url,
                          crop: "center",
                      }
                    : {
                          kind: "builtin",
                          path: resolved.image.path,
                          crop: "center",
                      },
        }
    return { chip: server.useMapImage ? "map" : "none", preview: null }
}

/** `object-position` of a crop, as the renderer crops the banner. */
export function cropPosition(crop: BannerCrop) {
    return crop === "top"
        ? "center top"
        : crop === "bottom"
          ? "center bottom"
          : "center"
}

/** Fills `{name}` placeholders. */
export function fill(
    template: string,
    values: Record<string, string | number>
) {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in values ? String(values[key]) : match
    )
}

/** "380 kB" */
export function formatKilobytes(bytes: number, locale: string) {
    return `${new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0,
    }).format(Math.max(1, Math.round(bytes / 1024)))} kB`
}

/** A bar colour draft is valid when empty (clan colour) or `#RRGGBB`. */
export function isBarColorDraft(value: string) {
    const trimmed = value.trim()
    return trimmed === "" || PANEL_HEX_COLOR.test(trimmed)
}
