import { readFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

import {
    PANEL_EMOJI,
    panelEmojiName,
    type PanelEmojiGroup,
    type PanelEmojiKey,
} from "../../../src/domain/discord-publications/panel-emblems"
import {
    panelMapDefinition,
    resolvePanelMapImage,
    type MapImageOverride,
} from "../../../src/domain/discord-publications/panel-graphics"
import { panelImageCopy } from "../../../src/domain/discord-publications/panel-image-copy"
import { artworkPath } from "./render"

const artworkCache = new Map<
    string,
    Promise<{ path: string; name: string; url: string } | null>
>()
export async function panelArtwork(game: string, map?: string | null) {
    const candidates = [
        ...new Set([artworkPath(game, map), artworkPath(game)]),
    ].filter((p): p is string => Boolean(p))
    for (const candidate of candidates) {
        let pending = artworkCache.get(candidate)
        if (!pending) {
            pending = (async () => {
                try {
                    // Only catalog paths enter here; never use a provider URL/path.
                    const location = new URL(
                        `../../../public${candidate}`,
                        import.meta.url
                    )
                    const bytes = await readFile(location)
                    if (bytes.byteLength > 8 * 1024 * 1024) return null
                    const hash = createHash("sha256")
                        .update(bytes)
                        .digest("hex")
                        .slice(0, 12)
                    const file = candidate.split("/").at(-1)!
                    const dot = file.lastIndexOf(".")
                    const name = `logi-panel-${file.slice(0, dot)}-${hash}${file.slice(dot)}`
                    return {
                        path: fileURLToPath(location),
                        name,
                        url: `attachment://${name}`,
                    }
                } catch {
                    return null
                }
            })()
            artworkCache.set(candidate, pending)
        }
        const result = await pending
        if (result) return result
    }
    return null
}

/** Discord's limit for one application emoji image. */
const EMOJI_MAX_BYTES = 256 * 1024
const EMOJI_SIZE = 128
const publicFile = (path: string) =>
    new URL(`../../../public${path}`, import.meta.url)
const digestOf = (value: string | Uint8Array) =>
    createHash("sha256").update(value).digest("hex").slice(0, 8)

export type PanelEmojiAsset = {
    key: PanelEmojiKey
    group: PanelEmojiGroup
    /** `logi_<key>_<digest>`; a redrawn sign gets a new name. */
    name: string
    /** Data URI Discord accepts for an application emoji upload. */
    image: string
}
let emojiAssets: Promise<PanelEmojiAsset[]> | null = null
/**
 * The fixed sign set as application emoji uploads: Logi's HLL emblems and the
 * status and gauge pieces are rasterized from their SVG to 128 × 128 PNG; the
 * Wardogs icons are the packaged MIT files, unchanged. Read once per process.
 */
export function applicationEmojiAssets(): Promise<PanelEmojiAsset[]> {
    emojiAssets ??= Promise.all(
        PANEL_EMOJI.map(async (emoji): Promise<PanelEmojiAsset> => {
            if (emoji.source.kind === "file") {
                const bytes = await readFile(publicFile(emoji.source.path))
                if (bytes.byteLength > EMOJI_MAX_BYTES)
                    throw new Error("Faction emoji exceeds Discord size limit.")
                return {
                    key: emoji.key,
                    group: emoji.group,
                    name: panelEmojiName(emoji.key, digestOf(bytes)),
                    image: `data:image/webp;base64,${bytes.toString("base64")}`,
                }
            }
            const png = await sharp(Buffer.from(emoji.source.svg))
                .resize(EMOJI_SIZE, EMOJI_SIZE)
                .png()
                .toBuffer()
            if (png.byteLength > EMOJI_MAX_BYTES)
                throw new Error("Panel emoji exceeds Discord size limit.")
            return {
                key: emoji.key,
                group: emoji.group,
                // The source drawing names the version, not the encoder output.
                name: panelEmojiName(emoji.key, digestOf(emoji.source.svg)),
                image: `data:image/png;base64,${png.toString("base64")}`,
            }
        })
    ).catch((error: unknown) => {
        emojiAssets = null
        throw error
    })
    return emojiAssets
}

/** The three Wardogs factions, as the panel and league workers have always read them. */
export async function factionAssets() {
    const assets = await applicationEmojiAssets()
    return (["valkyra", "manticore", "lonestar"] as const).map((faction) => {
        const asset = assets.find((a) => a.key === faction)!
        return { faction, name: asset.name, image: asset.image }
    })
}

export type PanelMapImage = {
    /** Versioned file name, e.g. `mapa-foy-thumb-3fa9c2.webp`. */
    name: string
    bytes: Buffer
    /** Alt text in the clan language, e.g. "Mapa Foy". */
    description: string
}
const MAP_LOOKS = {
    // A section thumbnail is shown at 80 px; 320 px keeps it sharp on HiDPI.
    thumb: { width: 320, height: 320 },
    // A banner fallback when the server has no banner (P7-25).
    banner: { width: 1200, height: 400 },
} as const
const mapImageCache = new Map<
    string,
    Promise<Omit<PanelMapImage, "description"> | null>
>()
/**
 * Logi's built-in art for a catalogue map, downscaled for Discord. The
 * packaged files are 3–9 MB (some above the old 8 MiB cap), so every panel
 * attaches a small derived copy instead (P7-30, P8-30).
 */
export async function builtInMapImage(
    game: string,
    mapKey: string | null | undefined,
    look: keyof typeof MAP_LOOKS,
    language?: string
): Promise<PanelMapImage | null> {
    const map = panelMapDefinition(game, mapKey)
    if (!map?.builtIn) return null
    const key = `${map.game}:${map.key}:${look}`
    let pending = mapImageCache.get(key)
    if (!pending) {
        pending = (async () => {
            try {
                const source = await readFile(publicFile(map.builtIn!))
                const size = MAP_LOOKS[look]
                const bytes = await sharp(source, {
                    limitInputPixels: 8192 * 8192,
                })
                    .resize(size.width, size.height, { fit: "cover" })
                    .webp({ quality: 80 })
                    .toBuffer()
                return {
                    name: `mapa-${map.key}-${look}-${digestOf(bytes).slice(0, 6)}.webp`,
                    bytes,
                }
            } catch {
                return null
            }
        })()
        mapImageCache.set(key, pending)
    }
    const image = await pending
    return image
        ? { ...image, description: panelImageCopy(language).alt.map(map.name) }
        : null
}

/** A clan's own image, read once per version; Discord gets a resized copy. */
const REMOTE_IMAGE_MAX_BYTES = 8 * 1024 * 1024
const remoteImageCache = new Map<
    string,
    Promise<Omit<PanelMapImage, "description"> | null>
>()
async function downloadImage(url: string): Promise<Buffer | null> {
    if (!/^https?:\/\//.test(url)) return null
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!response.ok) return null
    if (
        !/^image\/(png|jpeg|webp)\b/.test(
            response.headers.get("content-type") ?? ""
        )
    )
        return null
    const length = Number(response.headers.get("content-length"))
    if (Number.isFinite(length) && length > REMOTE_IMAGE_MAX_BYTES) return null
    const bytes = Buffer.from(await response.arrayBuffer())
    return bytes.byteLength > REMOTE_IMAGE_MAX_BYTES ? null : bytes
}
/**
 * A clan's uploaded image (a map image from P8 or a panel banner from P2) as
 * a file the message attaches, like Logi's own art (P8-30): resized for
 * Discord and named by its content, e.g. `mapa-foy-thumb-3fa9c2.webp`, so a
 * new upload is a new file name. The URL is the asset's public address that
 * Logi verified when it was saved; nothing else is fetched.
 */
export async function uploadedImageFile(input: {
    url: string
    look: keyof typeof MAP_LOOKS
    base: string
}): Promise<Omit<PanelMapImage, "description"> | null> {
    const key = `${input.url}:${input.look}`
    let pending = remoteImageCache.get(key)
    if (!pending) {
        if (remoteImageCache.size > 200) remoteImageCache.clear()
        pending = (async () => {
            try {
                const source = await downloadImage(input.url)
                if (!source) return null
                const size = MAP_LOOKS[input.look]
                const bytes = await sharp(source, {
                    limitInputPixels: 8192 * 8192,
                })
                    .resize(size.width, size.height, { fit: "cover" })
                    .webp({ quality: 80 })
                    .toBuffer()
                return {
                    name: `${input.base}-${digestOf(bytes).slice(0, 6)}.webp`,
                    bytes,
                }
            } catch {
                return null
            }
        })()
        remoteImageCache.set(key, pending)
        // A failed read is tried again on a later pass.
        void pending.then((value) => {
            if (!value) remoteImageCache.delete(key)
        })
    }
    return pending
}

/**
 * The map picture of a panel as a file (P7-B04, P8-30): the clan's own image
 * when it set one, else Logi's built-in art.
 */
export async function panelMapImage(
    game: string,
    mapKey: string | null | undefined,
    look: keyof typeof MAP_LOOKS,
    language: string,
    overrides: readonly MapImageOverride[]
): Promise<PanelMapImage | null> {
    const source = resolvePanelMapImage({
        game,
        mapKey: mapKey ?? null,
        overrides,
    })
    if (source?.kind === "override") {
        const file = await uploadedImageFile({
            url: source.url,
            look,
            base: `mapa-${source.mapKey}-${look}`,
        })
        const map = panelMapDefinition(game, source.mapKey)
        if (file)
            return {
                ...file,
                description: panelImageCopy(language).alt.map(
                    map?.name ?? source.mapKey
                ),
            }
    }
    return builtInMapImage(game, mapKey, look, language)
}
