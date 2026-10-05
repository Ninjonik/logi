import { z } from "zod"

/** Who may own an uploaded image and what it is normalized into. */
export const IMAGE_ASSET_KINDS = [
    "team-logo",
    "panel-banner",
    /** A clan's own image for one map (P8 "Obrázky map"). */
    "panel-map",
] as const
export type ImageAssetKind = (typeof IMAGE_ASSET_KINDS)[number]
export const imageAssetKindSchema = z.enum(IMAGE_ASSET_KINDS)
export const IMAGE_INPUT_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
] as const
export type ImageInputType = (typeof IMAGE_INPUT_TYPES)[number]
export const IMAGE_MAX_INPUT_BYTES = 2 * 1024 * 1024
export const IMAGE_MAX_SOURCE_DIMENSION = 4096
/** Normalized output bounds per kind; the normalized image is the only published output. */
export const IMAGE_OUTPUT = {
    "team-logo": { width: 512, height: 512, format: "png" },
    "panel-banner": { width: 1920, height: 1080, format: "webp" },
    "panel-map": { width: 1200, height: 1200, format: "webp" },
} as const satisfies Record<
    ImageAssetKind,
    { width: number; height: number; format: "png" | "webp" }
>
/** Smallest accepted source per kind; a map image must be at least 160 × 160 (P8-19). */
export const IMAGE_MIN_SOURCE: Partial<
    Record<ImageAssetKind, { width: number; height: number }>
> = { "panel-map": { width: 160, height: 160 } }
export const IMAGE_OUTPUT_TYPES: Record<"png" | "webp", ImageInputType> = {
    png: "image/png",
    webp: "image/webp",
}
export const IMAGE_UPLOAD_LIMIT = {
    attempts: 10,
    windowMs: 10 * 60_000,
} as const
/** Unattached uploads survive this long before the sweep claims them. */
export const IMAGE_UNATTACHED_TTL_MS = 24 * 60 * 60_000
export const IMAGE_CLEANUP_BATCH = 50
export const imagePublicIdSchema = z.string().regex(/^[a-f0-9]{32}$/)
export const imageAssetStateSchema = z.enum(["ready", "deleting"])
export type ImageAssetState = z.infer<typeof imageAssetStateSchema>

export type ImageValidationError =
    | "unsupported_type"
    | "type_mismatch"
    | "too_large"
    | "bad_dimensions"
    | "animated"
    | "undecodable"

/** Magic-number detection; the declared content type is never trusted alone. */
export function sniffImageType(bytes: Uint8Array): ImageInputType | null {
    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
    )
        return "image/png"
    if (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
    )
        return "image/jpeg"
    if (
        bytes.length >= 12 &&
        String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
    )
        return "image/webp"
    return null
}

/** Decoded facts supplied by the image library after the bytes passed the size bound. */
export type DecodedImage = {
    width: number | undefined
    height: number | undefined
    pages: number | undefined
    format: string | undefined
}
export function validateImageSource(input: {
    declaredType: string | null
    bytes: number
    sniffed: ImageInputType | null
    decoded: DecodedImage | null
    /** When given, the kind's minimum source size applies. */
    kind?: ImageAssetKind
}): ImageValidationError | null {
    if (input.bytes <= 0 || input.bytes > IMAGE_MAX_INPUT_BYTES)
        return "too_large"
    const declared = (input.declaredType ?? "")
        .split(";")[0]!
        .trim()
        .toLowerCase()
    if (!(IMAGE_INPUT_TYPES as readonly string[]).includes(declared))
        return "unsupported_type"
    if (!input.sniffed) return "unsupported_type"
    if (input.sniffed !== declared) return "type_mismatch"
    if (!input.decoded) return "undecodable"
    const expected = {
        "image/png": "png",
        "image/jpeg": "jpeg",
        "image/webp": "webp",
    }[input.sniffed]
    if (input.decoded.format !== expected) return "type_mismatch"
    const { width, height, pages } = input.decoded
    if (
        !width ||
        !height ||
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width > IMAGE_MAX_SOURCE_DIMENSION ||
        height > IMAGE_MAX_SOURCE_DIMENSION
    )
        return "bad_dimensions"
    const minimum = input.kind ? IMAGE_MIN_SOURCE[input.kind] : undefined
    if (minimum && (width < minimum.width || height < minimum.height))
        return "bad_dimensions"
    if (pages !== undefined && pages > 1) return "animated"
    return null
}

/**
 * Defence in depth at the storage boundary: only the kind's normalized format,
 * confirmed by its magic number, within the source byte bound, is ever stored.
 */
export function isStorableNormalizedImage(input: {
    kind: ImageAssetKind
    contentType: string
    bytes: Uint8Array
}): boolean {
    const expected = IMAGE_OUTPUT_TYPES[IMAGE_OUTPUT[input.kind].format]
    return (
        input.bytes.byteLength > 0 &&
        input.bytes.byteLength <= IMAGE_MAX_INPUT_BYTES &&
        input.contentType === expected &&
        sniffImageType(input.bytes) === expected
    )
}

export type ImageAssetEntity = {
    id: string
    guildId: string
    kind: ImageAssetKind
    publicId: string
    contentType: ImageInputType
    width: number
    height: number
    bytes: number
    publicUrl: string
    state: ImageAssetState
    createdAt: string
}

/** Attachment requires the same workspace, the right kind and a live asset. */
export function canAttachImageAsset(
    asset: Pick<ImageAssetEntity, "guildId" | "kind" | "state"> | null,
    owner: { guildId: string; kind: ImageAssetKind }
): boolean {
    return (
        !!asset &&
        asset.guildId === owner.guildId &&
        asset.kind === owner.kind &&
        asset.state === "ready"
    )
}

/** Unreferenced assets older than the TTL are claimed; referenced assets are never due. */
export function cleanupDue(
    asset: Pick<ImageAssetEntity, "state" | "createdAt">,
    referenced: boolean,
    now: number
): boolean {
    return (
        !referenced &&
        asset.state === "ready" &&
        Date.parse(asset.createdAt) <= now - IMAGE_UNATTACHED_TTL_MS
    )
}

export const imageAssetDtoSchema = z.strictObject({
    id: z.string(),
    kind: imageAssetKindSchema,
    contentType: z.enum(IMAGE_INPUT_TYPES),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    bytes: z.number().int().min(1),
    url: z.string(),
    createdAt: z.string(),
})
export type ImageAssetDto = z.infer<typeof imageAssetDtoSchema>
export function projectImageAsset(asset: ImageAssetEntity): ImageAssetDto {
    return imageAssetDtoSchema.parse({
        id: asset.id,
        kind: asset.kind,
        contentType: asset.contentType,
        width: asset.width,
        height: asset.height,
        bytes: asset.bytes,
        url: asset.publicUrl,
        createdAt: asset.createdAt,
    })
}

/** Immutable public path; the file name extension matches the normalized format. */
export function imageAssetPath(publicId: string, contentType: ImageInputType) {
    return `/api/image-assets/${publicId}.${contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg"}`
}
export function parseImageAssetFile(
    file: string
): { publicId: string; extension: string } | null {
    const match = /^([a-f0-9]{32})\.(png|webp|jpg)$/.exec(file)
    return match ? { publicId: match[1]!, extension: match[2]! } : null
}
